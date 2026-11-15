# Lantern

Community-owned, offline-first wellbeing network for "the Hollow" (Patriot HackFest Fall 2026, *Life Underground* track).
Fictional world; **all data is simulated**. See `AGENTS.md` for the brief.

```bash
npm install
npm run dev                     # http://localhost:5173
npm test                        # unit tests: sim, predictor, mesh, crypto, ledger, outbreak, allocation, triage
node scripts/demo-check.cjs     # drives the full demo below in a headless browser (needs Playwright + dev server)
```

## Deploy (Netlify)

Everything is in `netlify.toml`: build `npm run build`, publish `dist`, Node 22, SPA fallback so deep links work.

1. Netlify → **Add new site → Import an existing project → GitHub**, authorise, pick **ukkandi/PHACKS_2026**.
2. Branch to deploy: **main**. Leave build settings as detected from `netlify.toml` and click **Deploy**.
3. Optional: **Site configuration → Change site name** (e.g. `lantern-hollow` → `https://lantern-hollow.netlify.app`).

Every push to `main` redeploys. All demo tabs must be on the same site (same origin) to talk to each other.

## Views

| Route | Who | What |
|---|---|---|
| `/resident` | Resident's phone | Daily check-in, family status + messages (encrypted), blackout warnings, own sleep/mood trends |
| `/terminal?level=38` | Shared level terminal | Big-button check-in by unit number, no account, clears itself |
| `/warden?level=38` | Block warden | Care triage, check in people without devices, verify the ledger |
| `/ledger` | Everyone | Anonymous per-level numbers vs the Directorate's official ones; power allocation |
| `/directorate` | Directorate | Exactly the public ledger, read-only |
| `/sim` | **World Simulator — demo only, not part of Lantern** | Drives the fictional world |

Every browser tab is a separate device (own id, own IndexedDB). `?device=<name>` on `/resident` pins an identity.

## Demo script (click by click)

Total time about 6–7 minutes. The simulator clock stays **Paused** throughout; you advance it with **Step +1h**, so every run is the same.

### Before you start (setup, ~1 min)
Use one browser window. If you've run the demo before, open DevTools → Application → Clear site data first.

1. Tab 1: open **`/ledger`**. Open it first so it hears every report.
2. Tab 2: open **`/sim`**. The page says "World Simulator — demo only". Leave Target level on **Level 38**. The ledger now shows **40 / 40** levels reporting.
3. Tabs 3–5: open **`/resident`** three times. Click **Mara · L38**, **Teo · L36**, and **Ilan · L12** respectively.
4. Tab 6: open **`/terminal?level=38`**.
5. Tab 7: open **`/warden?level=38`**.

### 1. Everyone checks in
- In Mara's, Teo's and Ilan's tabs: click **Check in**. (Optionally set mood, sleep or symptoms first.)
- **Show:** Ilan's **Family · ORIN-7** panel shows Mara and Teo as **Okay today**, with the route each status took (`1 hop: L38 ⇢net L12`).

### 2. Blackout warning, hours ahead
- **World Simulator:** click **Power surge**, then **Step +1h** about 4 times, until Mara's tab turns amber.
- **Show Mara:** "**Blackout likely on Level 38 in 8–16 hours**", a **medium confidence** label, and advice. The banner says the warning was predicted on her phone from the level meter; the Directorate announced nothing.
- **Show Ilan:** a **L38 blackout warning** badge next to Mara, and the alert under **Alerts from other levels**. It reached him over the mesh.
- Optional: one or two more **Step +1h** clicks show the window tighten (e.g. 5–9 hours, high confidence).

### 3. Blackout: messages still get through
- **World Simulator:** keep clicking **Step +1h** (about 9 times) until Mara's banner turns red: "**Blackout on Level 38**". The event log says the feeder tripped.
- **Show Mara:** her header now reads **Mesh only · N devices in radio range**.
- **Mara:** click **Power is out here.**
- **Show Ilan:** the message arrives with its route, `2 hops: L38 ⇢radio L36 ⇢net L12`.
- Optional (dramatic): **World Simulator → Directorate network: shut ALL down**, then **Mara → I'm safe.** It reaches Ilan after about 13 radio hops (`L38 ⇢radio L36 ⇢radio L34 …`). Click **Restore Directorate network (all)** afterwards.

### 4. Outbreak vs the official number
- **World Simulator:** click **Symptom spike, levels 34–40**, then **Step +1h** 8 times.
- **Show Ledger → Outbreak watch:** **Level 38 OUTBREAK** shows a Lantern figure of about **14%** with symptoms, "**based on ~157 reports**", next to a **Directorate official** figure of about **6%**, and the line "The official figure is 2.4× lower…". Levels 35, 39 and 40 are flagged too.
- Scroll to **The Hollow, level by level**: every row says how many reports it's based on. Click **L38** to see the sources.

### 5. Allocation: recommendation vs what the Directorate did
- **Show Ledger → Power reserve · 14 MW:**
  - **Lantern recommends** ~3.9 MW to **Level 38 air pumps** first, with the reason in plain words and "Priority #1 (air)".
  - **Directorate actually did:** 2 MW for L38 corridor lighting (acknowledged 4h late, as "planned maintenance"), and the rest to **Levels 1–3 administrative districts**.
  - A low "% of the reserve went where the community's priorities say".
- Optional: reorder the published priorities with ↑/↓ and watch the plan change.
- Optional: **World Simulator → Directorate powers L38 air pumps**. The ledger shows "Level 38 air pumps (emergency line)" and the match % goes up.

### 6. Terminal and warden: people without phones
- **Terminal tab:** tap **2 2 1** → **Next** → **I need help** → **Low** → **Under 5 hours** → **Breathing** → **Next** → **Yes**. The screen says the warden has been told, then clears itself after 8 seconds.
- **Warden tab:** **Mrs. Okafor · 38-221** is top of **Who to visit first**: "asked for help · breathing trouble · vulnerable".
- **Warden:** on **Mr. Brandt** click **Check in for them** → **Submit check-in**. He now shows "via warden".
- **Warden:** in **Verify the ledger · Level 38**, click **Confirm outbreak**.
- **Show Ledger:** Level 38 now carries "**✓ confirmed by warden W-38-…**". Click **L38** in the level table: "Sources: N via level phones, 1 via terminal, 1 via warden".

### 7. Trust: a fake flood is held back
- **World Simulator:** set Target level to **Level 5** and click **Rogue device: inject 300 fake reports on L5**.
- **Show Ledger → Held back (unverified):** the 300 fake reports are *not* counted, and the reason is given. No false outbreak appears.

### 8. The Directorate's view
- Open **`/directorate`**. It's the same numbers, read-only, with a note that Lantern holds no individual data to hand over.

## What is real vs simulated

Real logic, unit-tested and running in the browser:
- **Blackout predictor:** compares each hour's load with the same hour yesterday, and gives a time window with a confidence label.
- **Mesh:** gossip relaying with hop routes, TTL and dedup, plus selective relaying with offline beacons and anonymous origins.
- **Encryption:** AES-GCM for family and care packets.
- **Ledger:** aggregation of anonymous counts, outbreak z-test with a shrunk baseline, and anomaly hold-back.
- **Allocation engine:** shares the reserve by community priorities.
- **Care triage.**
- **Per-device storage:** IndexedDB.

Simulated (marked `// SIMULATED:` in code):
- **The world:** power, heat, air, water, illness (`src/sim/`).
- **The Directorate's bulletin:** deliberately under-reports, acknowledges blackouts late, sends reserve upward (`src/sim/directorate.ts`).
- **"Level phones":** one stand-in device per level, hosted by the World Simulator, relaying traffic and sending synthetic residents' anonymous counts (`src/lib/relays.ts`, `src/sim/standin.ts`).
- **The radio layer:** all tabs share one BroadcastChannel. Links are allowed if both ends have the Directorate net, or if devices are within 2 levels.
- **The care-channel key:** derived from the level number. Production would encrypt to wardens' public keys.
- **Warden badges:** unsigned. Production would sign them.
- **Rogue device:** the fake-report injection is a simulated attack.

## Architecture

| Path | What |
|---|---|
| `src/sim/` | Pure world model, blackout predictor, Directorate bulletin, stand-in reports (+ tests) |
| `src/lib/mesh.ts` | Gossip mesh; packet kinds: `sealed`, `alert`, `summary`, `verify` |
| `src/lib/ledger.ts`, `outbreak.ts`, `allocation.ts`, `triage.ts`, `reports.ts` | Pure product logic (+ tests) |
| `src/lib/worldFeed.ts`, `relays.ts`, `spoof.ts` | Simulator plumbing (SIMULATED) |
| `src/stores/` | Zustand stores: simulator, resident, family/mesh, ledger node, warden |
| `src/views/` | One folder per route |
