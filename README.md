# Lantern — works in the dark

**A community-owned wellbeing network for the Hollow.**
Patriot HackFest Fall 2026 · *Life Underground* track · solo project by Uday Kandi

- 🎬 **Demo video (2:35):** [ADD YOUTUBE LINK]
- 🌐 **Try it live:** [ADD NETLIFY LINK] — open **`/stage`** and press ▶ PLAY for the hands-free demo, or **`/`** to click through it yourself

> The Hollow is fictional, so the world (power, air, water, illness) is simulated. Everything Lantern does with that data is real code running in your browser.

---

## The idea

In the Hollow, the deep levels lose power first, the Directorate controls the network, and its health numbers don't match what people see. Lantern is built from what residents already have: phones, neighbors and one daily habit.

**One check-in a day** ("I'm okay", or how you slept, how you feel, any symptoms, is your water safe) powers everything else:

| What Lantern does | Track problems |
|---|---|
| Warns a level **hours before a blackout** | #1, #3 |
| Keeps **families connected** when the network is cut, passing messages phone to phone | #7, #8 |
| Shows the **real outbreak** next to the Directorate's official figures | #4, #9 |
| Recommends where **scarce power** should go, by priorities the levels vote on — in public | #2 |
| **Works in the dark:** voice check-in, spoken alerts, vibration, never colour alone | #11 |
| **No phone?** A shared terminal on every level, or a warden, checks you in | #10 |

## Design choices

- **No accounts.** A user list on a central server is something the Directorate could seize or switch off.
- **No admin view.** Personal data stays on your phone. Only anonymous counts per level are ever shared.
- **Trust from neighbors, not authority.** A warden becomes trusted only after three residents of their own level vouch for their key. Every warden action is signed; impostors and fake-report floods are rejected.
- **Accessibility is survival.** In a blackout you can't see a screen, so Lantern talks, listens and buzzes.

## How it's built

React + strict TypeScript (Vite), Zustand, IndexedDB (Dexie); installable offline PWA; deployed on Netlify.

- **Mesh:** gossip relaying between devices (each browser tab is a device) with hop routes, TTL and de-duplication.
- **Prediction:** blackout window from each hour's load vs the same hour yesterday, with a confidence label.
- **Outbreak detection:** each level compared with its own history; anomaly hold-back for suspicious spikes.
- **Security (WebCrypto):** AES-GCM family messages; wardens hold ECDSA/ECDH P-256 keys, sign every action, and care notes are encrypted to each vouched warden.
- **Accessibility:** Web Speech API (voice check-in + spoken alerts), Vibration API, ARIA live regions, shape-plus-word status labels.
- **Tested:** unit tests for the core logic, plus an automated end-to-end browser check of the full demo.

Built solo with AI coding tools (Claude Code), as the event rules allow. Narration voice: ElevenLabs.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173  →  /stage (autopilot) or / (demo launcher)
npm test
```

Full demo script, what's real vs simulated, and architecture: [docs/DEVELOPER.md](docs/DEVELOPER.md)
