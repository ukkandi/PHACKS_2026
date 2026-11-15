import { useState, type FormEvent } from 'react'
import { Button, Card } from '../../components/ui'
import { describeRoute, hopCount } from '../../lib/mesh'
import { useFamily } from '../../stores/familyStore'
import { tickLabel } from '../../sim/world'

const QUICK = ["I'm safe.", 'Power is out here.', 'Need water.', 'Coming up to you.']

export function MessagesCard() {
  const { messages, sendMessage } = useFamily()
  const [text, setText] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void sendMessage(text)
    setText('')
  }

  return (
    <Card title="Family messages" right={<span className="text-xs text-hollow-500">no network needed</span>}>
      <div className="mb-2 flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <Button key={q} onClick={() => void sendMessage(q)}>
            {q}
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
          placeholder="Write to your family…"
          className="min-h-11 flex-1 rounded-lg border border-hollow-700 bg-hollow-800 px-3"
        />
        <Button type="submit" tone="primary" disabled={!text.trim()}>
          Send
        </Button>
      </form>
      <ol tabIndex={0} aria-label="Family messages" className="max-h-72 space-y-2 overflow-auto" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={`rounded-lg px-3 py-2 ${m.mine ? 'bg-lamp/10' : 'bg-hollow-800'}`}>
            <div className="text-xs text-hollow-300">
              <strong className="text-white">{m.mine ? 'You' : m.name}</strong> · L{m.level} · {tickLabel(m.tick)}
            </div>
            <div>{m.text}</div>
            {!m.mine && (
              <div className="mt-0.5 font-mono text-[11px] text-hollow-500">
                {hopCount(m.route)} hop{hopCount(m.route) === 1 ? '' : 's'}: {describeRoute(m.route)}
              </div>
            )}
          </li>
        ))}
        {messages.length === 0 && <li className="text-sm text-hollow-500">No messages yet.</li>}
      </ol>
    </Card>
  )
}
