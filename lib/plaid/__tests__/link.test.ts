import { describe, expect, it } from "vitest";
import { toSafeInstitution } from "../link";

describe("toSafeInstitution", () => {
  it("omits Plaid token and sync internals from client responses", () => {
    const institution = {
      id: "institution-1",
      plaidItemId: "item-secret",
      plaidAccessToken: "encrypted-token",
      institutionName: "Test Bank",
      institutionId: "ins_123",
      syncCursor: "cursor-secret",
      lastSyncedAt: new Date("2026-01-01T00:00:00Z"),
      status: "active",
      errorCode: "ITEM_LOGIN_REQUIRED",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    };

    expect(toSafeInstitution(institution)).toEqual({
      id: "institution-1",
      institutionName: "Test Bank",
      institutionId: "ins_123",
      status: "active",
      lastSyncedAt: new Date("2026-01-01T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });
    expect(toSafeInstitution(institution)).not.toHaveProperty("plaidAccessToken");
    expect(toSafeInstitution(institution)).not.toHaveProperty("syncCursor");
    expect(toSafeInstitution(institution)).not.toHaveProperty("plaidItemId");
    expect(toSafeInstitution(institution)).not.toHaveProperty("errorCode");
  });
});

