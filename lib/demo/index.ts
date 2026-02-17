/**
 * Demo mode helpers.
 *
 * Set DEMO_MODE=true (server) and NEXT_PUBLIC_DEMO_MODE=true (client)
 * in your environment to enable demo mode with seeded fake data.
 */

/** True when the server-side DEMO_MODE env var is "true". */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** Fixed UUID prefix for all demo-seeded rows — used to detect if demo data exists. */
export const DEMO_INST_ID_1 = "d0000000-0000-4000-8000-000000000001";
export const DEMO_INST_ID_2 = "d0000000-0000-4000-8000-000000000002";

export const DEMO_ACCT_CHECKING = "d0000000-0001-4000-8000-000000000001";
export const DEMO_ACCT_SAVINGS  = "d0000000-0001-4000-8000-000000000002";
export const DEMO_ACCT_VISA     = "d0000000-0001-4000-8000-000000000003";
export const DEMO_ACCT_MC       = "d0000000-0001-4000-8000-000000000004";
