# Lantern

Community-owned, offline-first wellbeing network for "the Hollow" (Patriot HackFest Fall 2026, *Life Underground* track).
Fictional world; **all data is simulated**. See `AGENTS.md` for the brief.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # sim, predictor, mesh + crypto unit tests
```

## Running the demo (phases 1–2)

1. Open `/sim` in one tab. It owns the simulated world and hosts one simulated "neighbour device" per level.
2. Open `/resident` in three more tabs. Pick **Mara · L38**, **Teo · L36**, **Grandpa Ilan · L12** (family `ORIN-7`). Each tab is a separate device with its own IndexedDB.
3. Check in on each. The family panels show everyone "Okay today", with the route each status took.
4. In `/sim`, with target Level 38: **Power surge**, then **Step +1h** a few times (or run the clock). About 5 hours in, Mara gets a blackout warning, and Ilan sees the L38 alert arrive over the mesh, hours before the feeder trips.
5. Keep stepping until the blackout. L38 loses the Directorate network. Send a message from Mara: it reaches Ilan via `L38 ⇢radio L36 ⇢net L12`.
6. **Directorate network: shut ALL down**. Messages still arrive, hopping level by level over radio (about 13 hops from L38 to L12).

`?device=<name>` on `/resident` pins a device identity, so you can reopen the same "phone".

## Architecture

| Path | What |
|---|---|
| `src/sim/` | Pure, seeded world model (`world.ts`), blackout predictor (`predict.ts`) + tests |
| `src/lib/worldFeed.ts` | SIMULATED physical reality: `/sim` broadcasts world snapshots to all tabs |
| `src/lib/mesh.ts` | Gossip mesh over `BroadcastChannel`: hop routes, TTL, dedup; link = Directorate net (both ends up) or radio (±2 levels) |
| `src/lib/familyCrypto.ts` | AES-GCM family encryption (key from family code via PBKDF2) |
| `src/lib/relays.ts` | SIMULATED neighbour devices (1 per level) hosted by `/sim` |
| `src/lib/db.ts` | Per-device Dexie DB: profile, check-ins, family, messages |
| `src/stores/` | Zustand stores (sim operator, resident, family/mesh) |
