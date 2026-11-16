import { describe, expect, it } from 'vitest'
import { familyPhrase, messagePhrase, powerPhrase } from './spokenPhrases'
import { parseUtterance } from './voice'

describe('parseUtterance', () => {
  it.each([
    ["I'm okay", 'okay'],
    ['im ok', 'okay'],
    ['I am fine.', 'okay'],
    ['okay', 'okay'],
    ['I need help', 'help'],
    ['help', 'help'],
    ["I'm not okay", 'help'],
    ['power out', 'power-out'],
    ["the power's out", 'power-out'],
    ['lights are out', 'power-out'],
    ['need water', 'need-water'],
    ['we need water', 'need-water'],
  ])('%s → %s', (said, want) => {
    expect(parseUtterance(said)).toBe(want)
  })
  it('returns null when unclear', () => {
    expect(parseUtterance('what time is it')).toBeNull()
    expect(parseUtterance('')).toBeNull()
  })
})

describe('spoken phrases', () => {
  it('are short and calm', () => {
    const w = powerPhrase(38, 'warning', 'clear', [8.2, 15.6])!
    expect(w.text).toBe('Power warning for Level 38. A blackout is likely in 8 to 16 hours. Charge your lamp and fill water.')
    expect(powerPhrase(38, 'blackout', 'critical', null)!.kind).toBe('danger')
    expect(powerPhrase(38, 'clear', 'blackout', null)!.text).toBe('The power is back on Level 38.')
    expect(powerPhrase(38, 'warning', 'warning', null)).toBeNull()
    expect(familyPhrase('Teo', true).text).toBe('Teo checked in. Teo is okay.')
    expect(messagePhrase('Mara', 'Power is out here.').text).toBe('Message from Mara. Power is out here.')
    for (const a of [w, familyPhrase('Teo', false)]) for (const sentence of a.text.split('. ')) expect(sentence.split(' ').length).toBeLessThanOrEqual(14)
  })
})
