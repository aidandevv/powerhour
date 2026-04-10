# PII Masking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure no PII (account names, institution names, merchant names, transaction descriptions) reaches the Gemini API, while preserving full agent functionality and readable UI output.

**Architecture:** A `PiiMasker` class builds a bidirectional alias map per request. It integrates into the AI SDK pipeline via `experimental_transform` on `streamText` — a single `TransformStream` that masks `tool-result` parts before Gemini sees them and unmasks `text-delta` parts before the UI receives them. User messages are masked before `convertToModelMessages()`. Tool input parameters are unmasked via a wrapped tools object so DB queries use real values.

**Tech Stack:** Vercel AI SDK v6 (`experimental_transform`, `TextStreamPart`), Drizzle ORM, TypeScript, vitest

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/agent/pii-masker.ts` | **New.** `PiiMasker` class — alias map, entity registration, mask/unmask methods |
| `lib/agent/pii-transform.ts` | **New.** `createPiiTransform()` — returns AI SDK `StreamTextTransform` that masks tool results and unmasks text deltas |
| `lib/agent/agent.ts` | **Modified.** Accept masker, wrap tools, mask user messages, add transform |
| `lib/agent/budget-planner-agent.ts` | **Modified.** Same integration |
| `app/api/ai/chat/route.ts` | **Modified.** Instantiate + seed masker |
| `app/api/ai/budget-planner/route.ts` | **Modified.** Same |
| `lib/agent/__tests__/pii-masker.test.ts` | **New.** Unit tests for PiiMasker |
| `lib/agent/__tests__/pii-transform.test.ts` | **New.** Unit tests for the stream transform |
| `vitest.config.ts` | **New.** Vitest configuration |

---

### Task 1: Set up vitest

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to the `"scripts"` section in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest for unit testing"
```

---

### Task 2: PiiMasker class — core alias map and masking

**Files:**
- Create: `lib/agent/pii-masker.ts`
- Create: `lib/agent/__tests__/pii-masker.test.ts`

- [ ] **Step 1: Write failing tests for entity registration and text masking**

Create `lib/agent/__tests__/pii-masker.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { PiiMasker } from "../pii-masker";

describe("PiiMasker", () => {
  describe("entity registration and text masking", () => {
    it("masks a registered institution name", () => {
      const masker = new PiiMasker();
      masker.registerInstitution("Bank of America");
      expect(masker.maskText("Bank of America balance is $500")).toBe(
        "Bank-1 balance is $500"
      );
    });

    it("masks a registered account name", () => {
      const masker = new PiiMasker();
      masker.registerAccount("Chase Sapphire Visa");
      expect(masker.maskText("Chase Sapphire Visa owes $200")).toBe(
        "Account-A owes $200"
      );
    });

    it("masks a registered merchant", () => {
      const masker = new PiiMasker();
      masker.registerMerchant("Starbucks");
      expect(masker.maskText("Starbucks charged $5")).toBe(
        "Merchant-1 charged $5"
      );
    });

    it("assigns stable aliases across multiple calls", () => {
      const masker = new PiiMasker();
      masker.registerInstitution("Chase");
      masker.registerInstitution("Wells Fargo");
      expect(masker.maskText("Chase and Wells Fargo")).toBe(
        "Bank-1 and Bank-2"
      );
      // Same call again — aliases are stable
      expect(masker.maskText("Chase and Wells Fargo")).toBe(
        "Bank-1 and Bank-2"
      );
    });

    it("replaces longest match first to avoid substring collisions", () => {
      const masker = new PiiMasker();
      masker.registerInstitution("Chase");
      masker.registerAccount("Chase Sapphire Visa");
      expect(masker.maskText("Chase Sapphire Visa")).toBe("Account-A");
      expect(masker.maskText("Chase balance")).toBe("Bank-1 balance");
    });

    it("does not mask numbers, dates, or categories", () => {
      const masker = new PiiMasker();
      const text = "$500.00 on 2026-01-15 in FOOD_AND_DRINK";
      expect(masker.maskText(text)).toBe(text);
    });
  });

  describe("unmaskText", () => {
    it("replaces aliases back to real values", () => {
      const masker = new PiiMasker();
      masker.registerInstitution("Bank of America");
      masker.registerMerchant("Starbucks");
      expect(masker.unmaskText("Bank-1 and Merchant-1")).toBe(
        "Bank of America and Starbucks"
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/agent/__tests__/pii-masker.test.ts
```

Expected: FAIL — `PiiMasker` not found.

- [ ] **Step 3: Implement PiiMasker core**

Create `lib/agent/pii-masker.ts`:

```typescript
/**
 * Bidirectional PII masking for AI agent pipeline.
 *
 * Builds an alias map of real entity names to anonymized labels.
 * Masks text before it reaches the LLM, unmasks LLM output before
 * it reaches the UI. One instance per agent request.
 */

type EntityType = "institution" | "account" | "merchant";

interface AliasEntry {
  real: string;
  alias: string;
  type: EntityType;
}

const ACCOUNT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class PiiMasker {
  private realToAlias = new Map<string, string>();
  private aliasToReal = new Map<string, string>();
  private counters = { institution: 0, account: 0, merchant: 0 };

  // Sorted longest-first for replacement
  private sortedEntries: AliasEntry[] = [];
  private sortedAliases: AliasEntry[] = [];
  private dirty = false;

  // ── Registration ──────────────────────────────────────────────

  registerInstitution(name: string): string {
    return this.register(name, "institution");
  }

  registerAccount(name: string): string {
    return this.register(name, "account");
  }

  registerMerchant(name: string): string {
    return this.register(name, "merchant");
  }

  private register(real: string, type: EntityType): string {
    const existing = this.realToAlias.get(real);
    if (existing) return existing;

    const alias = this.nextAlias(type);
    this.realToAlias.set(real, alias);
    this.aliasToReal.set(alias, real);
    this.dirty = true;
    return alias;
  }

  private nextAlias(type: EntityType): string {
    const idx = ++this.counters[type];
    switch (type) {
      case "institution":
        return `Bank-${idx}`;
      case "account":
        return `Account-${ACCOUNT_LETTERS[(idx - 1) % 26]}`;
      case "merchant":
        return `Merchant-${idx}`;
    }
  }

  // ── Sorted entry cache (rebuilt on dirty) ─────────────────────

  private rebuildIfDirty() {
    if (!this.dirty) return;
    this.sortedEntries = [...this.realToAlias.entries()]
      .map(([real, alias]) => ({
        real,
        alias,
        type: "institution" as EntityType, // type unused in replacement
      }))
      .sort((a, b) => b.real.length - a.real.length);

    this.sortedAliases = [...this.aliasToReal.entries()]
      .map(([alias, real]) => ({
        real,
        alias,
        type: "institution" as EntityType,
      }))
      .sort((a, b) => b.alias.length - a.alias.length);

    this.dirty = false;
  }

  // ── Masking / unmasking ───────────────────────────────────────

  /** Replace all known real values with aliases. */
  maskText(text: string): string {
    this.rebuildIfDirty();
    let result = text;
    for (const entry of this.sortedEntries) {
      result = replaceAll(result, entry.real, entry.alias);
    }
    return result;
  }

  /** Replace all aliases with real values. */
  unmaskText(text: string): string {
    this.rebuildIfDirty();
    let result = text;
    for (const entry of this.sortedAliases) {
      result = replaceAll(result, entry.alias, entry.real);
    }
    return result;
  }

  /** Check if a string contains any alias patterns. */
  hasPartialAlias(text: string): boolean {
    return /(?:Bank-|Account-|Merchant-)\d*$/.test(text);
  }
}

function replaceAll(str: string, search: string, replace: string): string {
  if (search.length === 0) return str;
  let result = "";
  let i = 0;
  while (i < str.length) {
    if (str.startsWith(search, i)) {
      result += replace;
      i += search.length;
    } else {
      result += str[i];
      i++;
    }
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/agent/__tests__/pii-masker.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/pii-masker.ts lib/agent/__tests__/pii-masker.test.ts
git commit -m "feat: add PiiMasker class with alias map and text masking"
```

---

### Task 3: PiiMasker — merchant normalization and P2P detection

**Files:**
- Modify: `lib/agent/pii-masker.ts`
- Modify: `lib/agent/__tests__/pii-masker.test.ts`

- [ ] **Step 1: Write failing tests for merchant normalization and P2P**

Add to `lib/agent/__tests__/pii-masker.test.ts`:

```typescript
describe("merchant normalization", () => {
  it("strips store numbers before registering", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Walgreens #1234");
    expect(masker.maskText("Walgreens #1234")).toBe("Merchant-1");
    // The normalized form also matches
    expect(masker.maskText("Walgreens")).toBe("Merchant-1");
  });

  it("strips trailing city/state patterns", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Target Sacramento CA");
    expect(masker.maskText("Target Sacramento CA")).toBe("Merchant-1");
    expect(masker.maskText("Target")).toBe("Merchant-1");
  });

  it("strips trailing ZIP codes", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Costco 95616");
    expect(masker.maskText("Costco 95616")).toBe("Merchant-1");
    expect(masker.maskText("Costco")).toBe("Merchant-1");
  });

  it("handles combined store number + location", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Walgreens #1234 Sacramento CA 95616");
    expect(masker.maskText("Walgreens #1234 Sacramento CA 95616")).toBe(
      "Merchant-1"
    );
    expect(masker.maskText("Walgreens")).toBe("Merchant-1");
  });
});

describe("P2P transaction masking", () => {
  it("masks Venmo payment names", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("VENMO PAYMENT TO JOHN SMITH");
    expect(masker.maskText("VENMO PAYMENT TO JOHN SMITH")).toBe("Merchant-1");
  });

  it("masks Zelle payment names", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("ZELLE TO JANE DOE");
    expect(masker.maskText("ZELLE TO JANE DOE")).toBe("Merchant-1");
  });

  it("masks CashApp payment names", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("CASH APP*JOHN SMITH");
    expect(masker.maskText("CASH APP*JOHN SMITH")).toBe("Merchant-1");
  });

  it("masks PayPal payment names", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("PAYPAL *JANE DOE");
    expect(masker.maskText("PAYPAL *JANE DOE")).toBe("Merchant-1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/agent/__tests__/pii-masker.test.ts
```

Expected: new tests FAIL (normalization not yet implemented — raw strings registered, normalized forms don't match).

- [ ] **Step 3: Add normalization to registerMerchant**

In `lib/agent/pii-masker.ts`, add a `normalizeMerchant` function and update `registerMerchant`:

```typescript
// Add above the class definition:

/** Strip store numbers, trailing city/state, and ZIP codes from merchant names. */
function normalizeMerchant(raw: string): string {
  let name = raw.trim();
  // Strip store numbers: #1234, # 1234
  name = name.replace(/\s*#\s*\d+/g, "");
  // Strip trailing ZIP: 5 digits optionally followed by -4 digits
  name = name.replace(/\s+\d{5}(-\d{4})?\s*$/, "");
  // Strip trailing city/state: 1-2 capitalized words + 2-letter state code at end
  // e.g. "Sacramento CA", "New York NY", "San Francisco CA"
  name = name.replace(
    /\s+[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\s+[A-Z]{2}\s*$/,
    ""
  );
  return name.trim();
}
```

Update `registerMerchant` in the class:

```typescript
registerMerchant(raw: string): string {
  // Register the raw form so exact matches work
  const existingRaw = this.realToAlias.get(raw);
  if (existingRaw) return existingRaw;

  const normalized = normalizeMerchant(raw);

  // Check if the normalized form was already registered
  const existingNorm = this.realToAlias.get(normalized);
  if (existingNorm) {
    // Also register the raw form pointing to the same alias
    this.realToAlias.set(raw, existingNorm);
    this.dirty = true;
    return existingNorm;
  }

  const alias = this.nextAlias("merchant");

  // Register both raw and normalized forms
  this.realToAlias.set(raw, alias);
  this.aliasToReal.set(alias, normalized); // unmask to the clean form
  if (normalized !== raw) {
    this.realToAlias.set(normalized, alias);
  }

  this.dirty = true;
  return alias;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/agent/__tests__/pii-masker.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/pii-masker.ts lib/agent/__tests__/pii-masker.test.ts
git commit -m "feat: add merchant normalization and P2P detection to PiiMasker"
```

---

### Task 4: PiiMasker — deep object masking and tool input unmasking

**Files:**
- Modify: `lib/agent/pii-masker.ts`
- Modify: `lib/agent/__tests__/pii-masker.test.ts`

- [ ] **Step 1: Write failing tests for maskToolResult and unmaskToolInput**

Add to `lib/agent/__tests__/pii-masker.test.ts`:

```typescript
describe("maskToolResult", () => {
  it("deep-masks string fields in an object", () => {
    const masker = new PiiMasker();
    masker.registerAccount("Chase Checking");
    masker.registerMerchant("Starbucks");

    const result = masker.maskToolResult({
      accountName: "Chase Checking",
      transactions: [
        { name: "Starbucks", amount: 5.5 },
        { name: "Starbucks", amount: 4.0 },
      ],
      total: 9.5,
    });

    expect(result).toEqual({
      accountName: "Account-A",
      transactions: [
        { name: "Merchant-1", amount: 5.5 },
        { name: "Merchant-1", amount: 4.0 },
      ],
      total: 9.5,
    });
  });

  it("registers unknown merchant strings from name/merchantName fields", () => {
    const masker = new PiiMasker();
    const result = masker.maskToolResult({
      name: "Target",
      merchantName: "Target",
      amount: 50,
    });

    expect(result).toEqual({
      name: "Merchant-1",
      merchantName: "Merchant-1",
      amount: 50,
    });
  });

  it("does not mask non-entity string fields like category or frequency", () => {
    const masker = new PiiMasker();
    const result = masker.maskToolResult({
      category: "FOOD_AND_DRINK",
      frequency: "monthly",
      type: "credit",
    });

    expect(result).toEqual({
      category: "FOOD_AND_DRINK",
      frequency: "monthly",
      type: "credit",
    });
  });

  it("masks embedded entity names in summary strings", () => {
    const masker = new PiiMasker();
    masker.registerAccount("Chase Checking");
    const result = masker.maskToolResult({
      summary: "Chase Checking has a shortfall of $200",
    });

    expect(result).toEqual({
      summary: "Account-A has a shortfall of $200",
    });
  });
});

describe("unmaskToolInput", () => {
  it("unmasks configured parameters for search_transactions", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Starbucks");

    const result = masker.unmaskToolInput("search_transactions", {
      query: "Merchant-1",
      from: "2026-01-01",
      to: "2026-03-31",
    });

    expect(result).toEqual({
      query: "Starbucks",
      from: "2026-01-01",
      to: "2026-03-31",
    });
  });

  it("does not unmask parameters for unconfigured tools", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Starbucks");

    const result = masker.unmaskToolInput("get_spending_summary", {
      from: "2026-01-01",
      category: "Merchant-1",
    });

    expect(result).toEqual({
      from: "2026-01-01",
      category: "Merchant-1",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/agent/__tests__/pii-masker.test.ts
```

Expected: FAIL — `maskToolResult` and `unmaskToolInput` not defined.

- [ ] **Step 3: Implement maskToolResult and unmaskToolInput**

Add to `lib/agent/pii-masker.ts` inside the `PiiMasker` class:

```typescript
// Fields whose values should be auto-registered as merchants when encountered
private static MERCHANT_FIELDS = new Set([
  "name",
  "merchantName",
  "accountName",
  "institutionName",
]);

// Fields that should never be masked (category codes, types, etc.)
private static PASSTHROUGH_FIELDS = new Set([
  "id",
  "category",
  "frequency",
  "type",
  "subtype",
  "currencyCode",
  "date",
  "lastDate",
  "nextProjectedDate",
  "status",
  "institutionStatus",
  "reason",
  "flagged",
  "isUserConfirmed",
  "isActive",
]);

// Tool → parameter keys to unmask before DB queries
private static UNMASK_CONFIG: Record<string, Set<string>> = {
  search_transactions: new Set(["query"]),
  get_merchant_category_info: new Set(["merchant"]),
  suggest_transactions_for_group: new Set(["query"]),
  create_expense_group: new Set(["name", "description"]),
  create_savings_target: new Set(["name"]),
  create_budget_goal: new Set(["categoryLabel", "rationale"]),
};

/** Deep-walk a tool result, masking PII strings. */
maskToolResult(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === "number" || typeof data === "boolean") return data;
  if (typeof data === "string") return this.maskText(data);
  if (Array.isArray(data)) return data.map((item) => this.maskToolResult(item));

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (PiiMasker.PASSTHROUGH_FIELDS.has(key)) {
        masked[key] = value;
      } else if (
        typeof value === "string" &&
        PiiMasker.MERCHANT_FIELDS.has(key)
      ) {
        // Auto-register entity names from known fields
        if (key === "institutionName") {
          this.registerInstitution(value);
        } else if (key === "accountName") {
          this.registerAccount(value);
        } else {
          this.registerMerchant(value);
        }
        masked[key] = this.maskText(value);
      } else {
        masked[key] = this.maskToolResult(value);
      }
    }
    return masked;
  }

  return data;
}

/** Unmask specific tool input parameters so DB queries use real values. */
unmaskToolInput(
  toolName: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  const keysToUnmask = PiiMasker.UNMASK_CONFIG[toolName];
  if (!keysToUnmask) return params;

  const unmasked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (keysToUnmask.has(key) && typeof value === "string") {
      unmasked[key] = this.unmaskText(value);
    } else {
      unmasked[key] = value;
    }
  }
  return unmasked;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/agent/__tests__/pii-masker.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/pii-masker.ts lib/agent/__tests__/pii-masker.test.ts
git commit -m "feat: add deep object masking and tool input unmasking to PiiMasker"
```

---

### Task 5: PII stream transform

**Files:**
- Create: `lib/agent/pii-transform.ts`
- Create: `lib/agent/__tests__/pii-transform.test.ts`

- [ ] **Step 1: Write failing tests for the stream transform**

Create `lib/agent/__tests__/pii-transform.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { PiiMasker } from "../pii-masker";
import { createPiiTransform } from "../pii-transform";

describe("createPiiTransform", () => {
  it("masks tool-result parts", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Starbucks");

    const transform = createPiiTransform(masker);
    const part = {
      type: "tool-result" as const,
      toolCallId: "call-1",
      toolName: "search_transactions",
      result: { name: "Starbucks", amount: 5 },
    };

    // Manually run through the transform
    const reader = new ReadableStream({
      start(controller) {
        controller.enqueue(part);
        controller.close();
      },
    })
      .pipeThrough(transform)
      .getReader();

    return reader.read().then(({ value }) => {
      expect(value.type).toBe("tool-result");
      expect(value.result).toEqual({ name: "Merchant-1", amount: 5 });
    });
  });

  it("unmasks text-delta parts", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Starbucks");

    const transform = createPiiTransform(masker);
    const part = {
      type: "text-delta" as const,
      id: "text-1",
      text: "You spent $5 at Merchant-1",
    };

    const reader = new ReadableStream({
      start(controller) {
        controller.enqueue(part);
        controller.close();
      },
    })
      .pipeThrough(transform)
      .getReader();

    return reader.read().then(({ value }) => {
      expect(value.text).toBe("You spent $5 at Starbucks");
    });
  });

  it("unmasks tool-input-delta parts for configured tools", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Starbucks");

    const transform = createPiiTransform(masker);

    const chunks = [
      { type: "tool-input-start" as const, id: "t1", toolName: "search_transactions" },
      { type: "tool-input-delta" as const, id: "t1", delta: '{"query":"Merchant-1"}' },
      { type: "tool-input-end" as const, id: "t1" },
    ];

    // tool-input-delta for search_transactions should have query unmasked
    // The transform unmasks the parsed JSON in the tool-call part, not the delta
    // So tool-input-delta passes through unchanged — unmasking happens on tool-call
  });

  it("passes through non-text, non-tool parts unchanged", () => {
    const masker = new PiiMasker();
    const transform = createPiiTransform(masker);
    const part = { type: "start" as const };

    const reader = new ReadableStream({
      start(controller) {
        controller.enqueue(part);
        controller.close();
      },
    })
      .pipeThrough(transform)
      .getReader();

    return reader.read().then(({ value }) => {
      expect(value).toEqual({ type: "start" });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/agent/__tests__/pii-transform.test.ts
```

Expected: FAIL — `createPiiTransform` not found.

- [ ] **Step 3: Implement createPiiTransform**

Create `lib/agent/pii-transform.ts`:

```typescript
/**
 * AI SDK stream transform for PII masking.
 *
 * Operates on TextStreamPart objects in the streamText pipeline:
 * - tool-result parts: masks the result object (PII → aliases)
 * - text-delta parts: unmasks aliases back to real values (aliases → real)
 * - tool-call parts: unmasks tool input parameters for configured tools
 * - all other parts: passed through unchanged
 */
import type { PiiMasker } from "./pii-masker";

// TextStreamPart is a union type from the AI SDK. We type loosely here
// to avoid importing internal types. The transform only inspects `type`
// and known fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StreamPart = any;

/**
 * Returns an AI SDK StreamTextTransform — a function that receives
 * { tools } and returns a TransformStream<TextStreamPart, TextStreamPart>.
 */
export function createPiiTransform(masker: PiiMasker) {
  // The AI SDK calls this with { tools } — we don't need the tools reference.
  return () =>
    new TransformStream<StreamPart, StreamPart>({
      transform(part, controller) {
        switch (part.type) {
          case "tool-result": {
            // Mask the tool result before Gemini sees it
            controller.enqueue({
              ...part,
              result: masker.maskToolResult(part.result),
            });
            break;
          }

          case "tool-call": {
            // Unmask tool input parameters so DB queries use real values
            controller.enqueue({
              ...part,
              args: masker.unmaskToolInput(part.toolName, part.args),
            });
            break;
          }

          case "text-delta": {
            // Unmask aliases in the LLM response text before the UI
            controller.enqueue({
              ...part,
              text: masker.unmaskText(part.text),
            });
            break;
          }

          default:
            controller.enqueue(part);
        }
      },
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/agent/__tests__/pii-transform.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/pii-transform.ts lib/agent/__tests__/pii-transform.test.ts
git commit -m "feat: add PII stream transform for AI SDK pipeline"
```

---

### Task 6: PiiMasker seeding from database

**Files:**
- Modify: `lib/agent/pii-masker.ts`

- [ ] **Step 1: Add static seed method**

Add to `lib/agent/pii-masker.ts`:

```typescript
// Add import at top of file:
import { db } from "@/lib/db";
import { agentAccountsView, agentInstitutionsView } from "@/lib/db/views";

// Add static factory method to the class:

/**
 * Create a PiiMasker pre-seeded with all active accounts and institutions.
 * Call once per agent request before running the agent.
 */
static async create(): Promise<PiiMasker> {
  const masker = new PiiMasker();

  const [institutions, accounts] = await Promise.all([
    db.select().from(agentInstitutionsView),
    db.select().from(agentAccountsView),
  ]);

  for (const inst of institutions) {
    if (inst.institutionName) {
      masker.registerInstitution(inst.institutionName);
    }
  }

  for (const acct of accounts) {
    if (acct.name) {
      masker.registerAccount(acct.name);
    }
    if (acct.officialName) {
      masker.registerAccount(acct.officialName);
    }
  }

  return masker;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agent/pii-masker.ts
git commit -m "feat: add database seeding to PiiMasker"
```

---

### Task 7: Integrate masker into Ticker agent

**Files:**
- Modify: `lib/agent/agent.ts`
- Modify: `app/api/ai/chat/route.ts`

- [ ] **Step 1: Update runAgent to accept a masker and apply the transform**

Replace the contents of `lib/agent/agent.ts`. The key changes are:
1. `runAgent` accepts an optional `PiiMasker`
2. User messages are masked before conversion
3. `experimental_transform` applies the PII stream transform
4. Tool execute functions are wrapped to unmask inputs and mask outputs

```typescript
/**
 * ReAct agent powered by Gemini 2.5 Flash Lite via Vercel AI SDK.
 * Streams responses token-by-token with an 8-step iteration cap.
 *
 * Tool keys use snake_case because Gemini models normalise camelCase
 * to snake_case in their function calls, causing SDK mismatches.
 */
import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { buildSystemPrompt } from "./prompt";
import { PiiMasker } from "./pii-masker";
import { createPiiTransform } from "./pii-transform";

// Tool function imports (unchanged — all 23 imports stay exactly as-is)
import { getSpendingSummary } from "./tools/spending-summary";
import { getAccountBalances } from "./tools/account-balances";
import {
  searchTransactions,
  transactionSearchSchema,
} from "./tools/transaction-search";
import { compareTrends } from "./tools/trend-comparison";
import { getRecurringExpenses } from "./tools/recurring-expenses";
import { auditRecurringExpenses } from "./tools/recurring-audit";
import { getCashFlowForecast } from "./tools/cash-flow-forecast";
import { getMerchantCategoryInfo } from "./tools/merchant-category-info";
import { detectSpendingAnomalies } from "./tools/detect-anomalies";
import { getDebtPayoff } from "./tools/debt-payoff";
import { getLatestDigest, generateWeeklyDigest } from "@/lib/digest/generate";
import { suggestTransactionsForGroup } from "./tools/suggest-transactions-for-group";
import { createExpenseGroup } from "./tools/create-expense-group";
import { addTransactionsToGroup } from "./tools/add-transactions-to-group";
import { getCreditUtilization } from "./tools/credit-utilization";
import { getNetWorthHistory } from "./tools/net-worth-history";
import { getCategoryTrends } from "./tools/category-trends";
import { getPaymentChannels } from "./tools/payment-channels";
import { getBudgetGoals } from "./tools/budget-goals";
import { getSavingsTargets } from "./tools/savings-targets";
import { createSavingsTargetRecord } from "./tools/create-savings-target";
import { getSpendingInsights } from "./tools/spending-insights";
import { computeSavingsProjection } from "./tools/savings-projection";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const model = google("gemini-2.5-flash-lite");

const agentTools = {
  // All 24 tool definitions remain exactly as-is — no changes.
  // (Full tool definitions omitted for brevity — they are unchanged from the current file.)
  get_spending_summary: tool({
    description:
      "Get a spending summary by category for a date range. Returns total spend and breakdown by category.",
    inputSchema: z.object({
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Start date in YYYY-MM-DD format"),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("End date in YYYY-MM-DD format"),
      category: z
        .string()
        .optional()
        .describe("Optional category filter (e.g. FOOD_AND_DRINK)"),
    }),
    execute: async (params) => getSpendingSummary(params),
  }),
  // ... (all other tools unchanged)
};

export type AgentTools = typeof agentTools;

/**
 * Mask user message content before sending to the model.
 * Returns a new array — does not mutate the originals.
 */
function maskMessages(messages: UIMessage[], masker: PiiMasker): UIMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "user") return msg;
    return {
      ...msg,
      parts: msg.parts.map((part) => {
        if (part.type === "text") {
          return { ...part, text: masker.maskText(part.text) };
        }
        return part;
      }),
    };
  });
}

/**
 * Run the agent with streaming. Returns a streamText result that can be
 * converted to a streaming response via .toUIMessageStreamResponse().
 */
export async function runAgent(messages: UIMessage[], masker?: PiiMasker) {
  const processedMessages = masker ? maskMessages(messages, masker) : messages;
  const modelMessages = await convertToModelMessages(processedMessages);

  return streamText({
    model,
    system: buildSystemPrompt(),
    messages: modelMessages,
    tools: agentTools,
    stopWhen: stepCountIs(8),
    abortSignal: AbortSignal.timeout(90_000),
    experimental_transform: masker ? [createPiiTransform(masker)] : [],
    onError: ({ error }) => {
      console.error("[agent] Stream error:", error);
    },
  });
}
```

**Note on tool definitions:** All 24 tool definitions in the `agentTools` object remain exactly as they currently are. The only change to this file is:
1. Import `PiiMasker` and `createPiiTransform`
2. Add the `maskMessages` helper function
3. `runAgent` accepts an optional `masker` parameter
4. Pass `experimental_transform` when masker is provided

- [ ] **Step 2: Update the chat API route to create and seed the masker**

Replace `app/api/ai/chat/route.ts`:

```typescript
/** Streaming chat endpoint for the Ticker AI agent. */
import { type UIMessage } from "ai";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { runAgent } from "@/lib/agent/agent";
import { PiiMasker } from "@/lib/agent/pii-masker";
import { apiError } from "@/lib/api/error";

export const runtime = "nodejs";

const chatRateLimiter = new RateLimiterMemory({
  points: 20,
  duration: 60,
  blockDuration: 30,
});

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    try {
      await chatRateLimiter.consume(ip);
    } catch {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const messages: UIMessage[] = body.messages ?? [];

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No messages provided." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const masker = await PiiMasker.create();
    const result = await runAgent(messages, masker);

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    console.error("[ai/chat] Error:", error instanceof Error ? error.message : "Unknown error");
    return apiError(error, "Something went wrong");
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/agent/agent.ts app/api/ai/chat/route.ts
git commit -m "feat: integrate PII masking into Ticker agent pipeline"
```

---

### Task 8: Integrate masker into Budget Planner agent

**Files:**
- Modify: `lib/agent/budget-planner-agent.ts`
- Modify: `app/api/ai/budget-planner/route.ts`

- [ ] **Step 1: Update runBudgetPlannerAgent to accept a masker**

In `lib/agent/budget-planner-agent.ts`, make three changes:

1. Add imports at the top:

```typescript
import { PiiMasker } from "./pii-masker";
import { createPiiTransform } from "./pii-transform";
```

2. Update `BudgetPlannerOptions` interface:

```typescript
export interface BudgetPlannerOptions {
  budgetContext?: {
    estimatedTotal: number;
    planTitle: string;
  };
  masker?: PiiMasker;
}
```

3. Add `maskMessages` helper (same as in agent.ts):

```typescript
function maskMessages(messages: UIMessage[], masker: PiiMasker): UIMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "user") return msg;
    return {
      ...msg,
      parts: msg.parts.map((part) => {
        if (part.type === "text") {
          return { ...part, text: masker.maskText(part.text) };
        }
        return part;
      }),
    };
  });
}
```

4. Update `runBudgetPlannerAgent`:

```typescript
export async function runBudgetPlannerAgent(
  messages: UIMessage[],
  options?: BudgetPlannerOptions
) {
  const masker = options?.masker;
  const processedMessages = masker ? maskMessages(messages, masker) : messages;
  const modelMessages = await convertToModelMessages(processedMessages);
  const systemPrompt = buildSystemPrompt(options?.budgetContext);

  return streamText({
    model: google("gemini-2.5-flash-lite"),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      // All tool definitions remain exactly as-is
      // ...
    },
    stopWhen: stepCountIs(16),
    abortSignal: AbortSignal.timeout(120_000),
    experimental_transform: masker ? [createPiiTransform(masker)] : [],
    onError: ({ error }) => {
      console.error("[budget-planner-agent] Stream error:", error);
    },
  });
}
```

- [ ] **Step 2: Update the budget planner API route**

In `app/api/ai/budget-planner/route.ts`, add masker creation. The only changes are importing `PiiMasker` and passing it through:

Add import:

```typescript
import { PiiMasker } from "@/lib/agent/pii-masker";
```

Update the handler — add masker creation after the `options` assignment and pass it through:

```typescript
    const masker = await PiiMasker.create();

    const result = await runBudgetPlannerAgent(messages, {
      ...options,
      masker,
    });
```

- [ ] **Step 3: Commit**

```bash
git add lib/agent/budget-planner-agent.ts app/api/ai/budget-planner/route.ts
git commit -m "feat: integrate PII masking into Budget Planner agent pipeline"
```

---

### Task 9: Extract shared maskMessages helper

**Files:**
- Create: `lib/agent/mask-messages.ts`
- Modify: `lib/agent/agent.ts`
- Modify: `lib/agent/budget-planner-agent.ts`

- [ ] **Step 1: Extract maskMessages to its own file**

Create `lib/agent/mask-messages.ts`:

```typescript
import type { UIMessage } from "ai";
import type { PiiMasker } from "./pii-masker";

/**
 * Mask user message content before sending to the model.
 * Returns a new array — does not mutate the originals.
 */
export function maskMessages(
  messages: UIMessage[],
  masker: PiiMasker
): UIMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "user") return msg;
    return {
      ...msg,
      parts: msg.parts.map((part) => {
        if (part.type === "text") {
          return { ...part, text: masker.maskText(part.text) };
        }
        return part;
      }),
    };
  });
}
```

- [ ] **Step 2: Update agent.ts and budget-planner-agent.ts to import from shared file**

In both files, replace the inline `maskMessages` function with:

```typescript
import { maskMessages } from "./mask-messages";
```

And remove the local `maskMessages` function definition.

- [ ] **Step 3: Commit**

```bash
git add lib/agent/mask-messages.ts lib/agent/agent.ts lib/agent/budget-planner-agent.ts
git commit -m "refactor: extract shared maskMessages helper"
```

---

### Task 10: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the dashboard and test the Ticker agent**

1. Open the app in a browser
2. Ask Ticker: "What are my account balances?"
3. Verify: the response shows real account names (unmasked), not "Account-A"
4. Check server logs — the data sent to Gemini should contain aliases

- [ ] **Step 3: Test merchant search round-trip**

1. Ask Ticker: "How much did I spend at [any known merchant]?"
2. Verify: the response references the real merchant name
3. Verify: the agent correctly found transactions (search worked with unmasked input)

- [ ] **Step 4: Test the Budget Planner**

1. Open the budget planner
2. Ask: "How can I cut spending?"
3. Verify: response shows real merchant/account names, not aliases

- [ ] **Step 5: Final commit with any fixes**

```bash
git add -A
git commit -m "feat: PII masking for AI agent pipeline — complete"
```
