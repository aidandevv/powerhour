import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { monthsUntil, parseBudgetTotal } from "../savings-targets";
import {
  generateSavingsProjection,
  monthsUntilGoal,
  projectedGoalDate,
} from "../savings-projections";

describe("savings projection calculations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a capped monthly path and stops as soon as the goal is reached", () => {
    const projection = generateSavingsProjection(1_200, 500);

    expect(projection).toHaveLength(4);
    expect(projection.map((point) => point.accumulated)).toEqual([0, 500, 1_000, 1_200]);
    expect(projection.at(-1)).toMatchObject({
      date: "2026-04-01",
      isGoalReached: true,
    });
  });

  it("handles invalid contributions and computes dates from an explicit start date", () => {
    expect(generateSavingsProjection(1_000, 0)).toEqual([]);
    expect(generateSavingsProjection(0, 100)).toEqual([]);
    expect(monthsUntilGoal(1_200, 500)).toBe(3);
    expect(monthsUntilGoal(1_200, 0)).toBe(Infinity);
    expect(projectedGoalDate(1_200, 500, new Date("2026-01-15T12:00:00.000Z"))).toBe("2026-04-01");
  });

  it("uses the middle estimate from a well-formed budget total", () => {
    expect(parseBudgetTotal("TOTAL (2 people)  $700  $1,200  $1,800")).toBe(1_200);
    expect(parseBudgetTotal("No total here")).toBeNull();
    expect(parseBudgetTotal(null)).toBeNull();
  });

  it("never returns fewer than one month for a due date", () => {
    expect(monthsUntil("2026-01-16")).toBe(1);
    expect(monthsUntil("2025-12-01")).toBe(1);
    expect(monthsUntil("2026-04-01")).toBe(3);
  });
});
