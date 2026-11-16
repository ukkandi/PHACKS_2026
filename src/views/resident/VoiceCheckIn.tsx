// Hold to speak. Say "I'm okay", "I need help", "power out" or "need water"; Lantern shows what it
// heard and what it will do, and nothing is sent until you confirm.
import { useEffect, useRef, useState } from 'react'
import { Button, StateTag } from '../../components/ui'
import { createRecognizer, INTENT_LABEL, parseUtterance, voiceSupported, type Recognizer, type VoiceIntent } from '../../lib/voice'

type Phase = 'idle' | 'listening' | 'heard' | 'sent' | 'error'

const ERROR_TEXT = {
  'no-speech': "Didn't hear anything.",
  'not-allowed': 'Microphone is blocked. Allow it, or use the buttons.',
  unavailable: 'Voice needs a connection on this phone. Use the buttons.',
  other: "Didn't catch that.",
} as const

export function VoiceCheckIn({ onIntent, big = false }: { onIntent: (i: VoiceIntent) => Promise<void>; big?: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [heard, setHeard] = useState('')
  const [intent, setIntent] = useState<VoiceIntent | null>(null)
  const [error, setError] = useState('')
  const rec = useRef<Recognizer | null>(null)
  const viaPointer = useRef(false)
  const supported = voiceSupported()

  useEffect(() => {
    rec.current = createRecognizer({
      onResult: (t) => {
        setHeard(t)
        setIntent(parseUtterance(t))
        setPhase('heard')
      },
      onError: (r) => {
        setError(ERROR_TEXT[r])
        setPhase('error')
      },
      onEnd: () => setPhase((p) => (p === 'listening' ? 'idle' : p)),
    })
    return () => rec.current?.abort()
  }, [])

  if (!supported) {
    return (
      <div role="note" className="border-2 border-dashed border-hollow-700 px-3 py-2">
        <StateTag state="nodata">Voice not available here · use the buttons</StateTag>
      </div>
    )
  }

  const start = () => {
    setHeard('')
    setIntent(null)
    setError('')
    setPhase('listening')
    rec.current?.start()
  }
  const stop = () => rec.current?.stop()

  return (
    <section aria-label="Voice check-in" className="space-y-2">
      <button
        type="button"
        aria-pressed={phase === 'listening'}
        aria-label={
          phase === 'listening'
            ? 'Listening. Release, or activate again, to stop.'
            : "Hold to speak. Say I'm okay, I need help, power out, or need water."
        }
        onPointerDown={(e) => {
          viaPointer.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          start()
        }}
        onPointerUp={() => stop()}
        onPointerCancel={() => stop()}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && phase !== 'listening') {
            e.preventDefault()
            viaPointer.current = true
            start()
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            stop()
          }
        }}
        onClick={() => {
          // Screen readers (e.g. VoiceOver double-tap) send a plain click: tap to start, tap to stop.
          if (viaPointer.current) {
            viaPointer.current = false
            return
          }
          if (phase === 'listening') stop()
          else start()
        }}
        className={`block w-full touch-none border-4 font-mono font-bold tracking-[0.1em] uppercase select-none ${
          big ? 'min-h-32 text-3xl' : 'min-h-16 text-xl'
        } ${phase === 'listening' ? 'border-lamp bg-lamp text-hollow-950' : 'border-lamp bg-hollow-950 text-lamp'}`}
      >
        {phase === 'listening' ? '● Listening… release to stop' : '◉ Hold to speak'}
      </button>

      <div aria-live="polite" className="space-y-2">
        {phase === 'heard' && (
          <div className="border-2 border-lamp bg-hollow-900 p-3">
            <div className="font-mono text-sm tracking-wider text-hollow-300 uppercase">Heard</div>
            <div className="text-lg">“{heard}”</div>
            {intent ? (
              <>
                <div className="mt-1 font-mono text-base font-bold uppercase">
                  → {intent === 'help' ? '▲' : intent === 'okay' ? '●' : '◆'} {INTENT_LABEL[intent]}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    tone={intent === 'help' ? 'danger' : 'primary'}
                    className="min-h-14 text-base"
                    onClick={() => {
                      void onIntent(intent).then(() => setPhase('sent'))
                    }}
                  >
                    Confirm · send
                  </Button>
                  <Button className="min-h-14" onClick={() => setPhase('idle')}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <StateTag state="watch">Not sure what you meant · try again or tap a button</StateTag>
            )}
          </div>
        )}
        {phase === 'sent' && intent && <StateTag state="normal">Sent · {INTENT_LABEL[intent]}</StateTag>}
        {phase === 'error' && <StateTag state="watch">{error}</StateTag>}
      </div>
    </section>
  )
}
