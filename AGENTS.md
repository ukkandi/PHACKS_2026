# AGENTS.md — Lantern (Patriot HackFest Fall 2026, "Life Underground" track)

> Shared instructions for ALL coding agents (Claude Code, Codex). CLAUDE.md imports this file.
> "Lantern" is a working name — rename freely.

## Hard constraints (hackathon rules)
- **Deadline: Fri Nov 20, 2026, 11:00 PM ET. No extensions.** Code freeze ~6 PM to leave time for submission.
- No coding during judging (Nov 21–24).
- Everything is a **demo of a fictional world**. All data is simulated. Never pretend a feature works if it is mocked — label simulated parts clearly in code (`// SIMULATED:`).
- Prefer a **working end-to-end demo flow** over breadth. If a feature threatens the deadline, cut it.

## The world (context for UX copy and data)
In 2087 humanity lives underground in "the Hollow": 2 billion people in stacked levels. Upper levels get light and air; deep levels are hotter, darker, sicker, and hit by blackouts first. The **Directorate** (government) controls air, network, and movement, and its public numbers don't match reality. Power is scarce (aging geothermal), water is recycled, light is a paid utility.

## What we're building
A **community-owned, offline-first wellbeing network built around one daily check-in.**
- Useful to **one person on day 1**; gets more powerful as more people join.
- Reachable via **phones, shared level terminals, and human "wardens"** (for people without devices).
- Publishes **anonymous, aggregated, verifiable data** so the Directorate is visible and accountable — but it **cannot shut it down or trace individuals**.
- Runs on existing devices: no new hardware, minimal power, no dependency on the Directorate network.

### Problems covered (from the track brief)
#1 blackout warnings · #2 fair allocation · #3 heat · #4 bad water · #7 organizing without the network · #8 reconnecting families · #9 real outbreak tracking · #10 care triage · #11 sleep/mood/sunlight effects

## Core design principles
1. **One primary action:** the daily check-in ("I'm okay · mood 1–5 · sleep · symptoms · water OK?"). Everything else is derived from it in the background.
2. **Privacy by design:** personal data stays on-device (IndexedDB). Only anonymous level-level aggregates are shared. Directorate view never sees individuals.
3. **Offline-first:** app must work with no "network". Peer-to-peer sync is simulated across browser tabs (each tab = a device) via `BroadcastChannel`.
4. **Low-cost:** text-first UI, dark theme (saves power on OLED, fits setting), no heavy assets.
5. **Accessible:** large tap targets, high contrast, works with keyboard only; terminal mode is shared-device friendly.
6. **Trust:** reports gain confidence via multiple nearby confirmations or warden verification; anomalous spikes are flagged.

## Access points / views (one codebase, route per view)
| Route | Who | Purpose |
|---|---|---|
| `/resident` | Resident on a phone | Check-in, family status, warnings, personal sleep/mood trend |
| `/terminal` | Shared level terminal | Big-button check-in by unit number, no account, auto-clears after use |
| `/warden` | Block warden | Check in on behalf of others, verify reports, relay messages |
| `/ledger` | Public (everyone) | Anonymous per-level map: blackout risk, outbreak, water, mood, allocation recommendation vs. what the Directorate actually did |
| `/directorate` | Directorate (read-only) | Same aggregates as the public — transparency without control |
| `/sim` | Demo operator | Control panel to drive the scenario (trigger blackout, contaminate water, spike symptoms, add users) |

## Tech stack
- **Vite + React + TypeScript (strict)**, Tailwind CSS
- State: Zustand · Local storage: Dexie (IndexedDB)
- P2P simulation: `BroadcastChannel` between tabs; message-gossip with hop counts
- Charts: Recharts (or plain SVG for the level map)
- PWA (installable, offline) via `vite-plugin-pwa`
- **No backend required.** Deploy as a static site (Vercel/Netlify/GitHub Pages).

## Simulation engine (`src/sim/`)
- Seeded, deterministic world: ~40 levels, each with population, power load, temperature, water quality, air quality.
- Tick-based (e.g., 1 tick = 1 simulated hour, adjustable speed).
- **Blackout predictor:** simple model on power load trend + temperature (moving average / threshold, optional linear regression). Output: risk % and hours-until-likely-failure per level.
- **Outbreak detector:** symptom check-ins per level vs. baseline → flag when above threshold; compare against a deliberately under-reported "Directorate official number".
- **Allocation engine:** given limited power/water/food, allocate by published, community-set priorities (e.g., air > water > cooling > light), weighted by need. Show recommendation and reasoning in plain language.
- Synthetic residents generate check-ins so the ledger looks alive.

## The demo flow (MUST work end-to-end — build this first)
1. Open `/resident` in 2–3 tabs (= family members on different levels) + `/ledger` + `/sim`.
2. Residents check in; family panel shows everyone "okay".
3. In `/sim`, Level 38 power load climbs → **blackout warning** reaches Level 38 residents hours ahead.
4. Blackout hits; "network" for Level 38 drops → messages still arrive via peer hops between tabs.
5. Symptom check-ins spike on deep levels → **outbreak flagged** on ledger, next to the lower Directorate figure.
6. Allocation engine recommends rerouting power to Level 38 air pumps; ledger shows recommendation vs. Directorate action.
7. Warden checks in an elderly resident with no device; terminal check-in shown.

## Build phases
- **Phase 1 (Sun–Mon):** scaffold, routes, sim engine + `/sim` panel, `/resident` check-in with Dexie.
- **Phase 2 (Tue):** BroadcastChannel P2P + family status, blackout predictor + warnings.
- **Phase 3 (Wed):** `/ledger` level map, outbreak detection, allocation engine, `/directorate` view.
- **Phase 4 (Thu):** `/terminal`, `/warden`, trust/verification, mood/sleep trends, accessibility pass.
- **Phase 5 (Fri):** polish, bug fixes, deploy, record demo video, write submission. **Freeze by 6 PM.**

## Coding conventions
- TypeScript strict; no `any` unless justified in a comment.
- Small, focused components; domain logic in `src/sim/` and `src/lib/`, not in components.
- Pure functions for predictors/allocation so they're easy to test (Vitest for these only).
- Commit after every working step with a clear message.
- Don't add dependencies without a reason; keep bundle small.
- UI copy should feel in-world (e.g., "Level 38", "Directorate", "Warden") but stay clear and plain.

## Agent workflow
- Work one phase at a time; confirm the app runs (`npm run dev`) before moving on.
- Before large changes, state the plan in a few bullets.
- Never break the demo flow. If something regresses, fix it before new features.
- Claude Code = primary builder. Codex = reviewer and small, self-contained tasks. Don't edit the same files concurrently.
