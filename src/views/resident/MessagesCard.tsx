import { useState, type FormEvent } from 'react'
import { Button, Card, Trust } from '../../components/ui'
import { describeRoute, hopCount } from '../../lib/mesh'
import { useFamily } from '../../stores/familyStore'
import { tickLabel } from '../../sim/world'

// Short labels on the buttons; the full sentence is what's sent.
const QUICK = [
  { label: "I'm safe", text: "I'm safe." },
  { label: 'Power out', text: 'Power is out here.' },
  { label: 'Need water', text: 'Need water.' },
  { label: 'Coming up', text: 'Coming up to you.' },
]

export function MessagesCard() {
  const { messages, sendMessage } = useFamily()
  const [text, setText] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void sendMessage(text)
    setText('')
  }

  return (
    <Card title="Family messages" right={<Trust>No network needed</Trust>}>
      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {QUICK.map((q) => (
          <Button key={q.label} className="min-h-14" onClick={() => void sendMessage(q.text)}>
            {q.label}
          </Button>
        ))}
      </div>
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <label className="sr-only" htmlFor="msg">
          Message
        </label>
        <input
          id="msg"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={280}
          placeholder="Message…"
          className="min-h-12 flex-1 border-2 border-hollow-700 bg-hollow-950 px-3 font-mono text-sm"
        />
        <Button type="submit" tone="primary" disabled={!text.trim()}>
          Send
        </Button>
      </form>
      <ol tabIndex={0} aria-label="Family messages" className="max-h-72 space-y-1 overflow-auto" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={`border-l-4 px-2 py-1 ${m.mine ? 'border-lamp bg-hollow-950' : 'border-data bg-hollow-800'}`}>
            <div className="font-mono text-[11px] tracking-wider text-hollow-300 uppercase">
              {m.mine ? 'You' : m.name} · L{m.level} · {tickLabel(m.tick)}
            </div>
            <div>{m.text}</div>
            {!m.mine && (
              <Trust>
                Via {hopCount(m.route)} hop{hopCount(m.route) === 1 ? '' : 's'} · {describeRoute(m.route)}
              </Trust>
            )}
          </li>
        ))}
        {messages.length === 0 && <li className="font-mono text-xs text-hollow-500 uppercase">No messages</li>}
      </ol>
    </Card>
  )
}
