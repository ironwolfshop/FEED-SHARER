import Peer, { type MediaConnection } from 'peerjs'
import type { CamSlotId } from './camWebRtc'

function roomId(accessCode: string, slotId: string) {
  const code = accessCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'CME24'
  return `cme-feed-${code}-${slotId}`
}

/** Publish camera via PeerJS cloud (works on Vercel / public domain). */
export function createPeerCamPublisher(opts: {
  slotId: CamSlotId | string
  accessCode: string
  stream: MediaStream
}) {
  const id = roomId(opts.accessCode, opts.slotId)
  let peer: Peer | null = null
  let alive = true
  const calls = new Set<MediaConnection>()

  function start() {
    peer = new Peer(id, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    })

    peer.on('open', () => {
      /* ready for viewers to call */
    })

    peer.on('call', (call) => {
      if (!alive) {
        call.close()
        return
      }
      call.answer(opts.stream)
      calls.add(call)
      call.on('close', () => calls.delete(call))
      call.on('error', () => calls.delete(call))
    })

    peer.on('error', (err) => {
      // ID taken — retry with destroy/recreate after short delay
      if (String(err?.type) === 'unavailable-id' && alive) {
        try {
          peer?.destroy()
        } catch {
          /* ignore */
        }
        window.setTimeout(() => {
          if (alive) start()
        }, 800)
      }
    })
  }

  start()

  return {
    stop() {
      alive = false
      for (const c of calls) {
        try {
          c.close()
        } catch {
          /* ignore */
        }
      }
      calls.clear()
      try {
        peer?.destroy()
      } catch {
        /* ignore */
      }
      peer = null
    },
  }
}

/** Watch a published slot via PeerJS cloud. */
export function createPeerCamViewer(opts: {
  slotId: CamSlotId | string
  accessCode: string
  video: HTMLVideoElement
  onStatus?: (status: 'connecting' | 'live' | 'idle' | 'error') => void
}) {
  let peer: Peer | null = null
  let call: MediaConnection | null = null
  let alive = true
  let retryTimer: number | null = null
  const target = roomId(opts.accessCode, opts.slotId)

  function connect() {
    if (!alive) return
    opts.onStatus?.('connecting')
    try {
      peer?.destroy()
    } catch {
      /* ignore */
    }

    peer = new Peer({
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    })

    peer.on('open', () => {
      if (!alive || !peer) return
      call = peer.call(target, new MediaStream())
      if (!call) {
        opts.onStatus?.('idle')
        scheduleRetry()
        return
      }
      call.on('stream', (stream) => {
        opts.video.srcObject = stream
        void opts.video.play().catch(() => undefined)
        opts.onStatus?.('live')
      })
      call.on('close', () => {
        opts.onStatus?.('idle')
        scheduleRetry()
      })
      call.on('error', () => {
        opts.onStatus?.('error')
        scheduleRetry()
      })
    })

    peer.on('error', () => {
      opts.onStatus?.('error')
      scheduleRetry()
    })
  }

  function scheduleRetry() {
    if (!alive || retryTimer != null) return
    retryTimer = window.setTimeout(() => {
      retryTimer = null
      connect()
    }, 2500)
  }

  connect()

  return {
    stop() {
      alive = false
      if (retryTimer != null) window.clearTimeout(retryTimer)
      try {
        call?.close()
      } catch {
        /* ignore */
      }
      try {
        peer?.destroy()
      } catch {
        /* ignore */
      }
      opts.video.srcObject = null
    },
  }
}

export function useCloudCams() {
  if (typeof window === 'undefined') return true
  const host = window.location.hostname
  return host !== 'localhost' && host !== '127.0.0.1'
}
