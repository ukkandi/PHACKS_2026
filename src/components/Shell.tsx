import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

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
          <Link to="/" className="flex items-center gap-2 font-mono text-lg font-bold text-sky-300">
            <span aria-hidden>⚙</span> World Simulator
            <span className="text-sm font-normal text-hollow-300">· demo only</span>
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-lamp">
            <span aria-hidden>◉</span> Lantern
            <span className="text-sm font-normal text-hollow-300">/ {view}</span>
          </Link>
        )}
        {aside}
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <footer className="mt-8 text-xs text-hollow-500">
        Fictional demo · the Hollow, 2087 · all data simulated · personal data never leaves this device
      </footer>
    </div>
  )
}
