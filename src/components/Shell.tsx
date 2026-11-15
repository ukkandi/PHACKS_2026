import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LanternMark } from './LanternMark'

export function Shell({
  view,
  children,
  aside,
  simulator = false,
}: {
  view: string
  children: ReactNode
  aside?: ReactNode
  /** The demo-only World Simulator gets its own non-Lantern header so nobody mistakes it for the product. */
  simulator?: boolean
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-hollow-800 pb-3">
        {simulator ? (
          <Link to="/" className="flex items-center gap-2 font-mono text-lg font-bold text-sim">
            <span aria-hidden>⚙</span> World Simulator
            <span className="text-sm font-normal text-hollow-300">· demo only</span>
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold text-cream">
            <LanternMark size={30} /> Lantern
            <span className="font-mono text-xs font-normal tracking-wider text-hollow-300 uppercase">/ {view}</span>
          </Link>
        )}
        {aside}
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <footer className="mt-10 border-t border-hollow-800 pt-4 font-mono text-[11px] tracking-wide text-hollow-500 uppercase">
        Fictional demo · the Hollow, 2087 · all data simulated · personal data never leaves this device
      </footer>
    </div>
  )
}
