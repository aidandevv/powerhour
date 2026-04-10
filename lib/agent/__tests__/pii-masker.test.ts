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
});
