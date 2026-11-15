// Each browser tab acts as a separate device in the demo.
// SIMULATED: IndexedDB is shared across tabs of one origin, so each tab gets its own device id
// (kept in sessionStorage so it survives reloads) and its own IndexedDB database.
// `?device=<name>` pins an id, handy for re-opening the same "phone" in a demo.

const KEY = 'lantern-device-id'

function randomId(): string {
  return Math.random().toString(36).slice(2, 8)
}

export function getDeviceId(): string {
  const fromUrl = new URLSearchParams(location.search).get('device')
  if (fromUrl && /^[\w-]{1,32}$/.test(fromUrl)) {
    sessionStorage.setItem(KEY, fromUrl)
    return fromUrl
  }
  let id = sessionStorage.getItem(KEY)
  if (!id) {
    id = randomId()
    sessionStorage.setItem(KEY, id)
  }
  return id
}
