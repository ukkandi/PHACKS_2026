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
| `/` and `/demo` | **Demo launcher — demo only** | Plain list: Reset & set up demo, open every demo tab |
| `/stage` | **Autopilot — demo only** | Hands-free 16:9 run of the whole demo for screen recording (▶ PLAY) |
| `/resident` | Resident's phone | Status screen (power/air/water/heat), giant I'M OKAY, family, messages; dim blackout mode |
| `/terminal?level=38` | Shared level terminal | Big-button check-in by unit number, no account, clears itself |
| `/warden?level=38` | Block warden | Who to visit first, check in people without devices, verify the ledger |
| `/ledger` | Everyone | Notice board of all 40 levels vs the Directorate's official figures; power allocation |
| `/directorate` | Directorate | Exactly the public ledger, read-only |
| `/sim` | **World Simulator — demo only, not part of Lantern** | Drives the fictional world |

Every browser tab is a separate device (own id, own IndexedDB). `?device=<name>` on `/resident` pins an identity.

**Interface language:** every screen leads with short states — **● NORMAL / ■ WATCH / ▲ DANGER** (shape + word + colour, never colour alone; hazard
stripes only on DANGER) — or a grey **○ NO DATA** when there's no reading or too few reports (under 20) to say anything; a
level is never shown NORMAL by default. Wardens can't confirm or dispute a figure until it has enough reports. Explanations sit behind the small **?** buttons. Small **●** trust chips show what's actually true
right now ("Works offline", "Network down · through neighbors' phones · 6 nearby", "heard 3 min ago · passed along by 1 phone", "based on 291 reports", "stored on this device"). Resident, terminal and warden screens use plain words ("public board", not "ledger"; "passed along by neighbors' phones", not "mesh hops").

**Works in the dark** (resident phone):
- **Voice check-in:** **◉ HOLD TO SPEAK** and say *"I'm okay"*, *"I need help"*, *"power out"* or *"need water"*. The screen shows what it heard and what it will do; nothing is sent until **CONFIRM · SEND**. In blackout mode it's the biggest control on the screen. Uses the browser's Web Speech API (Chrome, Edge, Safari); elsewhere it says *Voice not available here · use the buttons*. Note: Chrome's recognition needs an internet connection; in a real outage the buttons remain.
- **Spoken alerts:** blackout warnings, blackout start, family check-ins and messages are read aloud in short, calm sentences — automatically in blackout mode, or anytime with **Spoken alerts: on**. Every spoken alert is also shown as a caption.
- **Vibration:** distinct patterns for family OK (one buzz), message (three short), warning (two long), danger (three long). On devices that can't vibrate (laptops, iPhones), the screen flashes a banner with the same shape and word instead.
- **Screen readers:** urgent alerts go to an assertive live region, the rest to a polite one; status tiles read as "Power: OUT, tripped"; HOLD TO SPEAK also works as tap-to-start / tap-to-stop for VoiceOver.

## Autopilot recording (`/stage`)

A hands-free, 16:9 cut of the demo for the video — **target ≤ 3:00, hard stop before 3:10** — demo tooling, not part
of Lantern. One page holds Mara's and Ilan's phones, the public board, the Level 38 shared terminal and the vouched
warden's phone as real, live app pages (same-origin frames, so the phones still pass messages to each other); a hidden
World Simulator runs alongside. When the page opens it **prepares** a fresh demo (a few seconds), then shows **▶ PLAY**.

It's a **director's cut: one story, one focus at a time.** The camera shows one panel large and centred (the others
fade to ~15% or slide away, 600 ms moves) and an **amber ring ▼** points at the one thing that matters; on details the
camera **zooms in ~2–2.5×** (as far as it fits) and everything around the ring is softly dimmed. Captions follow the
narrator sentence by sentence, ≤ 8 words each.

| Line | Beat |
|---|---|
| 01 | Cold open (black). |
| 02 | Mara's phone: she taps **I'M OKAY** → Ilan's phone shows *Mara · okay*. |
| 03 | **1 · THE WARNING** → Mara's **power meter** (load climbing) → the warning (hours + confidence) → a **"▲ L38 · BLACKOUT IN ~12H" countdown** that runs down in ~8 s. |
| 04 | **2 · THE DARK** → one second of black and silence, an alarm, Mara's dark screen. |
| 05 | Her phone speaks the alert → zoom on **◉ HOLD TO SPEAK** → HEARD "power out" → **◆ POWER OUT** → **CONFIRM · SEND**. |
| 06 | The message reaches Ilan, passed along by a neighbour's phone; his phone reads it aloud. |
| 07 | **3 · THE TRUTH** → Level 38's outbreak card: **22.0%** vs the Directorate's **6.4%**. Caption and narration are built from the numbers on that card (a stage check verifies they match). |
| 08 | The power allocation: priorities **voted by 40 of 40 levels** → Level 38 air pumps → the Directorate's Levels 1–3. |
| 09 | **4 · NO ONE LEFT BEHIND** → the L38 terminal checks in unit 38-207 by unit number → the warden checks in Mr. Brandt (no phone). |
| 10 | **5 · THE TRUST** → the warden, vouched by 3 neighbours, confirms the outbreak (badge held ~4 s) → an impostor posing as W-38-WAR **disputes** it: **"W-38-WAR DISPUTES OUTBREAK · UNVERIFIED WARDEN, REJECTED"** (held ~4 s); the outbreak stays confirmed. |
| 11 | How it works: check in → stays on your phone → neighbor to neighbor → only anonymous counts shared (one row per sentence). |
| 12 | Closing card. |

- **Narrator:** recorded narration ships in `public/narration/01.mp3` … `12.mp3` (99.5 s in all; `.m4a` and `.wav`
  work too). A line without a file is spoken with the best available browser voice (a different one from the
  phones, slower and lower). Line 07 is checked against the live board: its file plays when the board shows the
  scripted 22.0% / 6.4% (it does in the seeded demo), otherwise the voice says the live numbers.
- **Voice in the dark (SIMULATED recognition):** the stage sets the app's speech-recognition test hook on Mara's
  phone so it "hears" *power out*; everything after that (HEARD, the action, CONFIRM · SEND, the message) is the app.
- **Nothing talks over the narrator:** each line plays to the end, with a short breath before the next; chapter
  cards wait for the line to finish and are silent; a phone's spoken alert waits for the narrator (trimmed to its
  first sentence), and a line waits for a phone to finish its sentence. The drone ducks 12 dB under every line,
  so even at peak tension it stays ~10 dB below the voice.
- **Sound design** (generated with Web Audio, no files): a low drone that rises in pitch and volume through the
  countdown, cut to silence at the blackout, an alarm, then a quieter drone.
- **Captions** for every beat, so the video also works muted.
- **Timing:** visuals are cued to the sentences inside each recorded line; every beat also has a hard deadline, so
  the closing card starts by 3:03 and the run ends by 3:09 whatever voice the browser uses (measured: 2:35 with the
  recorded narration).

Controls: **▶ PLAY** (one click also turns on sound) · **❚❚ Pause / ▶ Resume** · **↺ Restart** — or **Space** and **R**.
Controls fade out while playing (hover the top-right corner to see them). A restart re-prepares the world behind the
cold open, so for the cleanest take reload the page and wait for ▶ PLAY.

### Recording steps
1. Use **Chrome** on a 1920×1080 screen (or larger), on the deployed site or `npm run dev`.
2. Close every other Lantern tab (the stage resets all demo data in this browser).
3. Open **`/stage`** and wait for **▶ PLAY** (it says *Preparing…* for a few seconds first).
4. Press **F11** (fullscreen) so the stage fills the screen at exactly 1920×1080.
5. Turn system volume up and make sure your recorder captures **system audio** (OBS: Display Capture + Desktop Audio;
   QuickTime can't capture system audio).
6. Start recording, click **▶ PLAY** once, and don't touch the mouse again.
7. Stop recording when the closing card's last line has been read (about 2:35 after the click, always under 3:10). Trim the click off
   the start.

If anything goes wrong mid-run, reload the page and start again from step 3.

## Demo script (click by click)

Total time about 6–7 minutes. The simulator clock stays **Paused** throughout; you advance it with **Step +1h**, so every run is the same.

### Before you start (setup, under 1 min)
Use one browser window.

1. Open the site root **`/`** (the demo launcher; `/demo` is the same page).
2. Click **Reset & set up demo** → OK. This wipes all demo data in every open tab and puts the world at **Day 1, 00:00**, paused, with Level 38 selected.
3. Click **Open all 8 tabs**. If your browser blocks pop-ups, allow them for the site and click again, or click the 8 numbered rows one by one. **Order doesn't matter**: each tab catches up from the mesh when it opens.
   - Tabs: Public ledger · World Simulator · Mara (L38) · Teo (L36) · Ilan (L12) · L38 terminal · Warden L38 · Directorate.
   - The three resident tabs set themselves up as Mara, Teo and Ilan automatically.
4. **Check:** the ledger's status line reads **0 DANGER · 0 WATCH · 40 NORMAL** (an occasional single WATCH is normal noise), with **● 40 / 40 levels reporting** and **voted by 40 of 40 levels** under Power reserve. If it still shows **○ 40 NO DATA**, the World Simulator tab hasn't loaded yet — it fills in within a second or two once it has.
5. **Check:** the Warden tab reads **■ ACTIVE · VOUCHED BY 3 OF L38** (plus "+1 other level, not counted" — that's Teo on L36) and shows its **VISIT FIRST** list. Its key fingerprint is under the signage (**KEY XXXX·XXXX**); Mara's **WARDENS · L38** card shows the same key with **● YOU VOUCHED**. (Until it's active the warden tab is a locked screen; the rounds arrive encrypted to its key a moment after activation.)
6. Optional, privacy: open **`/warden?level=38&device=anyname`** in a new tab. It's a **locked** screen — **NOT ACTIVE · 0/3 VOUCHES**, its key in large type, and how to get vouched. No names, units, rounds, care notes or ledger buttons; that data was never sent to it. Close the tab.

To restart at any point: **World Simulator → Reset & set up demo** (or the same button on `/`). Every open tab reloads into the starting state.

### 1. Everyone checks in
- In Mara's, Teo's and Ilan's tabs: tap the big **I'M OKAY**, then **SEND NOW ▸**. (Or tap through the four one-tap details — MOOD, SLEEP, SYMPTOMS, WATER — the last tap sends. Or **HOLD TO SPEAK** → "I'm okay" → **CONFIRM · SEND**.)
- In **Ilan's** tab: tap **○ Spoken alerts: off** so it reads **● Spoken alerts: on** — he'll hear Mara later.
- **Show:** the tile row (**● ON · ● GOOD · ● SAFE · ■ HOT** on deep L38) and the trust chips (**● STORED ON THIS DEVICE · ● PUBLIC BOARD: COUNTS ONLY**).
- **Show:** Ilan's **FAMILY · ORIN-7** list shows Mara and Teo as **● OKAY TODAY**, each with **● HEARD … · DIRECT · L38 → L12** — and his caption reads *"Mara checked in. Mara is okay."* (spoken, now that his alerts are on).

### 2. Blackout warning, hours ahead
- **World Simulator:** click **Power surge**, then **Step +1h** about 4 times, until Mara's tab shows a yellow strip.
- **Show Mara:** **BLACKOUT RISK · 8–16 HOURS · MEDIUM CONFIDENCE**, and the POWER tile at **AT RISK**. Tap **?** for the reason and what to do (predicted on her phone from the level meter; the Directorate announced nothing).
- **Show Ilan:** **L38 BLACKOUT RISK** next to Mara in his family list, and under **OTHER LEVELS**. It was passed along from phone to phone.
- Optional: one or two more **Step +1h** clicks show the window tighten (e.g. 5–9 hours, high confidence).

### 3. Blackout: messages still get through
- **World Simulator:** keep clicking **Step +1h** (about 9 times) until Mara's phone switches to **blackout mode**: dim amber on black, hazard-striped **BLACKOUT · LEVEL 38**, a flash banner at the top, and it **says aloud** *"The power is out on Level 38. Lantern is still working through your neighbors' phones. Stay low, stay calm, and save your lamp."* HOLD TO SPEAK is now the biggest control.
- **Show Mara:** her top bar reads **■ NETWORK DOWN · THROUGH NEIGHBORS' PHONES · N NEARBY**.
- **Mara:** tap **POWER OUT** (or hold to speak: "power out" → **CONFIRM · SEND**).
- **Show Ilan:** "Power is out here." arrives with **PASSED ALONG BY 1 PHONE · L38 → L36 → L12**, and his phone reads it aloud: *"Message from Mara. Power is out here."*
- Optional (dramatic): **World Simulator → Directorate network: shut ALL down**, then **Mara → I'M SAFE**. It reaches Ilan passed along by about 12 phones. Click **Restore Directorate network (all)** afterwards.

**The 10-second "in the dark" moment** (for the video — do it at the start of step 3, sound on, screen brightness down):
1. Clicked once on Mara's tab beforehand (browsers only speak after you've interacted with the page). Ilan's spoken alerts are on.
2. **Step +1h** into the blackout → Mara's screen goes dark amber, flashes **▲ DANGER**, and *says* the blackout alert. *(~4 s)*
3. **Hold** Mara's **HOLD TO SPEAK**, say **"power out"**, release → **HEARD "power out" → ◆ POWER OUT** → **CONFIRM · SEND**. *(~4 s)*
4. Ilan's phone says *"Message from Mara. Power is out here."* *(~2 s)*

Voice recognition in Chrome needs the microphone allowed and an internet connection; if either is missing, use the **POWER OUT** button — the rest of the moment is the same.

### 4. Outbreak vs the official number
- **World Simulator:** click **Symptom spike, levels 34–40**, then **Step +1h** 8 times.
- **Show Ledger:** the status line jumps to **7 DANGER**. On the board, rows **L34–L40** read **DANGER** with hazard markers and **ILLNESS ~20% ▲** next to an **OFFICIAL ~6%**.
- **Show Ledger → OUTBREAK WATCH:** **▲ LEVEL 38 · OUTBREAK — LANTERN ~22% · OFFICIAL ~6.4% · GAP ~3.4× LOWER · ● BASED ON ~291 REPORTS**.
- Click **L38** on the board for its sources and reasoning.

### 5. Allocation: recommendation vs what the Directorate did
- **Show Ledger → POWER RESERVE · 14 MW:**
  - Priorities **1 AIR › 2 WATER › 3 COOLING › 4 LIGHT · ● VOTED BY 40 OF 40 LEVELS**.
  - **LANTERN RECOMMENDS:** ~4 MW → **Level 38 air pumps** first (tap its **?** for the reason).
  - **DIRECTORATE DID:** 2 MW → L38 corridor lighting (acknowledged 4 h late) and the rest → **Levels 1–3 administrative districts** (in red).
  - **▲ ~10% MATCHED** in the panel header.
- Optional: **World Simulator → Directorate powers L38 air pumps**. The Directorate column shows "Level 38 air pumps (emergency line)" and the match % goes up.

### 6. Terminal and warden: people without phones
- **Terminal tab:** tap **2 2 1** → **NEXT** → **I NEED HELP** → **LOW** → **UNDER 5 H** → **BREATHING** → **NEXT** → **YES**. The screen shows **▲ WARDEN TOLD**, then clears itself after 8 seconds.
- **Warden tab:** status line **▲ 1 NEED HELP**; **MRS. OKAFOR · 38-221** is top of **VISIT FIRST**: **▲ NEEDS HELP — ASKED FOR HELP · BREATHING TROUBLE · VULNERABLE**.
- **Warden:** on **MR. BRANDT** tap **CHECK IN** → **SEND**. He now shows **● LAST … VIA WARDEN**.
- **Warden:** in **VERIFY LEDGER · L38**, tap **CONFIRM OUTBREAK**.
- **Show Ledger:** Level 38 in OUTBREAK WATCH now carries **✓ CONFIRMED BY WARDEN W-38-WAR**. Click **L38** on the board: "Sources: N via level phones, 1 via terminal, 1 via warden".
- **Impostor:** **World Simulator** (Target level still **Level 38**) → **Impostor warden disputes outbreak on L38**. It poses as W-38-WAR to *deny* the outbreak and signs correctly — but with a key no L38 resident vouched for.
- **Show Ledger → HELD BACK:** **▲ L38 · W-38-WAR DISPUTES OUTBREAK · UNVERIFIED WARDEN, REJECTED** (tap **?**: the key fingerprint and why). The outbreak stays confirmed: the genuine ✓ confirmation is unaffected.

### 7. Trust: a fake flood is held back
- **World Simulator:** set Target level to **Level 5** and click **Rogue device: inject 300 fake reports on L5**.
- **Show Ledger → HELD BACK:** **▲ L5 · 300 REPORTS · HELD, NOT COUNTED** (reason behind **?**). The L5 row stays NORMAL.

### 8. The Directorate's view
- Open the **Directorate** tab: **DIRECTORATE ACCESS · READ-ONLY**, the same board, with **● SAME DATA AS PUBLIC · ● NO INDIVIDUAL DATA**.

## What is real vs simulated

(Voice, speech and vibration are real browser features — Web Speech API, speech synthesis, Vibration API. The demo-check script simulates only the *recognition* step, via a test hook in `src/lib/voice.ts` that's active only when a test injects it before the page loads.)


Real logic, unit-tested and running in the browser:
- **Blackout predictor:** compares each hour's load with the same hour yesterday, and gives a time window with a confidence label.
- **Mesh:** gossip relaying with hop routes, TTL and dedup, plus selective relaying with offline beacons and anonymous origins.
- **Encryption:** AES-GCM for family packets (key from the family code).
- **Warden authentication, no server:** each warden device makes real WebCrypto keys (ECDSA P-256 to sign, ECDH P-256 to receive), private keys non-extractable. A warden becomes active once **3 residents of its own level** vouch for its public key, each vouch signed by a key made on the resident's device (not an account). Every device checks every signature itself; the ledger ignores warden confirmations and check-ins that are unsigned, forged or from an unvouched key, and lists them as rejected.
- **Care notes and rounds:** every care note and every rounds entry (name, unit, notes, "vulnerable") is encrypted separately to each active warden's public key (ephemeral ECDH → AES-GCM). A device that isn't a vouched warden never receives anything it can read, and sees only a locked screen. Active wardens re-share their rounds, encrypted, with any newly activated warden of their level. On the warden device everything is stored encrypted to its own key (random record ids, no names or unit numbers on disk) and decrypted in memory.
- **Ledger:** aggregation of anonymous counts, outbreak detection (two-proportion z-test against each level's own history), anomaly hold-back, and catch-up for late-joining devices.
- **Community vote tally:** Borda count over each level's latest ballot.
- **Allocation engine:** shares the reserve by community priorities.
- **Care triage.**
- **Per-device storage:** IndexedDB.
- **Installable, works offline (PWA):** after one visit the whole app, fonts included, is cached; every route opens with no network.

Simulated (marked `// SIMULATED:` in code):
- **The world:** power, heat, air, water, illness (`src/sim/`).
- **The Directorate's bulletin:** deliberately under-reports, acknowledges blackouts late, sends reserve upward (`src/sim/directorate.ts`).
- **"Level phones":** one stand-in device per level, hosted by the World Simulator, relaying traffic and sending synthetic residents' anonymous counts (`src/lib/relays.ts`, `src/sim/standin.ts`).
- **The radio layer:** all tabs share one BroadcastChannel. Links are allowed if both ends have the Directorate net, or if devices are within 2 levels.
- **Demo rounds book** (`src/sim/demoRounds.ts`): Mrs. Okafor, Mr. Brandt and the others are held by the World Simulator's L38 level phone and handed over — encrypted — only to a warden key once it's active.
- **Demo pre-vouch** (`src/lib/demoVouch.ts`): Mara, Teo and two simulated L38 residents on the level phone vouch automatically for the first W-38-WAR key they hear. In real use a resident taps **VOUCH** after checking the key on the warden's screen in person.
- **Rogue device and impostor warden:** the fake-report injection and the impostor's dispute are simulated attacks.

Known limits of vouching (honest list): nothing stops someone with many devices from vouching many times (no Sybil resistance beyond "3 distinct device keys from that level"); there is no revocation yet; and a device trusts the level a voucher *claims* to be on.
- **The levels' ballots:** each level phone casts a deterministic simulated ballot once per simulated day (`src/sim/votes.ts`).
- **Demo launcher and reset** (`/demo`, `src/lib/demoReset.ts`): demo tooling, not part of Lantern.

## Architecture

| Path | What |
|---|---|
| `src/sim/` | Pure world model, blackout predictor, Directorate bulletin, stand-in reports (+ tests) |
| `src/lib/mesh.ts` | Gossip mesh; packet kinds: `sealed`, `alert`, `summary`, `verify`, `vote`, `sync-req`, `sync` |
| `src/lib/ledger.ts`, `outbreak.ts`, `allocation.ts`, `votes.ts`, `triage.ts`, `reports.ts` | Pure product logic (+ tests) |
| `src/lib/worldFeed.ts`, `relays.ts`, `spoof.ts`, `demoReset.ts` | Simulator and demo plumbing (SIMULATED) |
| `src/stores/` | Zustand stores: simulator, resident, family/mesh, ledger node, warden |
| `src/views/` | One folder per route |
