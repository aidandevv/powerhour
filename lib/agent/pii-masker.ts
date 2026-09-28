/**
 * Bidirectional PII masking for AI agent pipeline.
 *
 * Builds an alias map of real entity names to anonymized labels.
 * Masks text before it reaches the LLM, unmasks LLM output before
 * it reaches the UI. One instance per agent request.
 */
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, institutions } from "@/lib/db/schema";

type EntityType = "institution" | "account" | "merchant";
const ALIAS_PARTIAL_PATTERN = /(?:Bank-\d*|Merchant-\d*|Account-[A-Z]*)$/;

/** Strip store numbers, trailing city/state, and ZIP codes from merchant names. */
function normalizeMerchant(raw: string): string {
  let name = raw.trim();
  // Strip store numbers: #1234, # 1234
  name = name.replace(/\s*#\s*\d+/g, "");
  // Strip trailing ZIP: 5 digits optionally followed by -4 digits
  name = name.replace(/\s+\d{5}(-\d{4})?\s*$/, "");
  // Strip trailing city/state: 1-2 capitalized words + 2-letter state code at end
  name = name.replace(
    /\s+[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\s+[A-Z]{2}\s*$/,
    ""
  );
  return name.trim();
}

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

  // ── Registration ──────────────────────────────────────────────

  async seedFromDatabase(): Promise<void> {
    const [institutionRows, accountRows] = await Promise.all([
      db
        .select({ institutionName: institutions.institutionName })
        .from(institutions)
        .where(eq(institutions.status, "active"))
        .orderBy(asc(institutions.institutionName)),
      db
        .select({ accountName: accounts.name })
        .from(accounts)
        .where(eq(accounts.isActive, true))
        .orderBy(asc(accounts.name)),
    ]);

    for (const row of institutionRows) {
      this.registerInstitution(row.institutionName);
    }

    for (const row of accountRows) {
      this.registerAccount(row.accountName);
    }
  }

  registerInstitution(name: string): string {
    return this.register(name, "institution");
  }

  registerAccount(name: string): string {
    return this.register(name, "account");
  }

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
    this.sortedEntries = Array.from(this.realToAlias.entries())
      .map(([real, alias]) => ({
        real,
        alias,
        type: "institution" as EntityType,
      }))
      .sort((a, b) => b.real.length - a.real.length);

    this.sortedAliases = Array.from(this.aliasToReal.entries())
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
    return ALIAS_PARTIAL_PATTERN.test(text);
  }

  splitBufferedText(text: string): { flushed: string; buffered: string } {
    this.rebuildIfDirty();

    let buffered = "";
    for (const entry of this.sortedAliases) {
      const maxPrefixLength = Math.min(entry.alias.length - 1, text.length);
      for (let length = maxPrefixLength; length > buffered.length; length--) {
        const suffix = text.slice(-length);
        if (entry.alias.startsWith(suffix)) {
          buffered = suffix;
          break;
        }
      }
    }

    if (buffered.length > 0) {
      return {
        flushed: text.slice(0, -buffered.length),
        buffered,
      };
    }

    const partialMatch = text.match(ALIAS_PARTIAL_PATTERN);
    if (!partialMatch || partialMatch.index === undefined) {
      return { flushed: text, buffered: "" };
    }

    return {
      flushed: text.slice(0, partialMatch.index),
      buffered: text.slice(partialMatch.index),
    };
  }

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
