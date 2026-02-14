# Feature Research

**Domain:** AI Financial Assistant Agent (personal finance chat + PDF reports)
**Researched:** 2026-02-13
**Confidence:** MEDIUM — Table stakes and differentiators grounded in competitor analysis (Copilot Money, Monarch Money) and pattern research. Anti-features verified against CFPB and multiple independent sources. Complexity ratings based on the existing brownfield codebase.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Natural language spending queries | Every modern AI finance app (Copilot, Monarch) provides this; users expect to ask "how much did I spend on food last month?" and get a number, not a prompt | LOW | Agent tools already scoped: `get_spending_summary(range)` + category filter. Complexity is in prompt engineering, not infrastructure. |
| Balance and net worth queries | "What's my checking balance?" is the most basic financial question; missing this makes the agent feel broken | LOW | Existing `accounts` table has this. Thin tool wrapper. |
| Transaction search by keyword/merchant | "Show me Amazon charges last month" is a pattern Copilot's AI chatbot explicitly supports; users expect it | MEDIUM | Requires the agent to construct a parameterized `query_db` call with merchant filter + date range. Prompt needs to handle ambiguous merchant names (e.g., "Amazon" vs "AMZN"). |
| Streaming responses (token-by-token) | Users abandon chat interfaces with loading spinners; token streaming is the baseline UX expectation set by ChatGPT and every modern LLM product | MEDIUM | Gemini 2.5 Flash Lite supports streaming. Requires SSE or ReadableStream API route + frontend consumer. |
| Conversation context within a session | Follow-up questions ("what about last year?", "and dining out?") require the agent to remember prior turns; without this it's not a conversation, it's a stateless search box | MEDIUM | Scoped as client-side session memory — conversation history passed as context array to the model each turn. No server-side storage needed. |
| Error handling with plain English fallback | When the agent can't answer (ambiguous query, missing data), users expect a helpful "I couldn't find that" not a raw stack trace or JSON error | LOW | Requires explicit error handling in the ReAct executor and graceful LLM-level fallback prompting. |
| Accurate numbers (never hallucinate) | In a finance context, a wrong number (even by a small amount) destroys trust immediately and permanently. Hallucination rates in financial AI average 2.1-13.8% across models | HIGH | This is the hardest table stakes item. Prevention: agent MUST query real DB tools for any numeric claim; it must never synthesize numbers from training knowledge. The ReAct pattern handles this by forcing tool calls before answering. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| PDF report generation with AI narrative | Most personal finance apps export raw data CSVs; a PDF with an AI-written "your biggest spending shift this month was X" narrative is rare and compelling — especially as a GitHub portfolio showcase | HIGH | Two-phase: (1) AI generates narrative from DB summary data, (2) PDF renderer (Puppeteer or react-pdf) lays it out. The AI narrative must be grounded in queried data, not generated from model priors. |
| Anomaly highlights in PDF reports | Automatically surfacing "unusual charge of $847 at Uber on Jan 15" in a report saves users from having to manually scan transactions | MEDIUM | Requires anomaly detection query — e.g., transactions > 2 standard deviations above category mean for that user. Can be a pre-computed DB view. |
| Trend analysis with directional language | "You're spending 23% more on dining than last quarter" is significantly more actionable than a static number. Copilot offers this but only in a dashboard UI, not via conversational query | MEDIUM | Requires comparison queries across two time ranges. Agent needs a `compare_spending(category, range1, range2)` tool or the ability to call `get_spending_summary` twice and reason over the results. |
| Report generation via chat command | "Give me a PDF for January" triggered from the chat widget is a natural workflow that feels magical when it works. Bridges the chat and report features. | MEDIUM | Requires agent tool that triggers report generation as a side-effect action (not a pure read). Still safe: report generation is read-only from DB perspective, it just writes a file. |
| Transparent reasoning ("I checked your transactions...") | AI finance apps that show their work ("Based on 47 transactions tagged 'restaurants'...") build more trust than opaque answers. Monarch Money surfaces this. | LOW | In the streaming response, include the tool call observation before the final answer. Requires prompt engineering to instruct the model to cite its data source. |
| Mock mode with realistic AI responses | Open-source showcase where recruiters can interact with the AI on fake data without Plaid/DB setup is genuinely rare and dramatically increases GitHub project appeal | MEDIUM | Requires mock fixtures for agent tool responses in addition to existing mock account/transaction data. The agent prompt can remain identical; only the tool return values change. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Personalized financial advice ("Should I invest in index funds?") | Users naturally ask their financial assistant for advice beyond transaction data | Personal financial advice requires fiduciary licensing in most jurisdictions; LLMs give generic advice that feels personalized but ignores crucial individual factors (tax situation, risk tolerance, debt). CFPB has flagged this as a risk in chatbots. Also, Gemini's training data is stale — interest rates, market conditions change. | Scope the agent strictly to data queries. If the user asks an advice question, the agent responds: "I can show you your spending data, but I can't give financial advice. Here's what your data shows: [query result]." |
| Write operations (move money, pay bills, set budgets) | Users ask "can you cancel this subscription?" or "set my dining budget to $300" | Write access turns a read-only tool into an attack surface. A prompt injection in a transaction description could theoretically trigger a write operation. Single-user personal tool doesn't need it. | Keep agent strictly read-only. Budget setting stays in the existing dashboard UI. |
| Persistent cross-session memory | "Remember my goals from last week" feels like a power feature | Requires server-side storage of conversation history, adds DB schema complexity, and creates PII storage questions (conversation logs contain inferred behavioral data). For weekly personal use the value is minimal. | Client-side session memory (in-memory, cleared on close) is sufficient. If users want persistence, they can generate a PDF report as a record. |
| Real-time push notifications and alerts | "Alert me when I overspend on dining" seems like a natural extension of trend analysis | Requires background job infrastructure (cron/queue), push notification service, and significantly changes the deployment architecture. Weekly personal use pattern doesn't justify this complexity. Also creates notification fatigue. | Let the agent surface this on demand: "You're at 89% of your typical dining spend with 8 days left in the month" — user asks, agent answers. |
| Multi-turn agentic planning ("Help me build a savings plan") | Users want the AI to act as a financial planner | Requires multiple tool calls across multiple turns with state management, goal-tracking schema, and advice-giving that crosses into fiduciary territory. Way outside scope of a read-only query agent. | Trend analysis and historical reporting covers 90% of what users actually need. |
| Voice input | Feels futuristic and accessible | Browser speech API reliability is inconsistent. Adds complexity without meaningful benefit for a weekly-use personal tool viewed on desktop. | Text chat covers the use case. Can be added in a future iteration with a single library (Web Speech API) if demand exists. |
| Export to spreadsheet / CSV from chat | "Give me a CSV of my dining transactions" is a reasonable ask | The dashboard already has transaction views; duplicating export functionality in the agent creates two codebases to maintain for the same capability. | Link from chat response to the existing transaction page filtered by the query parameters. "Here's a summary — [view transactions in dashboard]." |

---

## Feature Dependencies

```
[Session memory (client-side)]
    └──required by──> [Trend analysis via chat]
                          └──required by──> [Comparative trend language]

[ReAct agent executor]
    └──required by──> [All query features]
                          └──required by──> [PDF report via chat command]

[Streaming response infrastructure]
    └──required by──> [Chat widget UX]

[Agent DB tools (read-only wrappers)]
    └──required by──> [Spending queries]
    └──required by──> [Balance queries]
    └──required by──> [Transaction search]
    └──required by──> [Trend analysis]

[PDF report generation (base)]
    └──required by──> [AI narrative in PDF]
    └──required by──> [Anomaly highlights in PDF]
    └──required by──> [Report via chat command]

[Anomaly detection query]
    └──enhances──> [PDF anomaly highlights]
    └──enhances──> [Trend analysis via chat]

[Mock mode agent fixtures]
    └──enhances──> [Mock mode showcase]
    └──requires──> [Existing mock transaction/account data]
```

### Dependency Notes

- **ReAct executor requires agent DB tools:** The executor is useless without at least one tool to call. Build tools and executor together in the same phase.
- **Streaming requires a chat widget:** There's no point implementing streaming responses without a frontend widget to render them. Ship together.
- **PDF AI narrative requires PDF base:** The report layout must exist before AI-generated text can be inserted into it. Generate static PDF first, then add AI narrative.
- **Report via chat requires agent executor + PDF base:** This feature is the intersection of two other features. It must come after both are stable.
- **Hallucination prevention is a constraint on all query features:** Every feature that returns a number must be grounded through a tool call. This is an architectural requirement, not a feature to implement separately.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what validates the agent concept and makes the GitHub showcase compelling.

- [ ] ReAct agent executor with streaming — the core loop that makes everything else possible
- [ ] Chat widget in dashboard UI — entry point for users
- [ ] Spending recap queries ("How much did I spend on X in Y?") — most common user question, highest-value tool
- [ ] Balance queries ("What's my checking balance?") — second most expected capability
- [ ] Transaction search by merchant/keyword — third pillar of expected functionality
- [ ] Session memory (client-side, in-memory) — makes it feel like a real conversation
- [ ] Graceful error handling with plain English fallback — prevents trust destruction on edge cases
- [ ] Mock mode agent fixtures — critical for open-source showcase; without this, recruiters can't interact with the AI

### Add After Validation (v1.x)

Features to add once core agent is working and stable.

- [ ] Trend analysis with comparison language — add after spending queries are solid; requires a second tool or compound query
- [ ] PDF report generation (static layout) — can be built in parallel with agent but shipped after v1 agent
- [ ] AI-generated narrative in PDF reports — add after PDF layout is working
- [ ] Anomaly highlights in PDF reports — add alongside AI narrative; requires anomaly detection query

### Future Consideration (v2+)

Features to defer — not worth the complexity at this scale.

- [ ] Report generation via chat command — powerful but requires agent + PDF to both be stable first; defer to v2
- [ ] Transparent reasoning display in UI — good polish item but doesn't change functionality
- [ ] Voice input — V2+ if there's ever demand

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| ReAct executor + streaming | HIGH | MEDIUM | P1 |
| Chat widget | HIGH | MEDIUM | P1 |
| Spending recap queries | HIGH | LOW | P1 |
| Balance queries | HIGH | LOW | P1 |
| Session memory (client-side) | HIGH | LOW | P1 |
| Transaction search | HIGH | MEDIUM | P1 |
| Error handling / fallback | HIGH | LOW | P1 |
| Mock mode agent fixtures | HIGH | LOW | P1 |
| Trend analysis (comparative) | MEDIUM | MEDIUM | P2 |
| PDF report generation (base) | MEDIUM | HIGH | P2 |
| AI narrative in PDF | MEDIUM | MEDIUM | P2 |
| Anomaly highlights in PDF | MEDIUM | MEDIUM | P2 |
| Report generation via chat | MEDIUM | LOW* | P3 |
| Transparent reasoning display | LOW | LOW | P3 |

*Low cost only after agent + PDF are both built.

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Copilot Money | Monarch Money | Our Approach |
|---------|--------------|--------------|--------------|
| Natural language query | Yes — AI chatbot for transactions/budgets | Yes — AI assistant, trend highlights | ReAct agent with DB tools; same capability, no subscription required |
| Spending categorization | AI-powered, learns per user | Yes, AI-assisted | Not building — categories come from Plaid, existing in DB |
| Transaction search via chat | Partially — AI assistant covers it | Not explicitly documented | Full merchant/keyword search as explicit agent tool |
| Trend analysis | Dashboard UI only | AI forecasts, dashboard | Chat-accessible trend comparison; more conversational than competitors |
| Alerts / notifications | Yes — push alerts on overspending | Yes — cash flow alerts | Explicitly excluded; on-demand via chat instead |
| PDF reports | No (CSV export only) | No (PDF not documented) | Differentiator: AI-written narrative PDF is not offered by either |
| Report via chat | No | No | Differentiator — but P3, build last |
| Open source / self-hostable | No — SaaS subscription | No — SaaS subscription | Differentiator: entire project open source, runnable in mock mode |

---

## Sources

- [About Monarch's AI Features — Monarch Money Help](https://help.monarch.com/hc/en-us/articles/16116906962452-About-Monarch-s-AI-Features) — (403 at fetch time; listed in multiple comparison articles)
- [Copilot Money Review 2025 — AICashCaptain](https://aicashcaptain.com/copilot-money-review-2025/) — MEDIUM confidence (WebSearch verified)
- [Copilot vs Monarch vs WalletHub 2026 — WalletHub](https://wallethub.com/edu/b/copilot-vs-monarch-vs-wallethub/148207) — MEDIUM confidence
- [Chatbots in Consumer Finance — CFPB](https://www.consumerfinance.gov/data-research/research-reports/chatbots-in-consumer-finance/chatbots-in-consumer-finance/) — HIGH confidence (official government source on risks)
- [Hidden Dangers of AI Hallucinations in Financial Services — Baytech](https://www.baytechconsulting.com/blog/hidden-dangers-of-ai-hallucinations-in-financial-services) — MEDIUM confidence
- [AI-Based Personal Finance Apps — Jurysoft](https://jurysoft.com/blog/app-development/fintech/ai-based-personal-finance-apps-how-they-work-how-to-build-one/) — LOW confidence (WebSearch only)
- [Finance ReAct Agent with LangGraph — Medium](https://agbonorino.medium.com/finance-react-agent-with-langgraph-6a6553039900) — LOW confidence (single source, pattern reference only)
- [AI UX: Reliable, Resumable Token Streaming — Ably](https://ably.com/blog/token-streaming-for-ai-ux) — MEDIUM confidence
- [LLM Chat History Summarization — mem0.ai](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) — LOW confidence

---
*Feature research for: AI Financial Assistant Agent (chat + PDF reports)*
*Researched: 2026-02-13*
