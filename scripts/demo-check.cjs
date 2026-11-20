// Full demo flow, exactly as scripted in docs/DEVELOPER.md. Each step prints PASS/FAIL.
// Usage: npm run dev (in another terminal), then: node scripts/demo-check.cjs
// Needs Playwright with Chromium available (not a project dependency on purpose).
const { chromium } = require('playwright')
const URL = process.env.URL || 'http://localhost:5173'
let fails = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); if (!ok) fails++ }
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ')
const has = (text, needle) => text.toLowerCase().includes(needle.toLowerCase())
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 } })
  const errs = []
  const open = async (path, name) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(name + ': ' + e)); p.on('console', (m) => m.type() === 'error' && errs.push(name + ': ' + m.text())); await p.goto(URL + path); return p }

  // Setup
  const ledger = await open('/ledger', 'ledger')
  const sim = await open('/sim', 'sim')
  const step = async (n) => { for (let i = 0; i < n; i++) { await sim.getByRole('button', { name: 'Step +1h' }).click(); await sim.waitForTimeout(80) } }
  const res = {}
  for (const name of ['Mara', 'Teo', 'Ilan']) { res[name] = await open('/resident', name); await res[name].getByRole('button', { name: new RegExp(`^${name} ·`) }).click() }
  const terminal = await open('/terminal?level=38', 'terminal')
  const warden = await open('/warden?level=38&device=warden38', 'warden')
  await ledger.waitForTimeout(800)
  check('Setup: ledger receives level phones', (await txt(ledger.locator('main'))).includes('40 / 40'))
  // Warden W-38-WAR is activated by 3 signed vouches from L38 residents (Mara + 2 level-phone residents).
  let wardenText = ''
  for (let i = 0; i < 24 && !(/Active · vouched by 3 of L38/i.test(wardenText) && /Mrs\. Okafor/i.test(wardenText)); i++) {
    await warden.waitForTimeout(250)
    wardenText = await txt(warden.locator('main'))
  }
  check('Setup: warden W-38-WAR active, vouched by 3 L38 residents', /Active · vouched by 3 of L38/i.test(wardenText))
  check("Setup: Teo's vouch (L36) shown but not counted", /\+1 other level, not counted/i.test(wardenText))
  check('Setup: active warden received the rounds (encrypted to its key)', /Mrs\. Okafor/i.test(wardenText))

  // Privacy: a fresh, unvouched device opening /warden sees a locked screen — no resident names.
  const fresh = await open(`/warden?level=38&device=fresh${Date.now().toString(36)}`, 'fresh-warden')
  await fresh.waitForTimeout(2000)
  const freshText = await txt(fresh.locator('body'))
  const leaked = ['Okafor', 'Brandt', 'Halvorsen', 'Aziz', '38-221', '38-305', 'Mara', 'Ilan'].filter((n) => has(freshText, n))
  check('Privacy: unvouched warden device is locked (NOT ACTIVE · 0/3, key shown)', /Not active · 0\/3 vouches/i.test(freshText) && /[0-9A-F]{4}·[0-9A-F]{4}/i.test(freshText))
  check('Privacy: no resident names, units or warden actions visible', leaked.length === 0 && (await fresh.getByRole('button', { name: /Confirm|Check in|Visited/ }).count()) === 0, leaked.join(', '))
  await fresh.close()

  // Step 1–2: check-ins, family okay
  // I'M OKAY, then SEND NOW (skip the optional details) = the default check-in.
  for (const name of ['Mara', 'Teo', 'Ilan']) {
    await res[name].getByRole('button', { name: "I'm okay", exact: true }).click()
    await res[name].getByRole('button', { name: 'Send now ▸' }).click()
  }
  await res.Ilan.waitForTimeout(1500)
  const fam = await txt(res.Ilan.locator('section', { hasText: 'Family · ORIN-7' }))
  check('Step 2: Ilan sees Mara and Teo okay', /Mara .*Okay today/i.test(fam) && /Teo .*Okay today/i.test(fam))

  // Ilan turns spoken alerts on (Mara's phone will switch them on by itself in blackout mode).
  await res.Ilan.getByRole('button', { name: /Spoken alerts: off/ }).click()

  // Step 3: surge → warning hours ahead
  await sim.getByRole('button', { name: 'Power surge' }).click()
  let warnedAt = 0
  for (let h = 1; h <= 10 && !warnedAt; h++) { await step(1); if (await res.Mara.getByTestId('power-warning').count()) warnedAt = h }
  const banner = warnedAt ? await txt(res.Mara.getByTestId('power-warning')) : ''
  check('Step 3: Mara gets a blackout warning with a time window', /Blackout risk · \d+–\d+ hours/i.test(banner), banner.slice(0, 90))
  check('Step 3: warning shows a confidence label', /(low|medium|high) confidence/i.test(banner))
  await res.Ilan.waitForTimeout(600)
  check('Step 3: Ilan sees the L38 alert via the mesh', has(await txt(res.Ilan.locator('section', { hasText: 'Family · ORIN-7' })), 'L38 blackout'))

  // Step 4: blackout → messages over peer hops
  let hoursToTrip = 0
  for (let h = 1; h <= 20; h++) { await step(1); if (await res.Mara.getByText('Blackout · Level 38').count()) { hoursToTrip = h; break } }
  check('Step 4: blackout hits after the warning', hoursToTrip > 0, `${hoursToTrip}h after warning`)
  check('Step 4: Mara is in blackout mode', (await res.Mara.locator('.blackout-mode').count()) === 1)
  await res.Mara.waitForTimeout(500)
  check("Step 4: Mara's top bar says the network is down, still working through neighbors' phones", has(await txt(res.Mara.locator('header').first()), "through neighbors' phones"))
  const spokenMara = await res.Mara.evaluate(() => window.__lanternSpoken ?? [])
  check('Step 4: blackout start is spoken aloud on Mara\'s phone (on by default in blackout)', spokenMara.some((t) => t.startsWith('The power is out on Level 38')), spokenMara.slice(-1)[0])
  check('Step 4: the same alert is shown as a caption', has(await txt(res.Mara.getByTestId('alert-caption')), 'power is out on Level 38'))
  check('Step 4: voice is the default control in blackout mode', (await res.Mara.getByRole('button', { name: /Hold to speak/ }).count()) === 1)
  await res.Mara.getByRole('button', { name: 'Power out', exact: true }).click()
  await res.Ilan.waitForTimeout(1500)
  const msgs = await txt(res.Ilan.locator('section', { hasText: 'Family messages' }))
  check("Step 4: message reaches Ilan, passed along by a neighbor's phone", /Power is out here\..*passed along by 1 phone · L38 → L3[67] → L12/i.test(msgs), (msgs.match(/passed along[^|]*?L12/i) || [''])[0])
  const spokenIlan = await res.Ilan.evaluate(() => window.__lanternSpoken ?? [])
  check('Step 4: Ilan (spoken alerts on) hears the message read aloud', spokenIlan.includes('Message from Mara. Power is out here.'), spokenIlan.slice(-1)[0])

  // Step 5: outbreak vs official
  await sim.getByRole('button', { name: /Symptom spike/ }).click()
  await step(8)
  await ledger.waitForTimeout(800)
  const ob = await txt(ledger.locator('section', { hasText: 'Outbreak watch' }).first())
  const m = ob.match(/Level 38 · OUTBREAK.*?LANTERN ([\d.]+)%.*?OFFICIAL ([\d.]+)%.*?based on (\d+) reports/i)
  check('Step 5: L38 outbreak flagged next to the lower official figure', !!m && +m[1] > 2 * +m[2], m ? `Lantern ${m[1]}% (${m[3]} reports) vs official ${m[2]}%` : ob.slice(0, 120))

  // Step 6: allocation vs Directorate
  const al = await txt(ledger.locator('section', { hasText: 'Power reserve' }).first())
  check('Step 6: Lantern recommends L38 air pumps first', /Lantern recommends [\d.]+ MW → Level 38 air pumps/i.test(al))
  check('Step 6: Directorate sends reserve to Levels 1–3', /Directorate did.*Levels 1–3 administrative/i.test(al))
  await sim.getByRole('button', { name: 'Directorate powers L38 air pumps' }).click()
  await ledger.waitForTimeout(500)
  check('Step 6b: after the reroute, the ledger shows it', has(await txt(ledger.locator('section', { hasText: 'Power reserve' }).first()), 'Level 38 air pumps (emergency line)'))

  // Step 7: terminal + warden
  await terminal.bringToFront(); await terminal.waitForTimeout(200)
  for (const k of '221') await terminal.getByRole('button', { name: k, exact: true }).click()
  await terminal.getByRole('button', { name: 'Next' }).click()
  await terminal.getByRole('button', { name: 'I need help' }).click()
  await terminal.getByRole('button', { name: /^Low/ }).click()
  await terminal.getByRole('button', { name: 'Under 5 h' }).click()
  await terminal.getByRole('button', { name: 'breathing' }).click()
  await terminal.getByRole('button', { name: 'Next', exact: true }).click()
  await terminal.getByRole('button', { name: 'Yes' }).click()
  check('Step 7: terminal confirms', has(await txt(terminal.locator('main')), 'Warden told'))
  await warden.waitForTimeout(1200)
  const top = await txt(warden.locator('li', { hasText: '38-' }).first())
  check('Step 7: warden triage puts Mrs. Okafor first', /Mrs\. Okafor.*Needs help.*breathing trouble/i.test(top))
  const brandt = warden.locator('li', { hasText: 'Mr. Brandt' })
  await brandt.getByRole('button', { name: 'Check in', exact: true }).click()
  await brandt.getByRole('button', { name: 'Send', exact: true }).click()
  await warden.waitForTimeout(300)
  check('Step 7: warden checks in Mr. Brandt', has(await txt(warden.locator('li', { hasText: 'Mr. Brandt' })), 'via warden'))
  await warden.getByRole('button', { name: 'Confirm outbreak' }).click()
  await ledger.waitForTimeout(800)
  check('Step 7: ledger shows warden confirmation', /Level 38 · OUTBREAK.*confirmed by warden W-38/i.test(await txt(ledger.locator('section', { hasText: 'Outbreak watch' }).first())))
  await ledger.getByRole('button', { name: 'L38', exact: true }).click()
  const det = await txt(ledger.locator('tr', { hasText: 'Sources' }))
  check('Step 7: L38 counts include terminal + warden reports', /via terminal/i.test(det) && /via warden/i.test(det), (det.match(/Sources:[^.]*/i) || [''])[0])

  // Step 7b: an impostor with a valid signature but an unvouched key
  await sim.getByRole('button', { name: 'Impostor warden disputes outbreak on L38' }).click()
  await ledger.waitForTimeout(1000)
  const heldTxt = await txt(ledger.locator('section', { hasText: 'Held back' }))
  check('Step 7b: impostor warden dispute rejected', /L38 · W-38-WAR disputes outbreak · unverified warden, rejected/i.test(heldTxt))
  check('Step 7b: the outbreak stays confirmed by the genuine warden', /Level 38 · OUTBREAK.*confirmed by warden W-38/i.test(await txt(ledger.locator('section', { hasText: 'Outbreak watch' }).first())))

  // Step 8: trust
  await sim.selectOption('select', '5')
  await sim.getByRole('button', { name: /inject 300 fake/ }).click()
  await ledger.waitForTimeout(800)
  check('Step 8: fake reports are held back', /L5 · 300 reports · held, not counted/i.test(await txt(ledger.locator('section', { hasText: 'Held back' }))))

  // Step 9: directorate view
  const dir = await open('/directorate', 'directorate')
  await dir.waitForTimeout(800)
  check('Step 9: Directorate view is read-only and shows the same outbreak', /read-only/i.test(await txt(dir.locator('main'))) && /Level 38 · OUTBREAK/i.test(await txt(dir.locator('main'))))

  // Step 10: voice check-in (speech recognition simulated) and the no-voice fallback.
  const voiceCtx = await b.newContext({ viewport: { width: 900, height: 1000 } })
  const vp = await voiceCtx.newPage()
  vp.on('pageerror', (e) => errs.push('voice: ' + e))
  await vp.addInitScript(() => {
    window.__lanternFakeVoice = { transcript: 'I need help' }
  })
  await vp.goto(URL + '/resident?device=voicetest')
  await vp.getByLabel('Name').fill('Rae')
  await vp.getByRole('button', { name: 'Start' }).click()
  const hold = vp.getByRole('button', { name: /Hold to speak/ })
  await hold.hover()
  await vp.mouse.down()
  await vp.waitForTimeout(200)
  await vp.mouse.up()
  await vp.waitForTimeout(300)
  const heard = await txt(vp.getByRole('region', { name: 'Voice check-in' }))
  check('Step 10: voice shows what it heard and what it will do', /Heard “I need help”.*I need help/i.test(heard), heard.slice(0, 80))
  check('Step 10: nothing is sent before CONFIRM', !has(await txt(vp.locator('main')), 'Help requested'))
  await vp.getByRole('button', { name: /Confirm · send/ }).click()
  await vp.waitForTimeout(400)
  check('Step 10: after CONFIRM the help request is recorded', has(await txt(vp.locator('main')), 'Help requested'))
  const np = await voiceCtx.newPage()
  await np.addInitScript(() => {
    for (const k of ['SpeechRecognition', 'webkitSpeechRecognition']) Object.defineProperty(window, k, { value: undefined, configurable: true })
  })
  await np.goto(URL + '/resident?device=novoice&as=ilan')
  await np.waitForTimeout(800)
  check('Step 10: without speech recognition, a clear fallback to the buttons', has(await txt(np.locator('main')), 'Voice not available here · use the buttons') && (await np.getByRole('button', { name: "I'm okay", exact: true }).count()) === 1)
  await voiceCtx.close()

  // Step 11: the hands-free autopilot (/stage) runs the whole show end to end (sped up 6×; the stage
  // prepares a fresh world on load, then PLAY becomes available).
  const stageCtx = await b.newContext({ viewport: { width: 1920, height: 1080 } })
  const st = await stageCtx.newPage()
  st.on('pageerror', (e) => errs.push('stage: ' + e))
  await st.goto(URL + '/stage?speed=6')
  await st.waitForTimeout(2000)
  await st.getByRole('button', { name: 'Play the demo with sound' }).click()
  await st.waitForFunction(() => window.__stageDone === true, null, { timeout: 180_000 }).catch(() => {})
  const stageLog = (await st.evaluate(() => window.__stageLog)) ?? []
  const stageFails = stageLog.filter((l) => !l.ok).map((l) => l.name)
  check('Step 11: /stage autopilot finishes', await st.evaluate(() => window.__stageDone === true))
  check(`Step 11: every autopilot beat checks out (${stageLog.length} checks)`, stageLog.length >= 19 && stageFails.length === 0, stageFails.join('; '))
  const truth = stageLog.find((l) => /caption's L38 percentages/.test(l.name))
  check("Step 11: THE TRUTH caption's L38 percentages equal the L38 card on screen", !!truth?.ok, truth?.detail)
  const stageSpoken = (await st.evaluate(() => window.__stageSpoken)) ?? []
  check('Step 11: stage speaks the blackout and the message', stageSpoken.some((t) => t.startsWith('The power is out on Level 38')) && stageSpoken.includes('Message from Mara. Power is out here.'))
  for (const name of ['voice: HEARD "power out"', 'terminal: unit 38-207', 'warden checks in Mr. Brandt', 'impostor dispute rejected', 'outbreak stays confirmed'])
    check(`Step 11: stage beat · ${name}`, !!stageLog.find((l) => l.name.startsWith(name) && l.ok))
  check('Step 11: closing card shown', has(await txt(st.locator('body')), 'Lantern keeps the Hollow connected, even in the dark.'))
  await stageCtx.close()

  check('No page errors', errs.length === 0, errs.slice(0, 3).join(' / '))
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
  await b.close()
  process.exit(fails ? 1 : 0)
})()
