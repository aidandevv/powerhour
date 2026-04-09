# PII Masking for AI Agent Pipeline

**Date:** 2026-04-09
**Status:** Approved
**Goal:** Ensure no personally identifiable information reaches the Gemini API from tool results or user messages, while preserving full agent functionality and a readable UI.

---

## Problem

The Ticker and Budget Planner agents send tool results to Gemini that contain PII:

- **Institution names** (e.g. "Bank of America") — reveals banking relationships
- **Account names** (e.g. "Chase Sapphire Visa") — reveals specific products
- **Merchant/transaction names** (e.g. "VENMO PAYMENT TO JOHN SMITH", "Walgreens #1234 Sacramento CA") — can contain real names and physical locations
- **User messages** — may reference real names, merchants, or other PII

The existing database views already exclude Plaid tokens and credentials. This design extends that protection to all identifying strings in the data layer exposed to the LLM.

---

## Approach: Bidirectional Masking with Per-Request Alias Map

A `PiiMasker` class maintains an in-memory map of real values to stable aliases for the duration of a single agent invocation. It wraps the existing agent pipeline at three points (tool results out, user messages in, streamed response back) without modifying any tool function internals.

---

## 1. PiiMasker Class

**File:** `lib/agent/pii-masker.ts`

### Alias Prefixes

| Entity type | Prefix | Example |
|---|---|---|
| Institutions | `Bank-` | `Bank-1`, `Bank-2` |
| Accounts | `Account-` | `Account-A`, `Account-B` |
| Merchants / transaction names | `Merchant-` | `Merchant-1`, `Merchant-2` |

### Seeding

On construction, the masker queries the database for all active accounts and institutions. These are registered in the alias map immediately, producing stable aliases for the full conversation. Merchant aliases are added lazily as tool results arrive.

### Methods

**`maskToolResult(data: unknown): unknown`**
Deep-walks a tool result (object, array, or primitive). Any string value that matches a registered entity is replaced with its alias. Unrecognized merchant/transaction name strings are registered on first encounter. Replacement uses longest-match-first ordering to prevent substring collisions (e.g. "Chase" inside "Chase Sapphire Visa").

**`maskUserMessage(text: string): string`**
Replaces all known real values in a user message string with their aliases. Applied before messages are sent to `convertToModelMessages()`.

**`unmaskText(text: string): string`**
Replaces all aliases in a string with their real values. Used on the streamed response before it reaches the UI.

**`unmaskToolInput(toolName: string, params: Record<string, unknown>): Record<string, unknown>`**
Selectively unmasks specific parameters so that DB queries use real values. Only configured keys are unmasked; all others pass through unchanged.

### Masking Rules

**Location suffix stripping:** Before registering a merchant, strip trailing patterns:
- Store numbers: `#\d+`
- City/state: trailing `City ST` or `City, ST` patterns
- ZIP codes: `\d{5}(-\d{4})?$`

Example: `"Walgreens #1234 Sacramento CA"` normalizes to `"Walgreens"` before alias registration.

**P2P transaction detection:** Regex patterns for Venmo, Zelle, PayPal, CashApp transaction names. The entire string is aliased as a single merchant (the person name is never extracted or stored separately).

**What is NOT masked:** Dollar amounts, dates, categories (Plaid codes), frequencies, account types/subtypes, currency codes, boolean flags, counts, UUIDs.

### Substring Collision Prevention

The alias replacement list is sorted by string length descending before applying. This ensures "Chase Sapphire Visa" is replaced before "Chase" could match as a substring.

---

## 2. Integration Points

### Tool Result Masking

A `wrapToolsWithMasker(tools, masker, unmaskConfig)` utility proxies each tool's `execute` function:

1. Unmask input parameters per `unmaskConfig` (so DB queries use real values)
2. Call the original `execute`
3. Mask the return value via `masker.maskToolResult()`

No tool function source code is modified.

### User Message Masking

Before `convertToModelMessages(messages)` in both `runAgent()` and `runBudgetPlannerAgent()`, map over messages and apply `masker.maskUserMessage()` to each user message's text content. The original unmasked messages are preserved for the UI.

### Response Stream Unmasking

The streamed response passes through a `TransformStream` that calls `masker.unmaskText()` on each text chunk before it reaches the client.

---

## 3. Tool Input Unmasking Config

When Gemini calls a tool, it uses alias values (because that's all it has seen). The tool wrapper unmasks specific parameters before executing the DB query.

| Tool | Parameters to unmask |
|---|---|
| `search_transactions` | `query` |
| `get_merchant_category_info` | `merchant` |
| `suggest_transactions_for_group` | `query` |
| `create_expense_group` | `name`, `description` |
| `create_savings_target` | `name` |
| `create_budget_goal` | `categoryLabel`, `rationale` |

All other parameters (dates, amounts, UUIDs, category codes) pass through unchanged.

### Search Round-Trip Example

1. User: "how much did I spend at Starbucks?"
2. `maskUserMessage` -> "how much did I spend at Merchant-1?"
3. Gemini calls `search_transactions({ query: "Merchant-1" })`
4. `unmaskToolInput` -> `{ query: "Starbucks" }`
5. DB returns real results
6. `maskToolResult` -> results with "Merchant-1" in name fields
7. Gemini: "You spent $240 at Merchant-1 this month"
8. `unmaskText` -> "You spent $240 at Starbucks this month"

---

## 4. Stream Chunk Buffering

Gemini streams token-by-token. An alias like `Merchant-12` could span two chunks (`"Merch"` + `"ant-12"`).

**Strategy:** The `createUnmaskTransform(masker)` function returns a `TransformStream<string, string>` that:

1. Maintains a trailing buffer (~20 chars)
2. On each chunk: concatenate buffer + chunk
3. Scan for complete alias matches, replace with real values
4. Check if the tail matches a partial alias prefix (`/(?:Bank-|Account-|Merchant-)\d*$/`)
5. If partial match: hold it in buffer, flush everything before it
6. If no partial: flush everything
7. On stream end: flush remaining buffer with final unmask pass

Maximum added latency: ~20 characters, imperceptible to the user.

**File:** `lib/agent/pii-stream-transform.ts`

---

## 5. Lifecycle

1. API route handler (`app/api/ai/chat/route.ts` or `app/api/ai/budget-planner/route.ts`) creates a `PiiMasker` instance
2. Masker seeds itself from DB (accounts + institutions query)
3. Masker is passed to the agent runner
4. Agent runner wraps tools, masks messages, pipes stream through unmask transform
5. Masker instance is garbage collected when the request ends

One masker per request. Never serialized. Never sent to the client.

---

## 6. Files

| File | Change |
|---|---|
| `lib/agent/pii-masker.ts` | **New.** `PiiMasker` class with alias map, mask/unmask methods |
| `lib/agent/pii-stream-transform.ts` | **New.** `createUnmaskTransform()` buffered stream transformer |
| `lib/agent/agent.ts` | **Modified.** Accept masker, wrap tools, mask messages, pipe stream |
| `lib/agent/budget-planner-agent.ts` | **Modified.** Same three integration points |
| `app/api/ai/chat/route.ts` | **Modified.** Instantiate and seed masker, pass to agent |
| `app/api/ai/budget-planner/route.ts` | **Modified.** Same |

No existing tool function files are modified.

---

## 7. What This Enables

With this in place, the following claim is accurate:

> "No personally identifiable information — account names, bank names, merchant details, or transaction descriptions — is sent to the AI provider. AI agents operate exclusively on anonymized aliases, with real values resolved only on your server."

Combined with the existing database view isolation (which excludes Plaid tokens and credentials), the full data path from DB to LLM is PII-free.
