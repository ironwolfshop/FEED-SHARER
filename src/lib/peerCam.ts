import Peer, { type DataConnection, type MediaConnection } from 'peerjs'
import type { CamSlotId } from './camWebRtc'

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
}

export function camRoomId(accessCode: string, slotId: string) {
  const code =
    accessCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'CME24'
  return `cme-feed-${code}-${slotId}`
}

function createPeer(id?: string) {
  const opts = {
    debug: 1 as const,
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    config: ICE,
  }
  return id ? new Peer(id, opts) : new Peer(opts)
}

/** Publish camera via PeerJS cloud. Resolves when broker accepts the peer id. */
export function createPeerCamPublisher(opts: {
  slotId: CamSlotId | string
  accessCode: string
  stream: MediaStream
  onReady?: () => void
  onError?: (message: string) => void
}) {
  const id = camRoomId(opts.accessCode, opts.slotId)
  let peer: Peer | null = null
  let alive = true
  const calls = new Set<MediaConnection>()
  let retry = 0

  function callViewer(viewerId: string) {
    if (!peer || !alive || !viewerId) return
    try {
      const call = peer.call(viewerId, opts.stream)
      if (!call) return
      calls.add(call)
      call.on('close', () => calls.delete(call))
      call.on('error', () => calls.delete(call))
    } catch {
      /* ignore */
    }
  }

  function start() {
    try {
      peer?.destroy()
    } catch {
      /* ignore */
    }
    if (!alive) return

    peer = createPeer(id)

    peer.on('open', () => {
      retry = 0
      opts.onReady?.()
    })

    peer.on('connection', (conn: DataConnection) => {
      const hello = () => {
        try {
          conn.send({ type: 'ready' })
        } catch {
          /* ignore */
        }
      }
      conn.on('open', hello)
      conn.on('data', (raw) => {
        const data = raw as { type?: string; viewerId?: string }
        if (data?.type === 'hello' && data.viewerId) callViewer(data.viewerId)
      })
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
      const type = String((err as { type?: string })?.type || err)
      opts.onError?.(type)
      if (!alive) return
      if (type === 'unavailable-id' || type === 'network' || type === 'server-error') {
        retry += 1
        const delay = Math.min(8000, 800 * retry)
        window.setTimeout(() => {
          if (alive) start()
        }, delay)
      }
    })
  }

  start()

  return {
    roomId: id,
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
  const target = camRoomId(opts.accessCode, opts.slotId)
  let peer: Peer | null = null
  let call: MediaConnection | null = null
  let conn: DataConnection | null = null
  let alive = true
  let retryTimer: number | null = null
  let live = false
  let dialTimer: number | null = null

  function attachRemoteStream(stream: MediaStream) {
    if (opts.video.srcObject !== stream) opts.video.srcObject = stream
    void opts.video.play().catch(() => undefined)
    live = true
    opts.onStatus?.('live')
  }

  function attachCall(next: MediaConnection) {
    call = next
    next.on('stream', attachRemoteStream)
    next.on('close', () => {
      live = false
      opts.onStatus?.('idle')
      scheduleRetry()
    })
    next.on('error', () => {
      live = false
      opts.onStatus?.('error')
      scheduleRetry()
    })
  }

  function connect() {
    if (!alive) return
    if (!live) opts.onStatus?.('connecting')

    try {
      call?.close()
    } catch {
      /* ignore */
    }
    try {
      conn?.close()
    } catch {
      /* ignore */
    }
    if (dialTimer != null) window.clearTimeout(dialTimer)
    try {
      peer?.destroy()
    } catch {
      /* ignore */
    }

    peer = createPeer()

    peer.on('open', (myId) => {
      if (!alive || !peer) return

      peer.on('call', (incoming) => {
        incoming.answer()
        attachCall(incoming)
      })

      conn = peer.connect(target, { reliable: true })
      conn.on('open', () => {
        try {
          conn?.send({ type: 'hello', viewerId: myId })
        } catch {
          /* ignore */
        }
      })
      conn.on('data', (raw) => {
        const data = raw as { type?: string }
        if (data?.type === 'ready') {
          try {
            conn?.send({ type: 'hello', viewerId: myId })
          } catch {
            /* ignore */
          }
        }
      })
      conn.on('error', () => {
        if (!live) scheduleRetry()
      })

      // Fallback dial: viewer calls publisher
      dialTimer = window.setTimeout(() => {
        if (!alive || live || !peer) return
        try {
          const canvas = document.createElement('canvas')
          canvas.width = 2
          canvas.height = 2
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, 2, 2)
          }
          const dummy = canvas.captureStream(5)
          const outbound = peer.call(target, dummy)
          if (outbound) attachCall(outbound)
        } catch {
          /* ignore */
        }
      }, 900)
    })

    peer.on('error', () => {
      if (!live) {
        opts.onStatus?.('error')
        scheduleRetry()
      }
    })
  }

  function scheduleRetry() {
    if (!alive || retryTimer != null || live) return
    retryTimer = window.setTimeout(() => {
      retryTimer = null
      if (!live) connect()
    }, 2000)
  }

  connect()

  return {
    roomId: target,
    stop() {
      alive = false
      if (retryTimer != null) window.clearTimeout(retryTimer)
      if (dialTimer != null) window.clearTimeout(dialTimer)
      try {
        call?.close()
      } catch {
        /* ignore */
      }
      try {
        conn?.close()
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
