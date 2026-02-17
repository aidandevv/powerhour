"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectionCalendar } from "@/components/dashboard/projection-calendar";
import { SavingsProjectionChart } from "@/components/charts/savings-projection-chart";
import { formatCurrency } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectedExpense } from "@/types";
import { Check, X, Target, MapPin } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SavingsTarget {
  id: string;
  name: string;
  targetAmount: string;
  targetDate: string;
  monthlyAmount: string;
  createdAt: string;
}

interface RecurringItemData {
  id: string;
  name: string;
  merchantName: string | null;
  amount: string;
  frequency: string;
  lastDate: string | null;
  nextProjectedDate: string | null;
  isActive: boolean;
  isUserConfirmed: boolean;
}

interface ProjectionData {
  projections: ProjectedExpense[];
  totalProjected: number;
  shortfalls: { accountId: string; accountName: string; shortfall: number }[];
}

export default function ProjectionsPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<string>(() =>
    tabParam === "savings" ? "savings" : "calendar"
  );

  useEffect(() => {
    if (tabParam === "savings") setActiveTab("savings");
  }, [tabParam]);

  const [days, setDays] = useState(90);
  const { data: projData } = useSWR<ProjectionData>(
    `/api/projections?days=${days}`,
    fetcher
  );
  const { data: recurringData, mutate: mutateRecurring } = useSWR<{
    items: RecurringItemData[];
  }>("/api/recurring", fetcher);
  const { data: savingsTargets } = useSWR<SavingsTarget[]>(
    "/api/savings-targets",
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 10000, // Poll every 10 seconds to catch new targets from Budget Planner
    }
  );

  async function handleConfirm(id: string, confirmed: boolean) {
    await fetch(`/api/recurring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isUserConfirmed: confirmed }),
    });
    mutateRecurring();
  }

  async function handleDeactivate(id: string) {
    await fetch(`/api/recurring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    mutateRecurring();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Projections</h1>

      {projData?.shortfalls && projData.shortfalls.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <p className="font-medium text-sm">Potential Shortfalls</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {projData.shortfalls.map((s) => (
                <li key={s.accountId}>
                  {s.accountName}: projected outflows exceed available balance
                  by {formatCurrency(s.shortfall)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              30-Day Projected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(
                (projData?.projections || [])
                  .filter((p) => {
                    const d = new Date(p.date);
                    const limit = new Date();
                    limit.setDate(limit.getDate() + 30);
                    return d <= limit;
                  })
                  .reduce((s, p) => s + p.amount, 0)
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              60-Day Projected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(
                (projData?.projections || [])
                  .filter((p) => {
                    const d = new Date(p.date);
                    const limit = new Date();
                    limit.setDate(limit.getDate() + 60);
                    return d <= limit;
                  })
                  .reduce((s, p) => s + p.amount, 0)
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              90-Day Projected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(projData?.totalProjected || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calendar">Expense Calendar</TabsTrigger>
          <TabsTrigger value="recurring">Recurring Items</TabsTrigger>
          <TabsTrigger value="savings">Savings Goals</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <ProjectionCalendar projections={projData?.projections || []} />
        </TabsContent>

        <TabsContent value="recurring" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Detected Recurring Items</CardTitle>
            </CardHeader>
            <CardContent>
              {!recurringData?.items?.length ? (
                <p className="text-muted-foreground">
                  No recurring items detected yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {recurringData.items
                    .filter((item) => item.isActive)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-xs">
                              {item.frequency}
                            </Badge>
                            {item.isUserConfirmed ? (
                              <Badge className="text-xs">Confirmed</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Unconfirmed
                              </Badge>
                            )}
                            {item.nextProjectedDate && (
                              <span className="text-xs text-muted-foreground">
                                Next:{" "}
                                {new Date(
                                  item.nextProjectedDate
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            {formatCurrency(parseFloat(item.amount))}
                          </span>
                          {!item.isUserConfirmed && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleConfirm(item.id, true)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeactivate(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="savings" className="mt-4">
          <div className="space-y-6">
            {!savingsTargets?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground mb-1">
                    No savings goals yet.
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create one from a budget plan in the Budget Planner.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/budget-planner" className="gap-2">
                      <MapPin className="h-4 w-4" />
                      Go to Budget Planner
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {savingsTargets.map((t) => {
                  const targetAmount = parseFloat(t.targetAmount);
                  const monthlyAmount = parseFloat(t.monthlyAmount);
                  return (
                    <Card key={t.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(targetAmount)} by{" "}
                          {new Date(t.targetDate).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          · {formatCurrency(monthlyAmount)}/mo
                        </p>
                      </CardHeader>
                      <CardContent>
                        <SavingsProjectionChart
                          name={t.name}
                          targetAmount={targetAmount}
                          monthlyAmount={monthlyAmount}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
