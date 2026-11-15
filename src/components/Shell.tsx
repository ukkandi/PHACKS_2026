import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function Shell({ view, children, aside }: { view: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-hollow-800 pb-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-lamp">
          <span aria-hidden>◉</span> Lantern
          <span className="text-sm font-normal text-hollow-300">/ {view}</span>
        </Link>
        {aside}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-8 text-xs text-hollow-500">
        Fictional demo · the Hollow, 2087 · all data simulated · personal data never leaves this device
      </footer>
    </div>
  )
}
