import { defineConfig, type Plugin, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * Local stand-in for the waitlist backend. Answers POST /api/waitlist and
 * POST /api/waitlist/answer during `vite` and `vite preview`, storing rows in data/waitlist.json.
 * In production, set VITE_WAITLIST_ENDPOINT to a real backend with the same two routes.
 */
function waitlistDev(): Plugin {
  type Row = { id: string; firstName: string; lastName: string; email: string; year: string; answer?: string; createdAt: string; answeredAt?: string }
  const file = path.resolve(process.cwd(), 'data/waitlist.json')
  const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']
  const EDU = /^[^\s@]+@(?:[a-z0-9-]+\.)+edu$/i
  const read = (): Row[] => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      return []
    }
  }
  const write = (rows: Row[]) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(rows, null, 2))
  }
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (req.method !== 'POST') return next()
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 20_000) req.destroy()
    })
    req.on('end', () => {
      const send = (status: number, body: unknown) => {
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(body))
      }
      let body: Record<string, unknown>
      try {
        body = JSON.parse(raw || '{}')
      } catch {
        return send(400, { error: 'Bad JSON' })
      }
      const rows = read()
      const route = (req.url || '/').split('?')[0]
      if (route === '/' || route === '') {
        const firstName = String(body.firstName ?? '').trim().slice(0, 80)
        const lastName = String(body.lastName ?? '').trim().slice(0, 80)
        const email = String(body.email ?? '').trim().toLowerCase()
        const year = String(body.year ?? '')
        if (!firstName || !lastName) return send(400, { error: 'First and last name are required.' })
        if (!EDU.test(email)) return send(400, { error: 'A .edu email is required.' })
        if (!YEARS.includes(year)) return send(400, { error: 'Pick a year.' })
        const existing = rows.find((r) => r.email === email)
        if (existing) {
          Object.assign(existing, { firstName, lastName, year })
          write(rows)
          return send(200, { id: existing.id })
        }
        const row: Row = { id: crypto.randomUUID(), firstName, lastName, email, year, createdAt: new Date().toISOString() }
        rows.push(row)
        write(rows)
        return send(201, { id: row.id })
      }
      if (route === '/answer') {
        const row = rows.find((r) => r.id === body.id)
        if (!row) return send(404, { error: 'Unknown signup.' })
        row.answer = String(body.answer ?? '').trim().slice(0, 1000)
        row.answeredAt = new Date().toISOString()
        write(rows)
        return send(200, { ok: true })
      }
      return next()
    })
  }
  return {
    name: 'sow-waitlist-dev',
    configureServer: (server) => void server.middlewares.use('/api/waitlist', handler),
    configurePreviewServer: (server) => void server.middlewares.use('/api/waitlist', handler),
  }
}

// GitHub Pages serves the site from /sow/; local dev stays at /
export default defineConfig(({ command }) => ({
  base: command === 'build' && process.env.PAGES_BASE ? process.env.PAGES_BASE : '/',
  plugins: [react(), waitlistDev()],
}))
