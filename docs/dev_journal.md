# Engineering Development Journal
> Chronological log of architecture decisions, implementation pivots,
> constraint discoveries, verification results, and engineering milestones.

---

<!-- SESSION: 2026-06-21 02:05 | security audit -->

### [CP-TESTING] | 2026-06-21: Repository Security Audit Completed

**Summary:** Completed a repository-wide Codex Security audit for PowerHour and produced a finalized scan report with one high-severity finding and four medium-severity findings. The audit focused on finance-data boundaries, Plaid integration, AI-tool egress, deployment controls, and production dependency exposure.

**Files/Modules Affected:** `app/api/plaid/exchange-token/route.ts`, `lib/plaid/link.ts`, `lib/plaid/webhooks.ts`, `app/api/auth/login/route.ts`, `proxy.ts`, `lib/agent/budget-planner-agent.ts`, `package-lock.json`.

**Key Trade-off:** The scan promoted only findings with concrete source-to-sink evidence and suppressed broader hardening observations where the exploit path depended on configuration-only or future multi-user assumptions.

**Evidence:** Codex Security scan `8c57f103-8c91-4c4b-b3b9-562c5fd68ac5` completed successfully with report, SARIF, coverage, manifest, validation, and attack-path artifacts. A live `npm audit --omit=dev --json` confirmed the production `form-data@4.0.5` advisory through the Plaid dependency chain.

**Follow-ups:** Patch the five reported findings, starting with safe Plaid token-exchange response projection and the `form-data` dependency update, then rerun the security scan and production audit.

---

### [CP-MILESTONE] | 2026-06-21: Security Findings Remediated

**Summary:** Implemented the remediation plan for the five confirmed security audit findings. Plaid token exchange now returns a safe institution projection, Plaid webhook verification rejects stale or non-ES256 webhooks, rate limits use a shared trusted-client-IP helper with nginx overwriting forwarded headers, the budget planner blocks web search after private finance tools are used, and dependency advisories were cleared.

**Files/Modules Affected:** `lib/plaid/link.ts`, `app/api/plaid/exchange-token/route.ts`, `lib/plaid/webhooks.ts`, `lib/auth/client-ip.ts`, `app/api/auth/login/route.ts`, `proxy.ts`, `app/api/ai/*`, `lib/agent/budget-planner-agent.ts`, `docker/nginx/nginx.conf`, `package.json`, `package-lock.json`, security regression tests.

**Key Trade-off:** Kept each fix at the narrow security boundary instead of broad refactors: response projection at Plaid serialization, replay checks inside webhook verification, one helper for rate-limit identity, and deterministic agent-tool policy rather than prompt-only AI instructions.

**Evidence:** `npm audit` returned zero vulnerabilities; `npm ls form-data esbuild` showed `form-data@4.0.6` and `esbuild@0.28.1`; `npx tsc --noEmit`, `npm run lint`, focused security tests, full `npm test`, and `docker compose -f docker/docker-compose.yml config` all completed successfully.

**Follow-ups:** Rerun a scoped Codex Security validation scan against the original five findings after the broader dirty worktree is ready for final review.

---

<!-- SESSION: 2026-06-21 20:05 | ci/cd pipeline -->

### [CP-INTEGRATION] | 2026-06-21: GitHub Actions CI/CD Pipeline Hardened

**Summary:** Added a robust GitHub Actions pipeline that gates pull requests and releases with app checks, dependency audit, Compose validation, Docker image build, and release publishing. The release path now preflights the app before publishing multi-architecture GHCR images, GitHub release assets, and container provenance attestations.

**Files/Modules Affected:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/dependabot.yml`, `package.json`, `.github/PULL_REQUEST_TEMPLATE.md`, `README.md`, `CONTRIBUTING.md`.

**Key Trade-off:** Kept CI broad enough to catch application, supply-chain, and deployment regressions while avoiding secrets-dependent integration tests; Compose validation uses CI-safe placeholder environment values instead of production credentials.

**Evidence:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`, Ruby YAML parsing for the workflow/dependabot files, and Compose config validation all completed successfully. Local `docker build` could not be completed because the Docker daemon was not running in this desktop session.

**Follow-ups:** Verify the first GitHub-hosted workflow run, especially the Docker Buildx path and release attestation upload, because those require GitHub runner and registry capabilities unavailable locally.

---

<!-- SESSION: 2026-06-22 14:44 | demo screenshot CSS regression -->

### [CP-DEBUG] | 2026-06-22: Tailwind v4 Utility Layer Restored

**Summary:** Fixed a CSS regression where demo-mode pages loaded theme colors but missed core Tailwind utilities such as spacing, max-width, typography scale, grid gaps, and responsive desktop navigation. The root cause was the old split `@tailwind base/components/utilities` entrypoint under the Tailwind v4 PostCSS plugin; switching `app/globals.css` to `@import "tailwindcss";` restored the default theme utility layer.

**Files/Modules Affected:** `app/globals.css`, `public/marketing/screenshots/`.

**Key Trade-off:** Kept the fix at the Tailwind entrypoint instead of rewriting component classes, because browser CSS inspection showed the components were emitting the right utility class names but the compiled stylesheet lacked the corresponding rules.

**Evidence:** Browser CSS probe confirmed `max-w-6xl`, `md:flex`, `p-6`, `py-10`, `text-2xl`, and `text-3xl` appeared after the patch; computed layout returned to centered `1152px` containers and desktop nav. `DEMO_MODE=true NEXT_PUBLIC_DEMO_MODE=true npm run build` completed successfully.

**Follow-ups:** The dev overlay still reports a dark-theme hydration mismatch from the client theme script toggling `html.dark`; address separately before using dev-server screenshots as final marketing assets.

> **[CROSS-LOG]** Product impact logged in `./docs/product_insights.md`
> — see [PI-TRUST] | 2026-06-22: Broken CSS Undermines Demo Credibility.

---

<!-- SESSION: 2026-08-19 | Remotion promo video + brand font recovery -->

### [CP-DEBUG] | 2026-08-19: Remotion Promo Video — Two Silent-Failure Bugs

**Summary:** Scaffolded a standalone Remotion project (`../powerhour-promo`, sibling repo) for a 10s brand promo that reuses the app's real chart types and a vectorized wordmark cut from the brand typeface. Hit two unrelated bugs that both fail silently (no thrown error, wrong visual output) rather than crashing, which made them slow to isolate.

**Files/Modules Affected:** `powerhour-promo/scripts/extract-logo-path.mjs`, `powerhour-promo/src/fonts.ts`, `powerhour-promo/src/Root.tsx`, `powerhour-promo/package.json` (n/a — bug was in the scaffold default, not edited).

**Key Trade-off:**
- **opentype.js NaN bug:** `font.getPath(text, x, y, size)` on the full string occasionally emits a literal `"NaN"` coordinate into the SVG path data for certain glyphs at certain non-round `x` translate values (e.g. `836.4000000000001` from repeated float addition breaks a curve computation; `836.4` doesn't). Worked around by building the wordmark glyph-by-glyph with `glyph.getPath()` and rounding the cursor position to 2 decimals before each call, rather than patching opentype.js itself.
- **Tree-shaken font loader:** `@remotion/fonts`'s `loadFont()` never ran in the actual bundle — `document.fonts` never contained the custom families, and text silently fell back to the browser default serif, with no console error. Root cause: the create-video scaffold's `package.json` ships `"sideEffects": ["*.css"]`, which tells the bundler every non-CSS file is side-effect-free; `import "./fonts"` (a bare side-effect import) was tree-shaken out entirely. Fixed by exporting `loadBrandFonts()` and calling it explicitly from `Root.tsx` instead of relying on a bare import.

**Evidence:** Confirmed via `document.fonts` in a live Studio tab (chrome devtools eval) — empty before the fix, `PPKyoto`/`PPMori` both `status: "loaded"` after. Confirmed the tree-shaking specifically by grepping the built `bundle.js` for the string `loadFont`, which was absent before the fix and present after. Rendered stills at four beats (`remotion still Promo --frame=N`) before/after to visually confirm.

**Follow-ups:** Full 300-frame render not yet requested by user (per policy, only render when explicitly asked). `powerhour-promo` is its own git repo (only the initial scaffold commit exists; everything built this session — fonts, scenes, extraction script — is uncommitted) with the PP Kyoto/PP Mori `.otf` files present locally under `public/fonts/` for glyph extraction. Those fonts are commercial (Pangram Pangram) and the main `powerhour` repo is mid-cleanup to strip them for licensing reasons, so this sibling repo must stay local/unpushed, and any future commit there should not be pushed to a remote.

---

### [CP-PIVOT] | 2026-08-19: Remotion Promo — Caption-Leads Choreography via `<Sequence>`

**Summary:** Iterated the `powerhour-promo` video (see prior entry) through two rounds: standalone marketing-copy title cards → light captions embedded directly on each feature scene → captions pinned to the top that load in immediately, with the feature content delayed to visibly "roll in" underneath. Total runtime grew 10s → 13.6s → 20s across the rounds as the choreography needed more room; the first chart (`LineReveal`) got the largest single allocation (140 frames) per explicit ask, plus month-axis labels and an end-value marker for readability.

**Files/Modules Affected:** `powerhour-promo/src/scenes/{Hero,LineReveal,ChartMontage,AgentTooling,CardsSnap,SceneCaption}.tsx`, `powerhour-promo/src/theme.ts`, `powerhour-promo/src/Promo.tsx`.

**Key Trade-off:** Used Remotion's `<Sequence from={CONTENT_DELAY_FRAMES} layout="none">` to delay a scene's content clock rather than manually adding an offset to every `interpolate`/`spring` call in every scene — far less error-prone and keeps each scene's internal timings self-documenting. The catch: `<Sequence>` only reshifts `useCurrentFrame()` calls made *inside* its subtree. `Hero`, `AgentTooling`, and `CardsSnap` originally computed their animation values in the top-level scene component itself (not a child), so wrapping their JSX in `<Sequence>` silently did nothing — had to first extract that logic into a dedicated child component (`HeroContent`, `AgentPanelContent`, `CardsRow`) so it would pick up the delayed clock. `ChartMontage` didn't need this because its sub-pieces (`Donut`, `SparklineGrid`, `Heatmap`) already called `useCurrentFrame()` themselves.

**Evidence:** Rendered a still at the scene-local frame before the content delay elapses (e.g. frame 8 of `Hero`, delay=18) — only the caption is visible, confirming true "text first." A later still (frame 42) shows the number/badges fully rolled in underneath. Repeated for all five feature scenes; `tsc --noEmit` and `eslint` clean throughout.

**Open Questions / Follow-ups:** None identified — still no MP4 rendered per the render-only-on-request policy.

---

### [CP-DEBUG] | 2026-08-19: Boomerang Loop Export — ffmpeg concat Demuxer Silently Dropped Half the Frames

**Summary:** Added `powerhour-promo/scripts/render-scene-loops.sh`, which renders each individually-registered scene composition (Hero, LineReveal, ChartMontage, AgentTooling, CardsSnap, Convergence, LogoSting) to MP4, reverses it, and concatenates forward+reverse into one boomerang clip per scene — output to `out/scene-loops/` (gitignored) for embedding as seamless loops in a writeup. End state = start state (same frame, just played backward), so `<video loop>`/GIF playback has no jump-cut.

**Files/Modules Affected:** `powerhour-promo/scripts/render-scene-loops.sh`, `powerhour-promo/out/scene-loops/*.mp4` (generated, not committed).

**Key Trade-off:** Two ffmpeg pitfalls, both silent (no error, wrong output):
- Remotion's bundled `npx remotion ffmpeg` is a trimmed build (`--disable-filters` with an explicit allowlist) that doesn't include the `reverse` filter — used the full system ffmpeg for the reverse/concat steps instead, keeping `npx remotion render` for the actual composition render.
- The ffmpeg **concat demuxer** (file-list + `-f concat`), even with an explicit re-encode (`-c:v libx264`), spliced the two independently-encoded (both 0-based-timestamp) clips and silently dropped ~half the total frames (`dup=0 drop=86` in the log, for a 170-frame expected output that came out as 85). Switched to the **concat filter** (`-filter_complex "[0:v:0][1:v:0]concat=n=2:v=1:a=0[outv]"`), which operates on decoded frames directly and has no PTS-splicing ambiguity — correct frame count on the first try.

**Evidence:** `ffprobe -count_frames` on every output file confirms exactly 2× the source scene's frame count (e.g. Hero 85→170, LineReveal 132→264). Extracted first and last frame of `Hero-loop.mp4` and diffed them with PIL — max channel delta of 8/255 (lossy-encode noise only, visually identical), confirming the loop point is seamless.

**Follow-ups:** None identified. This is a one-off export script run on request, not part of the `Promo` composition or its render pipeline.

---

### [CP-PIVOT] | 2026-08-19: Scene Loops Rebuilt as Remotion Compositions (Freeze + Fade), Not ffmpeg Reverse

**Summary:** Replaced the ffmpeg-reverse approach to `powerhour-promo`'s scene loops (previous entry) with a Remotion-native one, after feedback that the reverse pass shouldn't replay each scene's staggered "micro load-in" choreography (chart panels, tool chips, cards) backward — only a plain fade should undo it. New `src/loops/Loop.tsx`: play the scene forward once, then hold on `<Freeze frame={duration-1}>` of it and fade that frozen copy's opacity 1→0, with a permanent `<Freeze frame={0}>` of the same scene sitting underneath as the base layer. Every scene here already renders "blank" at its own frame 0 (all entrances animate in from opacity/scale 0), so fading the settled last frame away reveals exactly the frame-0 base — seamless loop point, zero reverse motion. Registered as a `Scene-Loops` Folder in `Root.tsx`, one composition per scene (`Hero-Loop`, `LineReveal-Loop`, etc.), each just wrapping the live scene component so future style/timing edits apply for free — nothing duplicated.

**Files/Modules Affected:** `powerhour-promo/src/loops/Loop.tsx` (new), `powerhour-promo/src/loops/LoopScenes.tsx` (new), `powerhour-promo/src/Root.tsx`.

**Key Trade-off:** Deleted the stale `out/scene-loops/*.mp4` files from the ffmpeg-reverse approach (they both used the old styling and the now-rejected full-reverse behavior) and left `scripts/render-scene-loops.sh` in place but superseded — nothing currently calls it. Did not render the new loop compositions to MP4 per this session's instruction ("apply the style changes... but do not render them into mp4"); verified correctness via `remotion still` only (frame before/mid/after the fade, confirming a uniform whole-scene dim with no panel-by-panel reverse).

**Evidence:** Stills at the fade's start/mid/end frames for both `Hero-Loop` and the more complex `ChartMontage-Loop` (3 staggered panels) show a uniform opacity dim across all content simultaneously — no independent reverse-animation of any element. `tsc --noEmit` and `eslint` clean.

**Follow-ups:** Render the loop MP4s when actually requested — no script changes needed, `npx remotion render <Scene>-Loop out.mp4` per composition is sufficient now that the reverse logic lives in the composition itself.

---

<!-- SESSION: 2026-09-04 | enterprise testing foundation -->

### [CP-TESTING] | 2026-09-04: Risk-Based Test Suite and CI Evidence

**Summary:** Added a layered test foundation: full-source V8 coverage, targeted coverage gates for encryption and savings calculations, a dedicated PostgreSQL integration harness, and a deterministic demo-mode Playwright smoke test. CI and release preflight now migrate a disposable `powerhour_test` database, run the test layers, and retain coverage plus browser-test evidence.

**Files/Modules Affected:** `package.json`, `vitest.config.ts`, `playwright.config.ts`, `tests/integration/database.test.ts`, `e2e/demo-smoke.spec.ts`, `lib/__tests__/crypto.test.ts`, `lib/__tests__/savings-projections.test.ts`, `app/(auth)/login/__tests__/page.test.tsx`, `.github/workflows/{ci,release}.yml`, `docs/TESTING.md`.

**Key Trade-off:** Used full-source reporting with narrowly scoped 100%/near-100% gates for newly covered high-risk modules instead of imposing an arbitrary global threshold on the existing 10.04% baseline. The integration harness rejects any database whose name does not end in `_test`, prioritizing protection from accidental data truncation over convenience.

**Evidence:** `npm test` passed 59 tests (3 database tests safely skipped without `TEST_DATABASE_URL`); `npm run test:coverage` passed the critical-module gates and produced the baseline; lint, TypeScript, workflow YAML validation, Playwright discovery, and a production build all passed. Local Docker was unavailable, so the PostgreSQL and Chromium execution paths are configured for GitHub-hosted CI but not run locally.

**Follow-ups:** Verify the first GitHub Actions run to exercise the real PostgreSQL and Chromium paths; then add no-regression coverage policy and expand critical-path gates to auth, webhook/sync, and money/date modules.

---

### [CP-CONSTRAINT] | 2026-09-04: Production Audit Gate Unblocked

**Summary:** The repository's existing production dependency audit reported five high-severity findings before the new CI path could be considered healthy. Applied the package manager's semver-compatible production fixes, resolving the audit at the lockfile level and updating the installed Next.js runtime to 16.3.4 alongside patched Axios, Nanoid, PostCSS, and Sharp transitive dependencies.

**Files/Modules Affected:** `package-lock.json`, local dependency tree.

**Key Trade-off:** Accepted a Next.js minor-version lockfile update because `npm audit fix --omit=dev --dry-run` showed an available non-breaking-range remedy and because the alternative was a permanently failing production audit gate. Avoided an unbounded `npm audit fix` that could modify development tooling unnecessarily.

**Evidence:** `npm audit --omit=dev --audit-level=high --offline` reports 0 vulnerabilities; the full Vitest suite, coverage gates, lint, TypeScript, Playwright discovery, and Next.js 16.3.4 production build passed after the update.

**Follow-ups:** The full development dependency audit still reports three high-severity findings; triage those separately from the production release gate.

---

<!-- SESSION: 2026-09-12 | release-preparation commit split -->

### [CP-INTEGRATION] | 2026-09-12: Release Preparation Pipeline and Commit Boundaries

**Summary:** Organized the release-preparation work into compatibility, privacy, testing, deployment, CI/release, and marketing slices instead of one monolithic commit. Added a local `AGENTS.md` delivery checklist covering lint, typecheck, tests, coverage, build, audit, and conditional browser/container checks.

**Files/Modules Affected:** `AGENTS.md` (local ignored guidance), `.gitignore`, `proxy.ts` review, `app/(dashboard)/transactions/groups/[id]/page.tsx`, and the staged Next.js/tooling compatibility slice.

**Key Trade-off:** Kept local agent guidance ignored per repository policy, while preserving the tracked engineering journal. Did not push or create a remote release; commits remain a deliberate local checkpoint until the host permits Git commit writes.

**Evidence:** `npm run lint`, `npm run typecheck`, `npm test` (59 passed, 3 database tests skipped), `npm run test:coverage`, `npm audit --omit=dev --audit-level=high`, and `npm run build -- --webpack` passed. Default Turbopack build and Playwright E2E could not bind localhost ports in this desktop environment. Next 16 proxy behavior was checked against the official migration guidance.

**Follow-ups:** Create the remaining logical local commits, then ask explicitly before pushing to `origin/codex/docker-deployment-v1`; verify PostgreSQL, Chromium, Docker, and default Turbopack paths on CI.

---

<!-- SESSION: 2026-09-27 | repository branch alignment -->

### [CP-REFACTOR] | 2026-09-27: Release Branch Hierarchy Aligned

**Summary:** Reorganized local branch pointers into the intended working-branch → `dev` → `stable` → `main` flow while preserving all prior commits and active release-preparation changes. `main` and `stable` now reference the published release baseline; `dev` retains the local integration history; the audit remediation is carried by a focused working branch.

**Files/Modules Affected:** Git refs; release-preparation files retained in the working tree.

**Key Trade-off:** Preserved the legacy branch until remote verification and replacement are complete rather than deleting a potentially shared reference early. Used the webpack production build as the validation evidence because Turbopack cannot bind its required local port in this environment.

**Evidence:** Lint, typecheck, unit tests, coverage, production audit, webpack build, and Chromium smoke test completed. The default Turbopack build remains environment-blocked; disposable database tests remain skipped without a test database URL.

**Follow-ups:** Create a local preservation checkpoint, push the hierarchy, then remove the obsolete remote branch after confirming the new refs are present.

---
