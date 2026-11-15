/** Mood 1–5 as a little five-bar meter (decorative; the button label carries the meaning). */
export function MoodIcon({ value, size = 22 }: { value: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={1 + i * 3.8}
          y={16 - (i + 1) * 3}
          width={2.6}
          height={(i + 1) * 3}
          rx={1}
          fill="currentColor"
          opacity={i < value ? 1 : 0.22}
        />
      ))}
    </svg>
  )
}
