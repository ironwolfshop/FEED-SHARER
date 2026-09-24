import { useEffect } from 'react'
import { absoluteUrl, useLanOrigins } from '../lib/lanOrigins'
import { initCamsSync, useCamsStore } from '../store/camsStore'

const PHONE_PORT = 5174

/** Operator desk — access code + copy links for phones and OBS localhost. */
export default function CamsControlPage() {
  const store = useCamsStore()
  const origins = useLanOrigins()

  useEffect(() => {
    initCamsSync()
    document.documentElement.style.background = '#071018'
    document.body.style.background = '#071018'
  }, [])

  const phoneLan =
    origins.lanIps[0] != null
      ? `https://${origins.lanIps[0]}:${PHONE_PORT}`
      : null
  const joinPhone = phoneLan ? `${phoneLan}/cam` : `https://YOUR-LAN-IP:${PHONE_PORT}/cam`
  const joinLocal = absoluteUrl(origins.local, '/cam')

  function copy(text: string) {
    void navigator.clipboard.writeText(text).catch(() => undefined)
  }

  const feeds = [
    { label: `${store.blueName} cam`, path: '/overlay/cam/blue', live: store.blueLive, tone: 'sky' as const },
    { label: `${store.redName} cam`, path: '/overlay/cam/red', live: store.redLive, tone: 'rose' as const },
    { label: `${store.casterName} cam`, path: '/overlay/cam/caster', live: store.casterLive, tone: 'amber' as const },
  ]

  return (
    <div className="min-h-screen px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <header className="text-center">
          <div className="text-[11px] font-bold tracking-[0.35em] text-teal-300">
            FEED SHARER
          </div>
          <h1 className="mt-1 text-2xl font-bold">Share cams to OBS</h1>
          <p className="mt-1 text-sm text-slate-400">
            Phones use HTTPS (:{PHONE_PORT}). OBS uses HTTP localhost (:5173).
          </p>
        </header>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-400">Access code (give to players)</span>
            <input
              value={store.accessCode}
              onChange={(e) => store.setAccessCode(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-center text-2xl font-bold tracking-[0.25em]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-400">Match name</span>
            <input
              value={store.matchName}
              onChange={(e) => store.setMatchName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              <span className="mb-1 block text-sky-300/80">Blue name</span>
              <input
                value={store.blueName}
                onChange={(e) => store.setTeamName('blue', e.target.value)}
                className="w-full rounded-xl border border-sky-500/30 bg-black/40 px-2 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-rose-300/80">Red name</span>
              <input
                value={store.redName}
                onChange={(e) => store.setTeamName('red', e.target.value)}
                className="w-full rounded-xl border border-rose-500/30 bg-black/40 px-2 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-amber-300/80">Shoutcaster label</span>
            <input
              value={store.casterName}
              onChange={(e) => store.setCasterName(e.target.value)}
              className="w-full rounded-xl border border-amber-500/30 bg-black/40 px-2 py-2"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-teal-500/40 bg-teal-950/40 p-4">
          <div className="text-sm font-bold text-teal-100">1. Send this to players (phones)</div>
          <code className="mt-2 block break-all rounded-lg bg-black/50 px-3 py-3 text-sm text-teal-200">
            {joinPhone}
          </code>
          <button
            type="button"
            onClick={() => copy(joinPhone)}
            className="mt-3 w-full rounded-xl bg-teal-600 py-3.5 text-lg font-bold hover:bg-teal-500"
          >
            Copy player link
          </button>
          <p className="mt-2 text-xs text-slate-400">
            Same Wi‑Fi. Accept the certificate warning, then enter code{' '}
            <b className="text-white">{store.accessCode}</b>.
          </p>
        </section>

        <section className="rounded-2xl border border-sky-500/30 bg-sky-950/30 p-4">
          <div className="text-sm font-bold text-sky-100">Localhost test (this PC)</div>
          <code className="mt-2 block break-all rounded-lg bg-black/50 px-3 py-2 text-xs text-sky-200">
            {joinLocal}
          </code>
          <button
            type="button"
            onClick={() => copy(joinLocal)}
            className="mt-3 w-full rounded-xl bg-sky-700 py-3 font-bold hover:bg-sky-600"
          >
            Copy localhost join
          </button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-sm font-bold">2. OBS Browser Sources (HTTP localhost)</div>
          <div className="space-y-3">
            {feeds.map((row) => (
              <div
                key={row.path}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${row.live ? 'bg-emerald-400' : 'bg-slate-600'}`}
                  />
                  <span
                    className={
                      row.tone === 'sky'
                        ? 'text-sky-300'
                        : row.tone === 'rose'
                          ? 'text-rose-300'
                          : 'text-amber-300'
                    }
                  >
                    {row.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate text-[11px] text-slate-300">
                    {absoluteUrl(origins.local, row.path)}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(absoluteUrl(origins.local, row.path))}
                    className="rounded bg-slate-700 px-2 py-1 text-xs font-bold hover:bg-slate-600"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Use HTTP localhost in OBS — not HTTPS (OBS rejects the self-signed cert).
          </p>
        </section>
      </div>
    </div>
  )
}
