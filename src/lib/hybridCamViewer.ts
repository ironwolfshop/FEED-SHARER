import {
  createCamViewer,
  type CamSlotId,
} from './camWebRtc'
import { createPeerCamViewer } from './peerCam'

type Status = 'connecting' | 'live' | 'idle' | 'error'

/**
 * Prefer PeerJS (domain phone publishers), fall back to the local Vite hub.
 * Uses a proxy <video> for the local viewer so it never steals a live PeerJS stream.
 */
export function createHybridCamViewer(opts: {
  slotId: CamSlotId | string
  accessCode: string
  video: HTMLVideoElement
  onStatus?: (status: Status) => void
}) {
  let mode: 'none' | 'peer' | 'local' = 'none'
  let peerStatus: Status = 'connecting'
  let localStatus: Status = 'idle'

  const emit = () => {
    if (mode === 'peer') opts.onStatus?.(peerStatus === 'live' ? 'live' : peerStatus)
    else if (mode === 'local') opts.onStatus?.(localStatus === 'live' ? 'live' : localStatus)
    else {
      const s =
        peerStatus === 'connecting' || localStatus === 'connecting'
          ? 'connecting'
          : peerStatus === 'error' || localStatus === 'error'
            ? 'error'
            : 'idle'
      opts.onStatus?.(s)
    }
  }

  const peer = createPeerCamViewer({
    slotId: opts.slotId,
    accessCode: opts.accessCode,
    video: opts.video,
    onStatus: (s) => {
      peerStatus = s
      if (s === 'live') mode = 'peer'
      else if (mode === 'peer') mode = 'none'
      emit()
    },
  })

  const proxy = document.createElement('video')
  proxy.playsInline = true
  proxy.muted = true
  proxy.autoplay = true

  const local = createCamViewer({
    slotId: opts.slotId,
    video: proxy,
    onStatus: (s) => {
      localStatus = s
      if (s === 'live' && mode !== 'peer') {
        mode = 'local'
        if (opts.video.srcObject !== proxy.srcObject) {
          opts.video.srcObject = proxy.srcObject
        }
        void opts.video.play().catch(() => undefined)
      } else if (s !== 'live' && mode === 'local') {
        mode = 'none'
        if (opts.video.srcObject === proxy.srcObject) {
          opts.video.srcObject = null
        }
      }
      emit()
    },
  })

  emit()

  return {
    stop() {
      peer.stop()
      local.stop()
      proxy.srcObject = null
    },
  }
}
