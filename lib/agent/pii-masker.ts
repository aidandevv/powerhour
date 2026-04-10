/**
 * Bidirectional PII masking for AI agent pipeline.
 *
 * Builds an alias map of real entity names to anonymized labels.
 * Masks text before it reaches the LLM, unmasks LLM output before
 * it reaches the UI. One instance per agent request.
 */

type EntityType = "institution" | "account" | "merchant";

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

  // ── Registration ──────────────────────────────────────────────

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
    this.sortedEntries = [...this.realToAlias.entries()]
      .map(([real, alias]) => ({
        real,
        alias,
        type: "institution" as EntityType,
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
