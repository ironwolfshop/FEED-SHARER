import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { isCamSlotId } from '../lib/camWebRtc'
import { createPeerCamViewer } from '../lib/peerCam'
import { initCamsSync, useCamsStore } from '../store/camsStore'

/** OBS / browser — `/overlay/cam/blue|red|caster?code=CME24` */
export default function CamOverlayPage() {
  const { side = 'blue' } = useParams()
  const [params] = useSearchParams()
  const slotId = isCamSlotId(side) ? side : 'blue'
  const storeCode = useCamsStore((s) => s.accessCode)
  const accessCode = (params.get('code') || storeCode || 'CME24').toUpperCase()
  const matchName = useCamsStore((s) => s.matchName)
  const label = useCamsStore((s) =>
    slotId === 'blue'
      ? s.blueName
      : slotId === 'red'
        ? s.redName
        : s.casterName,
  )
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'connecting' | 'live' | 'idle' | 'error'>(
    'connecting',
  )

  useEffect(() => {
    initCamsSync()
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const viewer = createPeerCamViewer({
      slotId,
      accessCode,
      video,
      onStatus: setStatus,
    })
    return () => viewer.stop()
  }, [slotId, accessCode])

  return (
    <div className="overlay-root overflow-hidden bg-transparent">
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />
      {status !== 'live' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 font-ui text-white">
          <div className="text-xs tracking-[0.3em] text-teal-300">
            {matchName}
          </div>
          <div className="mt-2 text-3xl font-bold">{label}</div>
          <div className="mt-3 text-xs uppercase tracking-widest text-slate-400">
            {status === 'connecting' && 'Waiting for phone…'}
            {status === 'idle' && 'Offline — is the phone still publishing?'}
            {status === 'error' && 'Reconnecting…'}
          </div>
          <div className="mt-2 text-[10px] tracking-wider text-slate-500">
            code {accessCode} · {slotId}
          </div>
        </div>
      )}
      {status === 'live' && (
        <div className="absolute bottom-8 left-8 rounded bg-black/55 px-3 py-1.5 font-ui text-sm font-bold text-white">
          {label}
        </div>
      )}
    </div>
  )
}
