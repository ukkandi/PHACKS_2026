import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Tone = 'default' | 'primary' | 'danger' | 'ghost'

const toneClass: Record<Tone, string> = {
  default: 'bg-hollow-800 hover:bg-hollow-700 text-cream border border-hollow-700 hover:border-hollow-500',
  primary: 'bg-lamp hover:brightness-110 text-hollow-950 font-semibold shadow-[0_0_24px_-6px_rgb(242_163_58/0.6)]',
  danger: 'bg-danger/20 hover:bg-danger/30 text-cream border border-danger/70',
  ghost: 'bg-transparent hover:bg-hollow-800 text-hollow-300',
}

export function Button({
  tone = 'default',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      type="button"
      className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${toneClass[tone]} ${className}`}
      {...rest}
    />
  )
}

export function Card({
  title,
  right,
  children,
  className = '',
}: {
  title?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-hollow-700 bg-hollow-900 p-4 sm:p-5 ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-mono text-xs font-medium tracking-widest text-hollow-300 uppercase">{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

export type BadgeTone = 'ok' | 'warn' | 'danger' | 'muted' | 'lamp' | 'data'

const badgeClass: Record<BadgeTone, string> = {
  ok: 'bg-ok/15 text-ok border-ok/40',
  warn: 'bg-warn/15 text-warn border-warn/40',
  danger: 'bg-danger/15 text-danger border-danger/40',
  muted: 'bg-hollow-800 text-hollow-300 border-hollow-700',
  data: 'bg-data/15 text-data border-data/40',
  lamp: 'bg-lamp/15 text-lamp border-lamp/40',
}

export function Badge({ tone = 'muted', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] ${badgeClass[tone]}`}>
      {children}
    </span>
  )
}

/** Small in-world label used to mark anything that is simulated in this demo. */
export function SimTag({ children = 'simulated' }: { children?: ReactNode }) {
  return (
    <span className="rounded border border-dashed border-hollow-500 px-1.5 py-0.5 font-mono text-[10px] text-hollow-500 uppercase">
      {children}
    </span>
  )
}
