import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Equipment frame: a thin system bar on top, the content, a one-line footer. */
export function Shell({
  view,
  children,
  aside,
  simulator = false,
  className = '',
}: {
  view: string
  children: ReactNode
  aside?: ReactNode
  /** The demo-only World Simulator gets its own non-Lantern bar so nobody mistakes it for the product. */
  simulator?: boolean
  className?: string
}) {
  return (
    <div className={`min-h-screen ${className}`}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-3 py-3 sm:px-4">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b-2 border-hollow-700 pb-2">
          {simulator ? (
            <Link to="/" className="font-mono text-sm font-bold tracking-[0.15em] text-sim uppercase">
              ⚙ World Simulator <span className="font-normal text-hollow-300">// demo only</span>
            </Link>
          ) : (
            <Link to="/" className="font-mono text-sm font-bold tracking-[0.15em] text-lamp uppercase">
              Lantern <span className="font-normal text-hollow-300">// {view}</span>
            </Link>
          )}
          {aside}
        </header>
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <footer className="mt-8 border-t-2 border-hollow-800 pt-2 font-mono text-[10px] tracking-wider text-hollow-500 uppercase">
          Simulated demo · The Hollow 2087
        </footer>
      </div>
    </div>
  )
}
