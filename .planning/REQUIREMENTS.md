# Requirements: Financial Dashboard AI Agent & Reports

**Defined:** 2026-02-13
**Core Value:** The AI agent must answer financial questions accurately by querying real data — never hallucinate numbers, never expose credentials, never modify data.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Security

- [ ] **SEC-01**: Agent endpoints are protected by existing auth middleware (no unauthenticated access)
- [ ] **SEC-02**: Agent tools execute read-only SELECT queries (no INSERT/UPDATE/DELETE)
- [ ] **SEC-03**: Agent tool results never include Plaid access tokens or encrypted blobs
- [ ] **SEC-04**: Gemini API key is server-side only (never sent to client)
- [ ] **SEC-05**: Agent has iteration cap to prevent unbounded ReAct loops (cost/DoS protection)
- [ ] **SEC-06**: Agent input is validated and sanitized before processing

### Agent Core

- [ ] **AGNT-01**: ReAct executor powered by Gemini 2.5 Flash Lite via Vercel AI SDK v6
- [ ] **AGNT-02**: Agent streams responses token-by-token to the client
- [ ] **AGNT-03**: Agent maintains conversation context within a session (client-side memory)
- [ ] **AGNT-04**: Agent shows reasoning steps in responses ("I checked your transactions...")
- [ ] **AGNT-05**: Agent returns plain English error messages when it cannot answer a query
- [ ] **AGNT-06**: Agent never fabricates financial numbers — all numeric claims grounded through tool calls
- [ ] **AGNT-07**: System prompt instructs agent to refuse financial advice and stay within data-query scope

### Agent Tools

- [ ] **TOOL-01**: Spending summary tool — query total spending by category and date range
- [ ] **TOOL-02**: Account balance tool — query current balances across all linked accounts
- [ ] **TOOL-03**: Transaction search tool — find transactions by merchant name, keyword, or date range
- [ ] **TOOL-04**: Trend comparison tool — compare spending across two time periods with directional language
- [ ] **TOOL-05**: Recurring expenses tool — list detected recurring transactions and amounts

### Chat Interface

- [ ] **CHAT-01**: Chat widget embedded in the dashboard UI (collapsible panel)
- [ ] **CHAT-02**: Chat displays streaming text as tokens arrive
- [ ] **CHAT-03**: Chat shows tool call activity (reasoning transparency)
- [ ] **CHAT-04**: Chat preserves conversation history within the session
- [ ] **CHAT-05**: Chat input validates and handles empty/oversized messages gracefully

### PDF Reports

- [ ] **PDF-01**: User can generate a PDF report for a selected date range via dashboard button
- [ ] **PDF-02**: PDF report includes spending breakdown by category with totals
- [ ] **PDF-03**: PDF report includes AI-generated trend summary narrative
- [ ] **PDF-04**: PDF report includes anomaly highlights (unusual charges)
- [ ] **PDF-05**: User can request a PDF report via the chat agent ("Give me a report for January")
- [ ] **PDF-06**: PDF is generated server-side and downloaded to client (no files written to public/)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Showcase

- **SHOW-01**: Mock mode with realistic AI responses for GitHub demo (no Plaid/DB required)
- **SHOW-02**: Mock mode uses separate system prompt to avoid referencing real data framing

### Enhancements

- **ENH-01**: Persistent conversation history across sessions (DB-backed)
- **ENH-02**: Configurable thinking budget for Gemini model (latency vs quality)
- **ENH-03**: Net worth history chart data via agent query

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Financial advice ("Should I invest?") | Fiduciary licensing requirements; CFPB flagged chatbot advice as risk |
| Write operations (move money, set budgets) | Attack surface — prompt injection could trigger writes; read-only is safer |
| Multi-user support | Single-user personal dashboard |
| Real-time push notifications/alerts | Weekly use pattern doesn't justify background job infrastructure |
| Voice input | Browser speech API unreliable; text chat covers the use case |
| CSV export from chat | Dashboard already has transaction views; avoid duplicate functionality |
| Cross-session memory | PII storage concerns; weekly use makes persistence low-value |
| OAuth/social login | Password auth sufficient for single user |
| Mobile app | Web-only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| SEC-04 | Phase 1 | Complete |
| SEC-05 | Phase 1 | Complete |
| SEC-06 | Phase 1 | Complete |
| AGNT-01 | Phase 2 | Pending |
| AGNT-02 | Phase 2 | Pending |
| AGNT-03 | Phase 3 | Pending |
| AGNT-04 | Phase 3 | Pending |
| AGNT-05 | Phase 2 | Pending |
| AGNT-06 | Phase 2 | Pending |
| AGNT-07 | Phase 2 | Pending |
| TOOL-01 | Phase 1 | Complete |
| TOOL-02 | Phase 1 | Complete |
| TOOL-03 | Phase 1 | Complete |
| TOOL-04 | Phase 1 | Complete |
| TOOL-05 | Phase 1 | Complete |
| CHAT-01 | Phase 3 | Pending |
| CHAT-02 | Phase 3 | Pending |
| CHAT-03 | Phase 3 | Pending |
| CHAT-04 | Phase 3 | Pending |
| CHAT-05 | Phase 3 | Pending |
| PDF-01 | Phase 4 | Pending |
| PDF-02 | Phase 4 | Pending |
| PDF-03 | Phase 4 | Pending |
| PDF-04 | Phase 4 | Pending |
| PDF-05 | Phase 4 | Pending |
| PDF-06 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-02-13*
*Last updated: 2026-02-13 after Phase 1 completion*
