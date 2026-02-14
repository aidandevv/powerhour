"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDailySpending } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const NUM_WEEKS = 13;

function getHeatmapCells() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Find the most recent Sunday so we have full weeks
  const dayOfWeek = today.getDay(); // 0=Sun
  const endSunday = new Date(today);
  endSunday.setDate(today.getDate() + (7 - dayOfWeek));

  const cells: { date: string; col: number; row: number }[] = [];
  for (let week = NUM_WEEKS - 1; week >= 0; week--) {
    for (let day = 0; day < 7; day++) {
      const d = new Date(endSunday);
      d.setDate(endSunday.getDate() - week * 7 - (6 - day));
      // row: 0=Mon ... 6=Sun. Recharts day: 0=Sun, 1=Mon... 6=Sat
      // We want Mon=row0, so map: Mon(1)->0, Tue(2)->1, ... Sun(0)->6
      cells.push({
        date: d.toISOString().split("T")[0],
        col: NUM_WEEKS - 1 - week,
        row: day,
      });
    }
  }
  return cells;
}

function intensityClass(amount: number, max: number) {
  if (amount === 0) return "bg-secondary";
  const ratio = amount / max;
  if (ratio < 0.15) return "bg-blue-100 dark:bg-blue-950";
  if (ratio < 0.35) return "bg-blue-200 dark:bg-blue-900";
  if (ratio < 0.55) return "bg-blue-400 dark:bg-blue-700";
  if (ratio < 0.75) return "bg-blue-600 dark:bg-blue-500";
  return "bg-blue-800 dark:bg-blue-300";
}

function getMonthLabels(cells: { date: string; col: number }[]) {
  const labels: { month: string; col: number }[] = [];
  let lastMonth = "";
  for (const cell of cells) {
    const m = cell.date.slice(0, 7);
    if (m !== lastMonth) {
      labels.push({ month: new Date(cell.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" }), col: cell.col });
      lastMonth = m;
    }
  }
  return labels;
}

export function SpendingHeatmapChart() {
  const { data, isLoading } = useDailySpending();
  const cells = getHeatmapCells();

  const spendByDate = new Map<string, number>();
  for (const d of data?.days ?? []) {
    spendByDate.set(d.date, d.amount);
  }
  const maxAmount = Math.max(...Array.from(spendByDate.values()), 1);

  const monthLabels = getMonthLabels(cells.filter((c) => c.row === 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Spending (13 weeks)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[140px] flex items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            {/* Month labels */}
            <div
              className="flex mb-1"
              style={{ paddingLeft: 32 }}
            >
              {Array.from({ length: NUM_WEEKS }).map((_, col) => {
                const label = monthLabels.find((l) => l.col === col);
                return (
                  <div key={col} className="flex-none w-[14px] mr-[2px]">
                    {label && (
                      <span className="text-[9px] text-muted-foreground">{label.month}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-0">
              {/* Day labels */}
              <div className="flex flex-col mr-1">
                {DAY_LABELS.map((d, i) => (
                  <div
                    key={d}
                    className="text-[9px] text-muted-foreground flex items-center justify-end pr-1"
                    style={{ height: 14, marginBottom: 2 }}
                  >
                    {i % 2 === 0 ? d : ""}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${NUM_WEEKS}, 14px)`,
                  gridTemplateRows: "repeat(7, 14px)",
                  gap: 2,
                }}
              >
                {cells.map((cell) => {
                  const amount = spendByDate.get(cell.date) ?? 0;
                  return (
                    <div
                      key={cell.date}
                      title={`${cell.date}: $${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                      className={cn(
                        "rounded-sm cursor-default",
                        intensityClass(amount, maxAmount)
                      )}
                      style={{
                        gridColumn: cell.col + 1,
                        gridRow: cell.row + 1,
                        width: 14,
                        height: 14,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-1 mt-3 ml-8">
              <span className="text-[10px] text-muted-foreground">Less</span>
              {["bg-secondary", "bg-blue-100", "bg-blue-200", "bg-blue-400", "bg-blue-600", "bg-blue-800"].map((c) => (
                <div key={c} className={cn("w-3 h-3 rounded-sm", c)} />
              ))}
              <span className="text-[10px] text-muted-foreground">More</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
