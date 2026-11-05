import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { GlyphField, type Scene } from './GlyphField'
import Waitlist from './Waitlist'

gsap.registerPlugin(ScrollTrigger)

const asset = (n: string) => new URL(`./assets/${n}.webp`, import.meta.url).href
const SRC_ROSE = asset('src-rose')
const SRC_CHAIN = asset('src-chain')
const BG = { field: asset('bg-field'), meadow: asset('bg-meadow'), windowBlur: asset('bg-window-blur'), window: asset('bg-window') }

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const chapterOf = (p: number) => smooth(0.12, 0.3, p) + smooth(0.42, 0.6, p)
const releaseOf = (p: number) => smooth(0.7, 0.9, p)
const STOPS = [0, 0.36, 0.64, 1]

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(src))
    img.src = src
  })
}

/** the wordmark, typed white on black so it can be sampled like a photo */
function wordmark(lines: string[]) {
  const fs = 300
  const font = `400 ${fs}px "Instrument Serif", serif`
  const c = document.createElement('canvas')
  const m = c.getContext('2d')!
  m.font = font
  const tw = Math.ceil(Math.max(...lines.map((l) => m.measureText(l).width)))
  const lh = fs * 0.92
  c.width = tw + 40
  c.height = Math.round(lh * lines.length + fs * 0.2)
  const x = c.getContext('2d')!
  x.fillStyle = '#000'
  x.fillRect(0, 0, c.width, c.height)
  x.fillStyle = '#fff'
  x.font = font
  x.textBaseline = 'middle'
  x.textAlign = 'center'
  lines.forEach((l, i) => x.fillText(l, c.width / 2, fs * 0.1 + lh * (i + 0.55)))
  return c
}

export default function Hero() {
  const trackRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const finalRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<GlyphField | null>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const stRef = useRef<ScrollTrigger | null>(null)
  const progressRef = useRef(0)
  const reduced = usePrefersReducedMotion()

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [referMsg, setReferMsg] = useState('')
  const [isTouch] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)

  /* ------------------------------------------------ load + engine */
  useEffect(() => {
    let alive = true
    let cleanup = () => {}
    Promise.all([
      loadImage(SRC_ROSE),
      loadImage(SRC_CHAIN),
      document.fonts?.load('400 100px "Instrument Serif"').catch(() => null),
      document.fonts?.load('500 12px "IBM Plex Mono"').catch(() => null),
    ])
      .then(([rose, chain]) => {
        const stage = stageRef.current
        const canvas = canvasRef.current
        if (!alive || !stage || !canvas) return
        const word = wordmark(['Sow'])
        const scenes: Scene[] = [
          {
            // the rose, standing to the right of the headline
            source: rose,
            threshold: 0.17,
            rect: (w, h, m) => {
              const hh = m ? Math.min(h * 0.5, (w * 0.96) / 0.75) : h * 0.86
              return { cx: m ? w * 0.5 : w * 0.76, cy: h * (m ? 0.56 : 0.53), w: hh * 0.75, h: hh }
            },
          },
          {
            // two links, joined
            source: chain,
            threshold: 0.2,
            rect: (w, h, m) =>
              m ? { cx: w * 0.5, cy: h * 0.58, w: w * 0.94, h: h * 0.36 } : { cx: w * 0.73, cy: h * 0.52, w: w * 0.46, h: h * 0.7 },
          },
          {
            source: word,
            threshold: 0.45,
            rect: (w, h, m) =>
              m ? { cx: w * 0.5, cy: h * 0.5, w: w * 0.9, h: h * 0.4 } : { cx: w * 0.5, cy: h * 0.47, w: w * 0.7, h: h * 0.62 },
          },
        ]
        const field = new GlyphField(canvas, scenes)
        field.reduced = reduced
        fieldRef.current = field
        field.resize(stage.clientWidth, stage.clientHeight)
        field.setStory(chapterOf(progressRef.current), releaseOf(progressRef.current))
        setState('ready')

        let running = false
        let inView = true
        const tick = (_t: number, dtMs: number) => field.step(dtMs / 1000)
        const sync = () => {
          const want = inView && !document.hidden
          if (want && !running) gsap.ticker.add(tick)
          if (!want && running) gsap.ticker.remove(tick)
          running = want
        }
        const io = new IntersectionObserver(([e]) => {
          inView = e.isIntersecting
          sync()
        })
        if (trackRef.current) io.observe(trackRef.current)
        document.addEventListener('visibilitychange', sync)
        sync()
        let rw = stage.clientWidth
        const ro = new ResizeObserver(() => {
          // ignore the phone URL bar sliding in and out; rebuild on real resizes
          if (Math.abs(stage.clientWidth - rw) < 2 && field.mobile) return
          rw = stage.clientWidth
          field.resize(stage.clientWidth, stage.clientHeight)
        })
        ro.observe(stage)
        cleanup = () => {
          gsap.ticker.remove(tick)
          io.disconnect()
          ro.disconnect()
          document.removeEventListener('visibilitychange', sync)
          fieldRef.current = null
        }
      })
      .catch((err) => {
        console.warn('[sow]', err)
        if (alive) setState('error')
      })
    return () => {
      alive = false
      cleanup()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (fieldRef.current) fieldRef.current.reduced = reduced
  }, [reduced, state])

  /* ------------------------------------------------ pointer: wind + pulses */
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const local = (x: number, y: number) => {
      const r = stage.getBoundingClientRect()
      return { x: x - r.left, y: y - r.top }
    }
    const onUi = (t: EventTarget | null) => t instanceof Element && !!t.closest('button, a, input, textarea, select, label, .wl')
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const p = local(e.clientX, e.clientY)
      fieldRef.current?.pointer(p.x, p.y)
    }
    const down = (e: PointerEvent) => {
      if (onUi(e.target)) return
      const p = local(e.clientX, e.clientY)
      fieldRef.current?.pulse(p.x, p.y)
    }
    const touch = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t || onUi(e.target)) return
      const p = local(t.clientX, t.clientY)
      fieldRef.current?.pointer(p.x, p.y)
    }
    const leave = (e: PointerEvent) => e.pointerType !== 'touch' && fieldRef.current?.leave()
    stage.addEventListener('pointermove', move)
    stage.addEventListener('pointerdown', down)
    stage.addEventListener('pointerleave', leave)
    stage.addEventListener('touchstart', touch, { passive: true })
    stage.addEventListener('touchmove', touch, { passive: true })
    return () => {
      stage.removeEventListener('pointermove', move)
      stage.removeEventListener('pointerdown', down)
      stage.removeEventListener('pointerleave', leave)
      stage.removeEventListener('touchstart', touch)
      stage.removeEventListener('touchmove', touch)
    }
  }, [])

  /* ------------------------------------------------ smooth scroll */
  useEffect(() => {
    if (reduced) return
    const lenis = new Lenis({ lerp: 0.085 })
    lenisRef.current = lenis
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (t: number) => lenis.raf(t * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [reduced])

  /* ------------------------------------------------ intro + scroll story */
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const ctx = gsap.context(() => {
      if (!reduced) {
        gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.15 })
          .from('.sg-bg__in', { scale: 1.12, opacity: 0, duration: 2.4 }, 0)
          .from('.sg-top > *', { opacity: 0, y: -8, duration: 1, stagger: 0.08 }, 0.2)
          .from('.sg-head .li', { yPercent: 110, duration: 1.6, stagger: 0.1 }, 0.35)
          .from('.sg-sub__in, .sg-dock__in', { opacity: 0, y: 10, duration: 1.2, stagger: 0.1 }, 0.9)
      }

      const target = { p: 0 } // fresh per run: a StrictMode revert can't zero a shared object
      const apply = (p: number) => {
        progressRef.current = p
        fieldRef.current?.setStory(chapterOf(p), releaseOf(p))
        // keep the hidden form out of the tab order until the finale shows
        if (finalRef.current) finalRef.current.inert = p < 0.9
      }
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
      tl.to(target, { p: 1, duration: 1, onUpdate: () => apply(target.p) }, 0)
        .to('.sg-head, .sg-sub, .sg-dock', { opacity: 0, y: -20, duration: 0.05, stagger: 0.012 }, 0.04)
        .to('.sg-bg--meadow', { opacity: 1, duration: 0.1 }, 0.18)
        .to('.sg-bg--wblur', { opacity: 1, duration: 0.1 }, 0.48)
        .to('.sg-bg--window', { opacity: 1, duration: 0.14 }, 0.74)
        .fromTo('.sg-bg', { scale: 1.08 }, { scale: 1, duration: 1 }, 0)
        .fromTo('.sg-head2', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.06 }, 0.24)
        .to('.sg-head2', { opacity: 0, y: -24, duration: 0.05 }, 0.42)
        .to('.sg-shade', { opacity: 0.15, duration: 0.14 }, 0.74)
        .fromTo('.sg-final', { opacity: 0, y: 30, pointerEvents: 'none' }, { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.07 }, 0.9)

      stRef.current = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        animation: reduced ? undefined : tl,
        scrub: reduced ? false : 0.7,
        onUpdate(self) {
          if (!reduced) return
          const p = self.progress > 0.85 ? 1 : self.progress > 0.55 ? STOPS[2] : self.progress > 0.2 ? STOPS[1] : 0
          tl.progress(p)
          apply(p)
        },
      })
      apply(0)
    }, stageRef)
    return () => {
      stRef.current = null
      ctx.revert()
    }
  }, [reduced])

  const scrollToProgress = (p: number, onDone?: () => void) => {
    const st = stRef.current
    if (!st) return
    const y = st.start + (st.end - st.start) * p
    if (lenisRef.current) lenisRef.current.scrollTo(y, { duration: p === 0 ? 2.6 : 1.8, onComplete: onDone })
    else {
      window.scrollTo({ top: y, behavior: 'auto' })
      if (onDone) requestAnimationFrame(() => requestAnimationFrame(onDone))
    }
  }
  const next = () => {
    const p = progressRef.current
    const n = STOPS.find((s) => s > p + 0.02) ?? 1
    scrollToProgress(n)
  }
  const goJoin = () =>
    scrollToProgress(1, () => {
      if (finalRef.current) finalRef.current.inert = false
      const el = document.getElementById('wl-first') ?? finalRef.current?.querySelector<HTMLElement>('.wl__title')
      el?.focus({ preventScroll: true })
    })
  const refer = async () => {
    const url = window.location.origin + window.location.pathname
    const data = { title: 'Sow', text: 'Join the Sow waitlist with your .edu email.', url }
    try {
      if (navigator.share) return await navigator.share(data)
      await navigator.clipboard.writeText(url)
      setReferMsg('Link copied')
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      setReferMsg('Copy failed')
    }
    window.setTimeout(() => setReferMsg(''), 2200)
  }

  return (
    <main className="sg-root" data-state={state}>
      <section ref={trackRef} className="sg-track" aria-label="Sow, a campus social app. Waitlist for .edu emails.">
        <div ref={stageRef} className="sg-stage">
          <div className="sg-bg" aria-hidden="true">
            <div className="sg-bg__in">
              <img className="sg-bg__img sg-bg--field" src={BG.field} alt="" />
              <img className="sg-bg__img sg-bg--meadow" src={BG.meadow} alt="" />
              <img className="sg-bg__img sg-bg--wblur" src={BG.windowBlur} alt="" />
              <img className="sg-bg__img sg-bg--window" src={BG.window} alt="" />
            </div>
          </div>
          <div className="sg-dusk" aria-hidden="true" />
          <div className="sg-shade" aria-hidden="true" />
          <canvas
            ref={canvasRef}
            className="sg-glyphs"
            role="img"
            aria-label="A rose, then two joined chain links, then the word Sow, each typed out of glowing text characters"
          />
          <div className="sg-grain" aria-hidden="true" />

          <header className="sg-top">
            <span className="sg-top__l">
              <button type="button" className="sg-top__link" onClick={refer}>
                Refer a friend
              </button>
              <span className="sg-top__msg" role="status">{referMsg}</span>
            </span>
            <span className="sg-top__c">Sow</span>
            <span className="sg-top__r">
              <button type="button" className="sg-top__join" onClick={goJoin}>
                Join waitlist
              </button>
            </span>
          </header>

          <h1 className="sg-head">
            <span className="ln"><span className="li">We’re sowing</span></span>
            <span className="ln"><span className="li">the seeds to</span></span>
            <span className="ln"><span className="li"><em>connection.</em></span></span>
          </h1>

          <p className="sg-head sg-head2" aria-hidden="true">
            <span className="ln">By connecting</span>
            <span className="ln">you to your</span>
            <span className="ln"><em>campus.</em></span>
          </p>

          <div className="sg-sub">
            <p className="sg-sub__in">
              {state === 'error'
                ? 'Some images didn’t load. Check your connection and reload.'
                : isTouch
                  ? 'A social app for college students, opening campus by campus. Drag through the glyphs to scatter them; tap to send a pulse.'
                  : 'A social app for college students, opening campus by campus. Move through the glyphs to scatter them; click to send a pulse.'}
            </p>
          </div>

          <div className="sg-dock">
            <div className="sg-dock__in">
              <button type="button" onClick={next}>Next figure ↓</button>
              <button type="button" className="is-accent" onClick={goJoin}>Join waitlist</button>
            </div>
          </div>

          <div ref={finalRef} className="sg-final" data-lenis-prevent>
            <div className="sg-final__copy">
              <h2 className="sg-final__title">
                Join us in making <br />
                <em>campus fun.</em>
              </h2>
              <button type="button" className="sg-final__btn" onClick={() => scrollToProgress(0)}>
                Scatter again <span aria-hidden="true">↑</span>
              </button>
            </div>
            <div className="sg-final__card">
              <Waitlist />
            </div>
          </div>

          {state === 'loading' && (
            <div className="sg-loader" role="status">
              Sowing…
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
