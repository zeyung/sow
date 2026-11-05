export const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'] as const
export type Year = (typeof YEARS)[number]
export type Signup = { firstName: string; lastName: string; email: string; year: Year }

const EDU = /^[^\s@]+@(?:[a-z0-9-]+\.)+edu$/i
export const isEduEmail = (v: string) => EDU.test(v.trim())

// Point this at your real backend in production (e.g. VITE_WAITLIST_ENDPOINT=https://api.example.com/waitlist).
// In `npm run dev` / `npm run preview`, the Vite plugin in vite.config.ts answers /api/waitlist and saves to data/waitlist.json.
const ENDPOINT = import.meta.env.VITE_WAITLIST_ENDPOINT ?? '/api/waitlist'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(ENDPOINT + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
  return data as T
}

export const joinWaitlist = (s: Signup) => post<{ id: string }>('', s)
export const sendAnswer = (id: string, answer: string) => post<{ ok: true }>('/answer', { id, answer })
