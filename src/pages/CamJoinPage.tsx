import { useEffect, useRef, useState } from 'react'
import {
  createCamPublisher,
  isCamSlotId,
  openCamera,
  type CamSlotId,
} from '../lib/camWebRtc'
import { createPeerCamPublisher, useCloudCams } from '../lib/peerCam'
import { ensureObsSync } from '../lib/obsSync'
import {
  codesMatch,
  initCamsSync,
  useCamsStore,
} from '../store/camsStore'

/** One phone per blue / red / caster. */
export default function CamJoinPage() {
  const store = useCamsStore()
  const cloud = useCloudCams()
  const [code, setCode] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [slot, setSlot] = useState<CamSlotId | null>(null)
  const [live, setLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const localPubRef = useRef<ReturnType<typeof createCamPublisher> | null>(null)
  const peerPubRef = useRef<ReturnType<typeof createPeerCamPublisher> | null>(
    null,
  )

  useEffect(() => {
    if (!cloud) ensureObsSync()
    initCamsSync()
    document.documentElement.style.background = '#071018'
    document.body.style.background = '#071018'
  }, [cloud])

  useEffect(() => {
    return () => {
      localPubRef.current?.stop()
      peerPubRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (slot) useCamsStore.getState().setSlotLive(slot, false)
    }
  }, [slot])

  function unlock(e: React.FormEvent) {
    e.preventDefault()
    const entered = code.trim().toUpperCase()
    if (!entered) {
      setError('Enter the access code')
      return
    }
    if (!cloud && !codesMatch(entered, store.accessCode)) {
      setError('Wrong access code')
      return
    }
    store.setAccessCode(entered)
    setError(null)
    setUnlocked(true)
  }

  function pickSlot(next: CamSlotId) {
    const taken =
      (next === 'blue' && store.blueLive) ||
      (next === 'red' && store.redLive) ||
      (next === 'caster' && store.casterLive)
    if (taken) {
      setError(
        next === 'caster'
          ? 'Shoutcaster is already live — only one phone.'
          : `${next === 'blue' ? 'Blue' : 'Red'} is already live — only one phone per color.`,
      )
      return
    }
    setError(null)
    setSlot(next)
  }

  async function publish() {
    if (!slot || !isCamSlotId(slot)) return
    const alreadyLive =
      (slot === 'blue' && store.blueLive) ||
      (slot === 'red' && store.redLive) ||
      (slot === 'caster' && store.casterLive)
    if (alreadyLive) {
      setError(
        'This color is already live — only one phone per blue/red. Stop the other phone first.',
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      localPubRef.current?.stop()
      peerPubRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())

      const stream = await openCamera()
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }

      const label =
        slot === 'blue'
          ? store.blueName
          : slot === 'red'
            ? store.redName
            : store.casterName

      if (!cloud) {
        localPubRef.current = createCamPublisher({
          slotId: slot,
          stream,
          label,
        })
      }

      await new Promise<void>((resolve, reject) => {
        let settled = false
        const timer = window.setTimeout(() => {
          if (!settled) {
            settled = true
            resolve()
          }
        }, 6000)
        peerPubRef.current = createPeerCamPublisher({
          slotId: slot,
          accessCode: store.accessCode,
          stream,
          onReady: () => {
            if (settled) return
            settled = true
            window.clearTimeout(timer)
            resolve()
          },
          onError: (message) => {
            if (message === 'slot-taken') {
              if (settled) return
              settled = true
              window.clearTimeout(timer)
              reject(
                new Error(
                  'This color is already live — only one phone per blue/red. Stop the other phone first.',
                ),
              )
            }
          },
        })
      })

      setLive(true)
      store.setSlotLive(slot, true)
    } catch (err) {
      localPubRef.current?.stop()
      localPubRef.current = null
      peerPubRef.current?.stop()
      peerPubRef.current = null
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      setError(
        err instanceof Error
          ? err.message
          : 'Camera blocked — use HTTPS and allow camera',
      )
      setLive(false)
      store.setSlotLive(slot, false)
    } finally {
      setBusy(false)
    }
  }

  function stop() {
    localPubRef.current?.stop()
    localPubRef.current = null
    peerPubRef.current?.stop()
    peerPubRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setLive(false)
    if (slot) store.setSlotLive(slot, false)
  }

  const slotName =
    slot === 'blue'
      ? store.blueName
      : slot === 'red'
        ? store.redName
        : slot === 'caster'
          ? store.casterName
          : ''

  return (
    <div className="min-h-screen bg-[#071018] px-4 py-8 text-white font-ui">
      <div className="mx-auto w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="text-[11px] font-bold tracking-[0.35em] text-teal-300">
            FEED SHARER
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold">Join with code</h1>
          <p className="mt-1 text-sm text-slate-400">{store.matchName}</p>
        </div>

        {!unlocked ? (
          <form
            onSubmit={unlock}
            className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <label className="block text-sm">
              <span className="mb-1.5 block text-slate-400">Access code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                placeholder="Enter code"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3.5 text-center text-2xl font-bold tracking-[0.2em] text-white"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-teal-600 py-3.5 text-lg font-bold hover:bg-teal-500"
            >
              Enter
            </button>
            {error && (
              <p className="text-center text-sm text-rose-300">{error}</p>
            )}
          </form>
        ) : !slot ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-center text-sm text-slate-300">
              Which camera?{' '}
              <span className="text-slate-500">(one phone per color)</span>
            </p>
            <button
              type="button"
              disabled={store.casterLive}
              onClick={() => pickSlot('caster')}
              className="w-full rounded-xl bg-amber-600 py-4 text-lg font-bold hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {store.casterName}
              <span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-amber-100/80">
                {store.casterLive ? 'Already live' : 'Shoutcaster window'}
              </span>
            </button>
            <button
              type="button"
              disabled={store.blueLive}
              onClick={() => pickSlot('blue')}
              className="w-full rounded-xl bg-sky-600 py-4 text-lg font-bold hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {store.blueName}
              {store.blueLive ? (
                <span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-sky-100/80">
                  Already live
                </span>
              ) : null}
            </button>
            <button
              type="button"
              disabled={store.redLive}
              onClick={() => pickSlot('red')}
              className="w-full rounded-xl bg-rose-600 py-4 text-lg font-bold hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {store.redName}
              {store.redLive ? (
                <span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-rose-100/80">
                  Already live
                </span>
              ) : null}
            </button>
            {error && (
              <p className="text-center text-sm text-rose-300">{error}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`rounded-2xl border p-3 text-center ${
                slot === 'blue'
                  ? 'border-sky-400/40 bg-sky-950/40'
                  : slot === 'red'
                    ? 'border-rose-400/40 bg-rose-950/40'
                    : 'border-amber-400/40 bg-amber-950/40'
              }`}
            >
              <div className="text-xs tracking-widest text-slate-400">
                {store.matchName}
              </div>
              <div className="mt-1 text-xl font-bold">{slotName}</div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="aspect-[4/3] w-full scale-x-[-1] object-cover"
              />
            </div>

            {!live ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void publish()}
                className="w-full rounded-2xl bg-emerald-600 py-4 text-xl font-extrabold hover:bg-emerald-500 disabled:opacity-60"
              >
                {busy ? 'Connecting…' : 'Publish feed'}
              </button>
            ) : (
              <button
                type="button"
                onClick={stop}
                className="w-full rounded-2xl bg-rose-700 py-4 text-xl font-extrabold hover:bg-rose-600"
              >
                Stop feed
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stop()
                setSlot(null)
              }}
              className="w-full text-sm text-slate-400 underline"
            >
              Switch camera
            </button>

            {error && (
              <p className="text-center text-sm text-rose-300">{error}</p>
            )}
            {live && (
              <p className="text-center text-sm font-bold text-emerald-300">
                LIVE — keep this page open
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
