// Industrial UI kit: square, monospace, status-first. Colour carries state; words stay short.
import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { STATE_WORD, type State } from '../lib/status'

type Tone = 'default' | 'primary' | 'danger' | 'ghost'

const toneClass: Record<Tone, string> = {
  default: 'bg-hollow-800 hover:bg-hollow-700 text-cream border-2 border-hollow-700 hover:border-hollow-500',
  primary: 'bg-lamp hover:bg-[#ffb54d] text-hollow-950 border-2 border-lamp font-bold',
  danger: 'bg-hollow-950 hover:bg-danger/20 text-danger border-2 border-danger font-bold',
  ghost: 'bg-transparent hover:bg-hollow-800 text-hollow-300 border-2 border-transparent',
}

export function Button({
  tone = 'default',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      type="button"
      className={`min-h-11 px-4 py-2 font-mono text-sm tracking-wide uppercase disabled:cursor-not-allowed disabled:opacity-40 ${toneClass[tone]} ${className}`}
      {...rest}
    />
  )
}

/** Tunnel-signage header: "LEVEL 38 · SECTOR 2". */
export function Sign({ children, sub, as: Tag = 'h1' }: { children: ReactNode; sub?: ReactNode; as?: 'h1' | 'h2' }) {
  return (
    <div className="border-l-8 border-lamp bg-hollow-900 px-3 py-2">
      <Tag className="font-mono text-xl font-bold tracking-[0.08em] text-cream uppercase sm:text-2xl">{children}</Tag>
      {sub && <div className="font-mono text-sm tracking-wider text-hollow-300 uppercase">{sub}</div>}
    </div>
  )
}

/** Panel with a signage label. `help` puts the explanation behind a "?" toggle. */
export function Card({
  title,
  right,
  help,
  children,
  className = '',
}: {
  title?: ReactNode
  right?: ReactNode
  help?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`border-2 border-hollow-700 bg-hollow-900 ${className}`}>
      {(title || right || help) && (
        <header className="flex items-center justify-between gap-2 border-b-2 border-hollow-700 bg-hollow-950 px-3 py-1.5">
          <h2 className="font-mono text-sm font-bold tracking-[0.12em] text-lamp uppercase">{title}</h2>
          <div className="flex items-center gap-2">
            {right}
            {help && <Explain label={typeof title === 'string' ? `About ${title}` : 'Explain'}>{help}</Explain>}
          </div>
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  )
}

/** "?" toggle: explanations stay out of the way until asked for. */
export function Explain({ children, label = 'Explain' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen(!open)}
        className={`size-8 border-2 font-mono text-sm font-bold ${open ? 'border-lamp bg-lamp text-hollow-950' : 'border-hollow-500 text-hollow-300 hover:border-lamp'}`}
      >
        ?
      </button>
      {open && (
        <div
          id={id}
          role="note"
          className="absolute top-9 right-0 z-30 w-80 max-w-[85vw] border-2 border-lamp bg-hollow-950 p-3 text-left font-sans text-sm font-normal tracking-normal text-cream normal-case"
        >
          {children}
        </div>
      )}
    </span>
  )
}

const stateText: Record<State, string> = { normal: 'text-ok', watch: 'text-warn', danger: 'text-danger', nodata: 'text-hollow-500' }
const stateBorder: Record<State, string> = {
  normal: 'border-ok',
  watch: 'border-warn',
  danger: 'border-danger',
  nodata: 'border-hollow-700 border-dashed',
}
/** Never colour alone: every state also has its own shape (and a word next to it). */
export const stateGlyph: Record<State, string> = { normal: '●', watch: '■', danger: '▲', nodata: '○' }

/** "■ WATCH" — the one way a state is shown. */
export function StateTag({ state, children, className = '' }: { state: State; children?: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold tracking-wider uppercase ${stateText[state]} ${className}`}>
      <span aria-hidden>{stateGlyph[state]}</span>
      {children ?? STATE_WORD[state]}
    </span>
  )
}

/** Big status tile: LABEL / STATE / value. Danger gets hazard stripes. */
export function StatusTile({ label, state, word, value }: { label: string; state: State; word?: string; value?: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={`${label}: ${word ?? STATE_WORD[state]}${typeof value === 'string' ? `, ${value}` : ''}`}
      className={`border-2 bg-hollow-900 ${stateBorder[state]}`}
    >
      {state === 'danger' && <div className="hazard h-2" aria-hidden />}
      <div className="px-3 py-2">
        <div className="font-mono text-sm tracking-[0.15em] text-hollow-300 uppercase">{label}</div>
        <div className={`font-mono text-xl font-bold tracking-wide uppercase ${stateText[state]}`}>
          <span aria-hidden>{stateGlyph[state]} </span>
          {word ?? STATE_WORD[state]}
        </div>
        {value !== undefined && <div className="font-mono text-xs tracking-wider text-hollow-300 uppercase">{value}</div>}
      </div>
    </div>
  )
}

/** Small persistent trust indicator: "● STORED ON THIS DEVICE". */
export function Trust({ children, tone = 'ok' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'danger' | 'muted' }) {
  const color = { ok: 'text-ok', warn: 'text-warn', danger: 'text-danger', muted: 'text-hollow-500' }[tone]
  const glyph = { ok: '●', warn: '■', danger: '▲', muted: '○' }[tone]
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-sm tracking-wider text-hollow-300 uppercase">
      <span className={color} aria-hidden>
        {glyph}
      </span>
      {children}
    </span>
  )
}

export type BadgeTone = 'ok' | 'warn' | 'danger' | 'muted' | 'lamp' | 'data'

const badgeClass: Record<BadgeTone, string> = {
  ok: 'text-ok border-ok',
  warn: 'text-warn border-warn',
  danger: 'text-danger border-danger',
  muted: 'text-hollow-300 border-hollow-700',
  data: 'text-data border-data',
  lamp: 'text-lamp border-lamp',
}

export function Badge({ tone = 'muted', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-sm font-bold tracking-wider uppercase ${badgeClass[tone]}`}>
      {children}
    </span>
  )
}

/** Marks anything simulated in this demo. */
export function SimTag({ children = 'simulated' }: { children?: ReactNode }) {
  return (
    <span className="border border-dashed border-hollow-500 px-1.5 py-0.5 font-mono text-xs text-hollow-500 uppercase">
      {children}
    </span>
  )
}
