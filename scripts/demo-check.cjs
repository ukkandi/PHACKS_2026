// Full demo flow, exactly as scripted in README.md. Each step prints PASS/FAIL.
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
  const warden = await open('/warden?level=38', 'warden')
  await ledger.waitForTimeout(800)
  check('Setup: ledger receives level phones', (await txt(ledger.locator('main'))).includes('40 / 40'))

  // Step 1–2: check-ins, family okay
  // I'M OKAY, then SEND NOW (skip the optional details) = the default check-in.
  for (const name of ['Mara', 'Teo', 'Ilan']) {
    await res[name].getByRole('button', { name: "I'm okay", exact: true }).click()
    await res[name].getByRole('button', { name: 'Send now ▸' }).click()
  }
  await res.Ilan.waitForTimeout(1500)
  const fam = await txt(res.Ilan.locator('section', { hasText: 'Family · ORIN-7' }))
  check('Step 2: Ilan sees Mara and Teo okay', /Mara .*Okay today/i.test(fam) && /Teo .*Okay today/i.test(fam))

  // Step 3: surge → warning hours ahead
  await sim.getByRole('button', { name: 'Power surge' }).click()
  let warnedAt = 0
  for (let h = 1; h <= 10 && !warnedAt; h++) { await step(1); if (await res.Mara.locator('[role=alert]').count()) warnedAt = h }
  const banner = warnedAt ? await txt(res.Mara.locator('[role=alert]')) : ''
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
  check('Step 4: Mara is mesh-only', has(await txt(res.Mara.locator('header').first()), 'Mesh only'))
  await res.Mara.getByRole('button', { name: 'Power out', exact: true }).click()
  await res.Ilan.waitForTimeout(1500)
  const msgs = await txt(res.Ilan.locator('section', { hasText: 'Family messages' }))
  check('Step 4: message reaches Ilan via a radio hop', /Power is out here\..*L38 ⇢radio L3[67]/i.test(msgs), (msgs.match(/\d+ hops?: [^|]*?L12/) || [''])[0])

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
  await terminal.getByRole('button', { name: 'Under 5 hours' }).click()
  await terminal.getByRole('button', { name: 'breathing' }).click()
  await terminal.getByRole('button', { name: 'Next', exact: true }).click()
  await terminal.getByRole('button', { name: 'Yes' }).click()
  check('Step 7: terminal confirms', (await txt(terminal.locator('main'))).includes('Your block warden has been told'))
  await warden.waitForTimeout(1200)
  const top = await txt(warden.locator('li', { hasText: '38-' }).first())
  check('Step 7: warden triage puts Mrs. Okafor first', /Mrs\. Okafor.*Needs help.*breathing trouble/i.test(top))
  const brandt = warden.locator('li', { hasText: 'Mr. Brandt' })
  await brandt.getByRole('button', { name: 'Check in for them' }).click()
  await brandt.getByRole('button', { name: 'Submit check-in' }).click()
  await warden.waitForTimeout(300)
  check('Step 7: warden checks in Mr. Brandt', (await txt(warden.locator('li', { hasText: 'Mr. Brandt' }))).includes('via warden'))
  await warden.getByRole('button', { name: 'Confirm outbreak' }).click()
  await ledger.waitForTimeout(800)
  check('Step 7: ledger shows warden confirmation', /Level 38 · OUTBREAK.*confirmed by warden W-38/i.test(await txt(ledger.locator('section', { hasText: 'Outbreak watch' }).first())))
  await ledger.getByRole('button', { name: 'L38', exact: true }).click()
  const det = await txt(ledger.locator('tr', { hasText: 'Sources' }))
  check('Step 7: L38 counts include terminal + warden reports', /via terminal/i.test(det) && /via warden/i.test(det), (det.match(/Sources:[^.]*/i) || [''])[0])

  // Step 8: trust
  await sim.selectOption('select', '5')
  await sim.getByRole('button', { name: /inject 300 fake/ }).click()
  await ledger.waitForTimeout(800)
  check('Step 8: fake reports are held back', /L5 · 300 reports · held, not counted/i.test(await txt(ledger.locator('section', { hasText: 'Held back' }))))

  // Step 9: directorate view
  const dir = await open('/directorate', 'directorate')
  await dir.waitForTimeout(800)
  check('Step 9: Directorate view is read-only and shows the same outbreak', /read-only/i.test(await txt(dir.locator('main'))) && /Level 38 · OUTBREAK/i.test(await txt(dir.locator('main'))))

  check('No page errors', errs.length === 0, errs.slice(0, 3).join(' / '))
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
  await b.close()
  process.exit(fails ? 1 : 0)
})()
