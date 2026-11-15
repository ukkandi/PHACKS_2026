/** The Lantern mark: a hanging lantern with a lit flame. Decorative unless given a title. */
export function LanternMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d="M12 5a4 4 0 0 1 8 0" fill="none" stroke="#F2A33A" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 8h12l-2 3h-8z" fill="#F2A33A" />
      <rect x="10.5" y="11" width="11" height="13" rx="3" fill="#2A241F" stroke="#F2A33A" strokeWidth="1.6" />
      <path d="M16 14c2 2.4 2.6 4 2.6 5.2A2.6 2.6 0 0 1 16 21.8a2.6 2.6 0 0 1-2.6-2.6c0-1.2.6-2.8 2.6-5.2z" fill="#F2A33A" />
      <path d="M16 17.2c.9 1.1 1.2 1.9 1.2 2.4a1.2 1.2 0 0 1-2.4 0c0-.5.3-1.3 1.2-2.4z" fill="#F2EBDD" />
      <path d="M11 24h10l-1.5 3h-7z" fill="#F2A33A" />
    </svg>
  )
}
