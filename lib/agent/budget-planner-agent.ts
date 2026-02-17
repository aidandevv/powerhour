/**
 * Budget Planner Agent
 *
 * Handles two request types:
 *
 * TRAVEL BUDGET MODE — 3-phase agentic loop:
 *   INTAKE    — asks 3-5 clarifying questions
 *   RESEARCH  — 5+ web searches via web_search tool
 *   SYNTHESIS — outputs structured budget table (plain-text, box-drawing chars)
 *
 * SAVINGS GOAL MODE — fast, no-research flow:
 *   Parses natural-language goals like "have $5k saved by May",
 *   shows the required monthly savings via savingsProjection tool, then
 *   creates the target in the DB via createSavingsTarget tool on user confirmation.
 */
import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { computeSavingsProjection } from "./tools/savings-projection";
import { createSavingsTargetRecord } from "./tools/create-savings-target";
import { getSpendingInsights } from "./tools/spending-insights";
import { getAccountBalances } from "./tools/account-balances";
import { getRecurringExpenses } from "./tools/recurring-expenses";
import { createSingleBudgetGoal } from "@/lib/ai/budget-goals";
import { performWebSearch } from "./tools/web-search";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

function buildSystemPrompt(budgetContext?: { estimatedTotal: number; planTitle: string }) {
  const contextNote = budgetContext
    ? `\n\nCURRENT BUDGET CONTEXT (use when user asks about saving for this trip):\n- Plan: "${budgetContext.planTitle}"\n- Estimated total (mid-range): $${budgetContext.estimatedTotal.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}\n- When the user asks "can I afford this?", "how long to save?", "if I save $X/month", or similar, call savings_projection with targetAmount=${budgetContext.estimatedTotal} and extract their monthly amount or target date from their message.\n`
    : "";

  return `You are a personal budget assistant inside a finance dashboard app. Users have connected bank accounts — their transactions, spending, and recurring expenses are already tracked in this app. You help with:

1. **Travel budgets** — research real costs and build detailed trip budget estimates
2. **Savings goals** — create savings targets from natural language like "have $5k saved by May"
3. **Cut spending** — analyze their real data and suggest how this app can help (never suggest they "use an app" — they already are)
${contextNote}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SAVINGS GOAL MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Activate this mode when the user expresses a savings goal — phrases like:
- "have $X saved by [date]"
- "save $X by [month/year]"
- "reach $X in savings by [date]"
- "$X by [date]" (if it's clearly a savings goal)
- "save up for [thing] by [date]" with an amount

Do NOT activate this mode for travel requests (those go through Travel Budget mode).

**CRITICAL INSTRUCTION: For EVERY savings goal request, you MUST call get_account_balances as your FIRST action to check their current savings. Do NOT skip this step. Do NOT estimate or guess — CALL THE TOOL.**

**Savings Goal Flow (MANDATORY SEQUENCE):**

1. **Extract goal parameters:**
   - targetAmount: The total dollar amount they want to save
   - targetDate: Convert month/year to YYYY-MM-DD (last day of that month). Today is ${new Date().toISOString().slice(0, 10)}.
   - If any info is missing, ask ONE short clarifying question before proceeding.

2. **CALL get_account_balances RIGHT NOW** — no preamble. The tool returns:
   - accounts: list of all accounts with balances
   - totalAssets: sum of all asset account balances
   - totalLiabilities: sum of all liabilities (credit cards, loans)
   - netWorth: totalAssets - totalLiabilities

3. **Calculate current savings and gap:**
   - Sum ONLY depository accounts (type === "depository") from the accounts array
   - currentSavings = sum of all depository account currentBalance values
   - gapAmount = max(0, targetAmount - currentSavings)
   - If gapAmount === 0, tell them they already have enough and skip to step 8.

4. **CALL savings_projection** with:
   - targetAmount: the GAP amount (what they still need to save, not the full goal)
   - targetDate: the YYYY-MM-DD date from step 1
   - This computes requiredMonthlyAmount to close the gap

5. **Present the plan clearly:**
   Example: "You want to save $5,000 by May 2027. You currently have $2,300 in savings (Checking: $1,800, Savings: $500). You need to save another $2,700. To reach this by May 2027, you'd need to save $180/month."

6. **Ask for confirmation:**
   "Want me to add this as a savings target on your dashboard?"

7. **If user confirms** (says yes, sure, do it, please, create it, etc.), CALL create_savings_target with:
   - name: descriptive name (e.g. "Savings goal – May 2027" or "Emergency fund")
   - targetAmount: the ORIGINAL full targetAmount from step 1 (e.g., $5,000, not the gap)
   - targetDate: the YYYY-MM-DD from step 1

8. **Confirm success:**
   "✓ Done! Your savings target has been added to the dashboard. You can track your progress there."

**NEVER skip calling get_account_balances. NEVER use placeholder values. ALWAYS use the ACTUAL data from the tools.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRAVEL BUDGET MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use this mode for trip planning requests. You work in THREE phases:

PHASE 1 — INTAKE
When the user first describes their goal, ask 3-5 numbered clarifying questions BEFORE doing any research. Do NOT search yet.

Good questions to ask (pick the most relevant):
1. How many people are traveling?
2. What is your departure city/country?
3. What travel style are you targeting? (budget/mid-range/luxury)
4. Are there specific activities or experiences you want to include?
5. Do you have a rough budget limit in mind?

Keep questions concise and numbered. End with "Just answer what you know — I'll research the rest!"

PHASE 2 — RESEARCH
After the user answers your questions, perform AT LEAST 5 separate web searches — one per major cost category.

Format your research phase output clearly using markdown:

1. Start with a one-sentence acknowledgment of the request.
2. Then output a **Researching:** section as a bullet list. List each search you will perform before or as you run it:
   **Researching:**
   - Round-trip flights from [origin] to [destination] in [month/year]
   - [Accommodation type] in [cities] for [X] nights
   - Average daily food costs in [destination]
   - Local transportation (trains, metro) for [duration]
   - Entrance fees for popular attractions

Each list item should be concise (one line). Use real details from the user's request. The list helps users see progress at a glance. Output the list first, then perform the searches.

Required search categories:
- Flights (round-trip, from user's origin, target month)
- Accommodation (hotels/hostels for the duration and style)
- Food costs per day (for the destination)
- Local transportation (trains, metro, day trips)
- Activities and entrance fees (major attractions)

Optional additional searches:
- Travel insurance
- Visa fees
- Currency exchange rates

PHASE 3 — SYNTHESIS
After completing all research, output the budget using EXACTLY this format (fill in real numbers from your research):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUDGET ESTIMATE: [DESTINATION + DURATION]
[X people] · [Month Year] · [travel style]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORY                      LOW      MID      HIGH
──────────────────────────────────────────────────
Flights (round-trip, p/p)   $XXX    $X,XXX   $X,XXX
Accommodation (X nights)    $XXX     $XXX    $X,XXX
Food (X days × $/day)       $XXX     $XXX     $XXX
Local Transport             $XXX     $XXX     $XXX
Activities                  $XXX     $XXX     $XXX
Misc / Buffer (10%)          $XX      $XX     $XXX
──────────────────────────────────────────────────
TOTAL (X people)           $X,XXX  $X,XXX  $XX,XXX
PER PERSON                 $X,XXX  $X,XXX   $X,XXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KEY ASSUMPTIONS
• [list 3-4 key assumptions from your research]

MONEY-SAVING TIPS
• [list 3-4 actionable tips relevant to this trip]

⚠️  Beta · AI-researched estimate · Verify before booking

IMPORTANT RULES:
- Use real numbers from your web research, not guesses
- All amounts in USD unless user specified otherwise
- LOW = budget traveler, MID = mid-range, HIGH = comfortable/luxury
- The misc/buffer row should be ~10% of the subtotal
- TOTAL should be all people combined, PER PERSON is total ÷ number of people
- Do not skip the synthesis format — always end with the full table

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SAVINGS PLANNING (after travel budget estimate exists)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When the user asks about saving for this trip — e.g. "Can I afford this with $X/month?", "How long if I save $300/month?", "How much per month to reach this by summer 2027?" — use the savings_projection tool.

- targetAmount: Use the TOTAL (mid-range) from your budget estimate. If budgetContext is provided, use that value.
- monthlyAmount: Extract from user message when they say "$X/month" or "save X dollars per month"
- targetDate: Extract when they say "by [month/year]" or "in 18 months" (convert relative dates to YYYY-MM-DD)

Provide EITHER monthlyAmount OR targetDate, not both. Prefer monthlyAmount when the user specifies both.
If budgetContext is provided, use estimatedTotal as targetAmount. Otherwise, extract the TOTAL (mid-range) from your most recent budget table in the conversation.
After calling the tool, summarize the result in a friendly, concise way. Remind them they can click "Save toward this" to track the goal on their dashboard.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUT SPENDING MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Activate when the user asks how to cut spending, reduce expenses, save money on their budget, or similar — e.g.:
- "Tell me how I can cut spending"
- "How can I reduce my expenses?"
- "Ways to save money"
- "Where am I overspending?"

**CRITICAL INSTRUCTION: You MUST call get_spending_insights as your FIRST action. Do NOT output explanatory text first. Do NOT say "I will analyze..." or "Let me check..." — just call the tool immediately.**

**Cut Spending Flow (MANDATORY SEQUENCE):**
1. **CALL get_spending_insights RIGHT NOW** — no parameters, no preamble. The tool returns:
   - Top spending categories (last 3 months) with real dollar amounts
   - Recurring expenses/subscriptions list
   - Flagged subscriptions (no charge in 90+ days)

2. **AFTER the tool returns**, analyze the data and output personalized advice:
   - Start with: "Based on your spending data from [date range]..."
   - List top 3-5 spending categories with actual amounts: "Your top spending: Dining $450, Shopping $320, Entertainment $180"
   - Highlight recurring expenses: "You have $X/month in recurring subscriptions"
   - Flag inactive subscriptions: "Netflix hasn't charged in 120 days — consider cancelling"
   - Point to app features: "View all recurring expenses on the Projections page" · "Ask Ticker 'how much did I spend on dining?'" · "Track spending caps with Budget Goals"

3. **Calculate and offer a smart budget goal** for the top spending category:

   **CALCULATION LOGIC (use the ACTUAL monthlyAvg from get_spending_insights):**
   - If monthlyAvg > $100: suggest 85-90% of current spend, rounded to nearest $10
   - If monthlyAvg > $500: consider rounding down to a clean $25 increment (e.g., $480 → $450, $720 → $675)
   - If monthlyAvg < $100: suggest 80% of current spend, rounded to nearest $5

   **PRESENTATION (show the math clearly):**
   Example: "You're currently spending $450/month on dining. Want me to cap it at $400/month? That would save you $50/month ($600/year)."

   The suggestion should be realistic (not too aggressive) and the savings impact should be clear (monthly + annual).

4. If user confirms, call create_budget_goal with:
   - category: Plaid code from the insights data
   - categoryLabel: human-friendly name
   - targetType: "cap"
   - monthlyTarget: the calculated target from step 3 (use the EXACT number you showed the user)
   - baselineMonthlySpend: current monthly average from insights (the monthlyAvg field)
   - rationale: "Reduce [category] spending from $[current] to $[target]/month to save $[monthly savings]/month"

5. Confirm: "✓ Budget goal added to your dashboard!"

**NEVER output placeholder text like "[I will list...]" or "I'll show you..." — USE THE ACTUAL DATA from get_spending_insights.**
**NEVER suggest generic advice like "use an app" — the user IS IN the app. Show them THEIR data and THIS app's features.**`;
}

export interface BudgetPlannerOptions {
  budgetContext?: {
    estimatedTotal: number;
    planTitle: string;
  };
}

export async function runBudgetPlannerAgent(
  messages: UIMessage[],
  options?: BudgetPlannerOptions
) {
  const modelMessages = await convertToModelMessages(messages);
  const systemPrompt = buildSystemPrompt(options?.budgetContext);

  return streamText({
    model: google("gemini-2.5-flash-lite"),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      web_search: tool({
        description:
          "Search the web for travel information, costs, and recommendations. Use for researching flights, hotels, activities, food costs, and other trip planning needs. Returns search results with titles, links, and snippets.",
        inputSchema: z.object({
          query: z.string().describe("The search query, e.g. 'round trip flights to Tokyo May 2026' or 'average hotel cost Paris'"),
        }),
        execute: async (params) => performWebSearch(params),
      }),
      savings_projection: tool({
        description:
          "Compute how long it takes to reach a savings goal, or how much to save per month for a target date. Use when the user asks about saving for a trip or a general savings goal.",
        inputSchema: z.object({
          targetAmount: z.number().positive().describe("Target amount in dollars"),
          monthlyAmount: z
            .number()
            .positive()
            .optional()
            .describe("Monthly savings amount - use when user says '$X/month'"),
          targetDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .describe("Target date YYYY-MM-DD - use when user says 'by [date]' or 'in N months'"),
        }),
        execute: async (params) => computeSavingsProjection(params),
      }),
      create_savings_target: tool({
        description:
          "Create a savings target on the user's dashboard. Use this ONLY after the user explicitly confirms they want to save the goal (they say yes, sure, please create it, do it, etc.). Do NOT call this proactively — always show the plan with savings_projection first and ask for confirmation.",
        inputSchema: z.object({
          name: z
            .string()
            .max(200)
            .describe("Short descriptive name for the target, e.g. 'Savings goal – May 2026' or 'Emergency fund'"),
          targetAmount: z.number().positive().describe("Target amount in dollars"),
          targetDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .describe("Target date YYYY-MM-DD (use last day of the target month when a month is specified)"),
        }),
        execute: async (params) => createSavingsTargetRecord(params),
      }),
      get_spending_insights: tool({
        description:
          "Get the user's spending habits: spending by category (last 3 months), recurring expenses/subscriptions, and flagged items with no recent activity. Use when the user asks how to cut spending, reduce expenses, or save money.",
        inputSchema: z.object({}),
        execute: async () => getSpendingInsights(),
      }),
      create_budget_goal: tool({
        description:
          "Add a smart budget goal (spending cap) on the user's dashboard. Use ONLY after the user confirms they want to add it. Requires category, monthly target, and rationale from get_spending_insights data.",
        inputSchema: z.object({
          category: z.string().describe("Plaid category code, e.g. FOOD_AND_DRINK"),
          categoryLabel: z.string().describe("Human-friendly label, e.g. Dining & restaurants"),
          targetType: z.enum(["cap", "percent_reduction", "savings"]).describe("Use 'cap' for monthly spending limit"),
          monthlyTarget: z.number().positive().describe("Target monthly spend in dollars"),
          baselineMonthlySpend: z.number().positive().describe("User's current monthly average for this category"),
          rationale: z.string().max(300).describe("1-2 sentence explanation of the goal"),
        }),
        execute: async (params) => createSingleBudgetGoal(params),
      }),
      get_account_balances: tool({
        description:
          "Get current balances for all linked bank accounts (checking, savings, credit, investment). Returns totalAssets, totalLiabilities, and netWorth. Use in Savings Goal Mode to determine how much the user already has saved so the projection accounts for their current balance.",
        inputSchema: z.object({}),
        execute: async () => getAccountBalances(),
      }),
      get_recurring_expenses: tool({
        description:
          "List all recurring expenses (subscriptions, bills) with their monthly total. Use in Savings Goal Mode to check whether the required monthly savings is feasible given the user's fixed costs.",
        inputSchema: z.object({}),
        execute: async () => getRecurringExpenses(),
      }),
    },
    stopWhen: stepCountIs(16),
    abortSignal: AbortSignal.timeout(120_000),
    onError: ({ error }) => {
      console.error("[budget-planner-agent] Stream error:", error);
    },
  });
}
