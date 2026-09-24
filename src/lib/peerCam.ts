import Peer, { type DataConnection, type MediaConnection } from 'peerjs'
import type { CamSlotId } from './camWebRtc'

export function camRoomId(accessCode: string, slotId: string) {
  const code =
    accessCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'CME24'
  return `cme-feed-${code}-${slotId}`
}

function peerOpts(id?: string) {
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  }
  return id
    ? { debug: 1 as const, config }
    : { debug: 1 as const, config }
}

function makePeer(id?: string) {
  return id ? new Peer(id, peerOpts(id)) : new Peer(peerOpts())
}

/**
 * Publish camera via PeerJS cloud.
 * Viewers open a data channel; publisher then calls them with the video stream.
 */
export function createPeerCamPublisher(opts: {
  slotId: CamSlotId | string
  accessCode: string
  stream: MediaStream
}) {
  const id = camRoomId(opts.accessCode, opts.slotId)
  let peer: Peer | null = null
  let alive = true
  const calls = new Set<MediaConnection>()
  const conns = new Set<DataConnection>()

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

  function bindPeer(p: Peer) {
    p.on('open', () => {
      /* waiting for viewers */
    })

    p.on('connection', (conn) => {
      conns.add(conn)
      conn.on('data', (raw) => {
        const data = raw as { type?: string; viewerId?: string }
        if (data?.type === 'hello' && data.viewerId) {
          callViewer(data.viewerId)
        }
      })
      conn.on('open', () => {
        // Some clients send hello before we bind; ask again
        try {
          conn.send({ type: 'ready' })
        } catch {
          /* ignore */
        }
      })
      conn.on('close', () => conns.delete(conn))
    })

    // Also answer if a viewer dials us (legacy / fallback)
    p.on('call', (call) => {
      if (!alive) {
        call.close()
        return
      }
      call.answer(opts.stream)
      calls.add(call)
      call.on('close', () => calls.delete(call))
      call.on('error', () => calls.delete(call))
    })

    p.on('error', (err) => {
      const type = String((err as { type?: string })?.type || '')
      if ((type === 'unavailable-id' || type === 'peer-unavailable') && alive) {
        try {
          p.destroy()
        } catch {
          /* ignore */
        }
        window.setTimeout(() => {
          if (alive) start()
        }, 1000)
      }
    })
  }

  function start() {
    try {
      peer?.destroy()
    } catch {
      /* ignore */
    }
    peer = makePeer(id)
    bindPeer(peer)
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
      for (const c of conns) {
        try {
          c.close()
        } catch {
          /* ignore */
        }
      }
      conns.clear()
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

  function attachCall(next: MediaConnection) {
    call = next
    next.on('stream', (stream) => {
      if (opts.video.srcObject !== stream) {
        opts.video.srcObject = stream
      }
      void opts.video.play().catch(() => undefined)
      live = true
      opts.onStatus?.('live')
    })
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
    try {
      peer?.destroy()
    } catch {
      /* ignore */
    }

    peer = makePeer()

    peer.on('open', (myId) => {
      if (!alive || !peer) return

      // Receive when publisher calls us
      peer.on('call', (incoming) => {
        incoming.answer()
        attachCall(incoming)
      })

      // Tell publisher to call us
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
        if (!live) {
          opts.onStatus?.('idle')
          scheduleRetry()
        }
      })
      conn.on('close', () => {
        if (!live) scheduleRetry()
      })

      // Fallback: we dial publisher with a silent canvas stream
      window.setTimeout(() => {
        if (!alive || live || !peer) return
        try {
          const canvas = document.createElement('canvas')
          canvas.width = 2
          canvas.height = 2
          const dummy = canvas.captureStream(1)
          const outbound = peer.call(target, dummy)
          if (outbound) attachCall(outbound)
        } catch {
          /* ignore */
        }
      }, 1200)
    })

    peer.on('error', () => {
      if (!live) opts.onStatus?.('error')
      scheduleRetry()
    })
  }

  function scheduleRetry() {
    if (!alive || retryTimer != null) return
    retryTimer = window.setTimeout(() => {
      retryTimer = null
      if (!live) connect()
    }, 2500)
  }

  connect()

  return {
    roomId: target,
    stop() {
      alive = false
      if (retryTimer != null) window.clearTimeout(retryTimer)
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
