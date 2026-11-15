import { create } from 'zustand'
import { openDeviceDb, type CheckIn, type LanternDB, type Profile } from '../lib/db'
import { getDeviceId } from '../lib/device'

interface ResidentState {
  deviceId: string
  db: LanternDB
  loaded: boolean
  profile: Profile | null
  checkins: CheckIn[]
  load: () => Promise<void>
  saveProfile: (p: Omit<Profile, 'key' | 'memberId' | 'createdAt'>) => Promise<void>
  addCheckIn: (c: Omit<CheckIn, 'id'>) => Promise<CheckIn>
  forgetDevice: () => Promise<void>
}

const deviceId = getDeviceId()

export const useResident = create<ResidentState>((set, get) => ({
  deviceId,
  db: openDeviceDb(deviceId),
  loaded: false,
  profile: null,
  checkins: [],
  load: async () => {
    const { db } = get()
    const [profile, checkins] = await Promise.all([
      db.profile.get('me'),
      db.checkins.orderBy('ts').reverse().limit(60).toArray(),
    ])
    set({ profile: profile ?? null, checkins, loaded: true })
  },
  saveProfile: async (p) => {
    const { db, profile } = get()
    const next: Profile = {
      key: 'me',
      memberId: profile?.memberId ?? crypto.randomUUID().slice(0, 8),
      createdAt: profile?.createdAt ?? Date.now(),
      ...p,
    }
    await db.profile.put(next)
    set({ profile: next })
  },
  addCheckIn: async (c) => {
    const { db } = get()
    const id = await db.checkins.add(c)
    const saved = { ...c, id }
    set({ checkins: [saved, ...get().checkins].slice(0, 60) })
    return saved
  },
  forgetDevice: async () => {
    const { db } = get()
    await db.delete()
    location.reload()
  },
}))
