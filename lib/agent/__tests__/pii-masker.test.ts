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

  describe("merchant normalization", () => {
    it("strips store numbers before registering", () => {
      const masker = new PiiMasker();
      masker.registerMerchant("Walgreens #1234");
      expect(masker.maskText("Walgreens #1234")).toBe("Merchant-1");
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
      expect(masker.maskText("Walgreens #1234 Sacramento CA 95616")).toBe("Merchant-1");
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
});
