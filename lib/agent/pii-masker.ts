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
