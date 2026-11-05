import { useEffect, useRef, useState, type FormEvent } from 'react'
import { YEARS, isEduEmail, joinWaitlist, sendAnswer, type Year } from './waitlistApi'

type Step = 'form' | 'question' | 'done'
type Errors = { first?: string; last?: string; email?: string; year?: string; form?: string }

export const QUESTION = 'What would you want to see in a social or dating app made for your campus?'

export default function Waitlist() {
  const [step, setStep] = useState<Step>('form')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [year, setYear] = useState<Year | ''>('')
  const [answer, setAnswer] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [id, setId] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)
  const headRef = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)

  // move focus to the new step's heading so screen readers hear the change
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    headRef.current?.focus({ preventScroll: true })
  }, [step])

  const join = async (e: FormEvent) => {
    e.preventDefault()
    const next: Errors = {}
    if (!first.trim()) next.first = 'Enter your first name.'
    if (!last.trim()) next.last = 'Enter your last name.'
    if (!email.trim()) next.email = 'Enter your school email.'
    else if (!isEduEmail(email)) next.email = 'Use your school email. It should end in .edu.'
    if (!year) next.year = 'Pick your year.'
    setErrors(next)
    const bad = (['first', 'last', 'email', 'year'] as const).find((k) => next[k])
    if (bad) {
      const el = document.getElementById(bad === 'year' ? 'wl-year-Freshman' : `wl-${bad}`)
      el?.focus({ preventScroll: true })
      return
    }
    setBusy(true)
    try {
      const r = await joinWaitlist({ firstName: first.trim(), lastName: last.trim(), email: email.trim().toLowerCase(), year: year as Year })
      setId(r.id)
      setStep('question')
    } catch (err) {
      console.warn('[waitlist]', err)
      setErrors({ form: 'We couldn’t add you just now. Check your connection and try again.' })
    } finally {
      setBusy(false)
    }
  }

  const submitAnswer = async (e: FormEvent) => {
    e.preventDefault()
    if (!id || !answer.trim()) return
    setBusy(true)
    try {
      await sendAnswer(id, answer.trim())
      setAnswered(true)
      setStep('done')
    } catch (err) {
      console.warn('[waitlist]', err)
      setErrors({ form: 'That didn’t send. Try again, or skip. You’re already on the list.' })
    } finally {
      setBusy(false)
    }
  }

  const firstName = first.trim()

  if (step === 'question')
    return (
      <form className="wl" onSubmit={submitAnswer} noValidate>
        <p className="wl__step">Step 2 of 2 · optional</p>
        <h3 className="wl__title" ref={headRef} tabIndex={-1}>
          You’re on the list{firstName ? `, ${firstName}` : ''}.
        </h3>
        <label className="wl__label" htmlFor="wl-answer">
          {QUESTION}
        </label>
        <textarea
          id="wl-answer"
          className="wl__input wl__area"
          rows={4}
          maxLength={1000}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Features, the vibe, what other apps get wrong…"
        />
        {errors.form && <p className="wl__err" role="alert">{errors.form}</p>}
        <div className="wl__row">
          <button type="submit" className="wl__submit" disabled={busy || !answer.trim()}>
            {busy ? 'Sending…' : 'Send answer'}
          </button>
          <button type="button" className="wl__ghost" onClick={() => setStep('done')} disabled={busy}>
            Skip
          </button>
        </div>
      </form>
    )

  if (step === 'done')
    return (
      <div className="wl" role="status">
        <p className="wl__step">All set</p>
        <h3 className="wl__title" ref={headRef} tabIndex={-1}>
          {answered ? 'Thanks. We read every answer.' : 'That’s everything.'}
        </h3>
        <p className="wl__note">
          We’ll email <b>{email.trim().toLowerCase()}</b> when Sow opens at your school.
        </p>
      </div>
    )

  return (
    <form className="wl" onSubmit={join} noValidate aria-describedby="wl-intro">
      <p className="wl__step wl__step--end" id="wl-intro">Join the waitlist</p>

      <div className="wl__pair">
        <div className="wl__field">
          <label className="wl__label" htmlFor="wl-first">First name</label>
          <input
            id="wl-first"
            className="wl__input"
            autoComplete="given-name"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            aria-invalid={!!errors.first}
            aria-describedby={errors.first ? 'wl-first-err' : undefined}
          />
          {errors.first && <p className="wl__err" id="wl-first-err">{errors.first}</p>}
        </div>
        <div className="wl__field">
          <label className="wl__label" htmlFor="wl-last">Last name</label>
          <input
            id="wl-last"
            className="wl__input"
            autoComplete="family-name"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            aria-invalid={!!errors.last}
            aria-describedby={errors.last ? 'wl-last-err' : undefined}
          />
          {errors.last && <p className="wl__err" id="wl-last-err">{errors.last}</p>}
        </div>
      </div>

      <div className="wl__field">
        <label className="wl__label" htmlFor="wl-email">School email</label>
        <input
          id="wl-email"
          className="wl__input"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'wl-email-err' : undefined}
          placeholder="you@school.edu"
        />
        {errors.email && <p className="wl__err" id="wl-email-err">{errors.email}</p>}
      </div>

      <fieldset className="wl__field wl__years" aria-invalid={!!errors.year} aria-describedby={errors.year ? 'wl-year-err' : undefined}>
        <legend className="wl__label">Year in school</legend>
        <div className="wl__pills">
          {YEARS.map((y) => (
            <label key={y} className="wl__pill">
              <input
                type="radio"
                name="year"
                id={`wl-year-${y}`}
                value={y}
                checked={year === y}
                onChange={() => setYear(y)}
              />
              <span>{y}</span>
            </label>
          ))}
        </div>
        {errors.year && <p className="wl__err" id="wl-year-err">{errors.year}</p>}
      </fieldset>

      {errors.form && <p className="wl__err" role="alert">{errors.form}</p>}
      <button type="submit" className="wl__submit" disabled={busy}>
        {busy ? 'Joining…' : 'Join the waitlist'}
      </button>
    </form>
  )
}
