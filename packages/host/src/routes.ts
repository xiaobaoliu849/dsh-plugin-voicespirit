/**
 * Browser routes over the VoiceSpirit backend. Exact paths under /api win the
 * webserver's longest-prefix match against the api-gateway's /api prefix, so
 * this surface composes beside it without touching the trust fence there.
 *
 * The management routes answer from the gateway directly; the settings and
 * model routes proxy the backend's own /api/settings face with the strongest
 * token in hand; the realtime upgrade pipes frames verbatim between the
 * browser and the backend voice-chat WebSocket, folding authentication in so
 * the browser never holds a credential.
 */

import { WebSocket, WebSocketServer } from 'ws'
import type { Duplex } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebUpgradeRoute } from '@deepseek-ai/dsh-host-webserver'
import type { VoiceSpiritGateway } from './gateway.ts'
import { toPublicSettings } from './settings.ts'

/** Route prefix owned by the VoiceSpirit surface. */
export const VOICESPIRIT_API_PATH = '/api/voicespirit'

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  if (chunks.length === 0) return undefined
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'))
  } catch {
    return undefined
  }
}

/**
 * Register the management/proxy routes and the realtime upgrade.
 * @param ctx - host context with `webServer` composed.
 * @param gateway - the backend lifecycle + proxy face.
 */
export function registerVoiceSpiritRoutes(ctx: Context, gateway: VoiceSpiritGateway): void {
  const respondProxyResult = (
    res: ServerResponse,
    result: { ok: true; value: unknown } | { ok: false; status: number; message: string },
  ): void => {
    if (result.ok) json(res, 200, { ok: true, value: result.value })
    else json(res, result.status, { ok: false, error: result.message })
  }

  const routes: Array<{ kind: 'exact'; path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> }> = [
    {
      kind: 'exact',
      path: `${VOICESPIRIT_API_PATH}/status`,
      handler: async (_req, res) => {
        const status = await gateway.status()
        json(res, 200, {
          ok: true,
          backend: status,
          settings: toPublicSettings(gateway.settings),
        })
      },
    },
    {
      kind: 'exact',
      path: `${VOICESPIRIT_API_PATH}/backend/start`,
      handler: async (_req, res) => {
        const status = await gateway.start()
        json(res, 200, { ok: status.healthy, backend: status })
      },
    },
    {
      kind: 'exact',
      path: `${VOICESPIRIT_API_PATH}/backend/stop`,
      handler: async (_req, res) => {
        const status = await gateway.stop()
        json(res, 200, { ok: true, backend: status })
      },
    },
    {
      kind: 'exact',
      path: `${VOICESPIRIT_API_PATH}/backend/log`,
      handler: async (req, res) => {
        const lines = Number(new URL(req.url ?? '/', 'http://x').searchParams.get('lines') ?? '120')
        json(res, 200, { ok: true, lines: gateway.log.tail(Number.isFinite(lines) ? lines : 120) })
      },
    },
    {
      kind: 'exact',
      path: `${VOICESPIRIT_API_PATH}/settings`,
      handler: async (req, res) => {
        if (req.method === 'GET') {
          respondProxyResult(res, await gateway.getBackendSettings())
          return
        }
        if (req.method !== 'PUT') {
          json(res, 405, { ok: false, error: 'GET or PUT required' })
          return
        }
        const body = await readJsonBody(req)
        if (body === undefined || typeof body !== 'object' || body === null) {
          json(res, 400, { ok: false, error: 'a JSON settings patch object is required' })
          return
        }
        respondProxyResult(res, await gateway.putBackendSettings(body))
      },
    },
    {
      kind: 'exact',
      path: `${VOICESPIRIT_API_PATH}/models/fetch`,
      handler: async (req, res) => {
        const body = await readJsonBody(req) as { provider?: string; apiKey?: string; baseUrl?: string } | undefined
        if (typeof body?.provider !== 'string' || body.provider === '') {
          json(res, 400, { ok: false, error: 'provider is required' })
          return
        }
        respondProxyResult(res, await gateway.fetchProviderModels(body.provider, body.apiKey, body.baseUrl))
      },
    },
    {
      // EverMemOS conversation group registration. Credentials stay server
      // side: the gateway composes the X-EverMem-* headers from the backend's
      // stored memory_settings before forwarding.
      kind: 'exact',
      path: `${VOICESPIRIT_API_PATH}/evermem/conversation-meta`,
      handler: async (req, res) => {
        const body = await readJsonBody(req) as { groupId?: string } | undefined
        respondProxyResult(
          res,
          await gateway.createEvermemConversationMeta(
            typeof body?.groupId === 'string' ? body.groupId : undefined,
          ),
        )
      },
    },
    {
      kind: 'exact',
      path: `${VOICESPIRIT_API_PATH}/tts/speak`,
      handler: async (req, res) => {
        const query = new URL(req.url ?? '/', 'http://x').search
        const result = await gateway.proxyRaw(`/api/tts/speak${query}`, { method: 'GET' })
        if (!result.ok) {
          json(res, result.status, { ok: false, error: result.message })
          return
        }
        const contentType = result.response.headers.get('content-type') || 'audio/mpeg'
        res.writeHead(200, { 'content-type': contentType })
        if (result.response.body) {
          const reader = result.response.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(value)
          }
        }
        res.end()
      },
    },
  ]
  for (const route of routes) {
    ctx.effect(() => ctx.webServer.register(route), `host-voicespirit: ${route.kind} ${route.path}`)
  }

  ctx.effect(() => ctx.webServer.registerUpgrade({
    path: `${VOICESPIRIT_API_PATH}/ws`,
    handler: (req, socket, head) => { void proxyVoiceChatWebSocket(ctx, gateway, req, socket, head) },
  }), 'host-voicespirit: realtime WebSocket proxy')
}

/**
 * Pipe one browser realtime WebSocket to the backend voice-chat endpoint.
 * The browser socket is accepted first so failures surface as a close code
 * the client engine can translate, never as a dead handshake.
 */
async function proxyVoiceChatWebSocket(
  ctx: Context,
  gateway: VoiceSpiritGateway,
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): Promise<void> {
  const downstream = new WebSocketServer({ noServer: true })
  downstream.handleUpgrade(req, socket, head, (client) => {
    const query = new URL(req.url ?? '/', 'http://x').searchParams
    const upstream = new WebSocket(gateway.upstreamVoiceChatUrl(new URLSearchParams(query)), {
      handshakeTimeout: 10_000,
    })
    let closed = false
    // Frames the browser sends while the upstream handshake is still in
    // flight (the engine posts its memory config straight from onopen).
    // Dropped frames here would silently disable memory for the whole call.
    const pendingFrames: Array<{ data: WebSocket.RawData, isBinary: boolean }> = []
    const MAX_PENDING_FRAMES = 64
    const closeDownstream = (code: number, reason: string): void => {
      if (closed) return
      closed = true
      try { client.close(code, reason.slice(0, 100)) } catch { client.terminate() }
      try { upstream.close() } catch { upstream.terminate() }
    }
    const upstreamTimeout = setTimeout(() => {
      if (upstream.readyState !== WebSocket.OPEN) {
        ctx.logger.warn('host-voicespirit: upstream handshake timed out after 10s')
        closeDownstream(1013, 'VoiceSpirit backend connection timed out')
      }
    }, 10_000)

    const flushPending = (): void => {
      clearTimeout(upstreamTimeout)
      // Send text/JSON control frames (e.g. config) before binary audio frames
      const textFrames = pendingFrames.filter(f => !f.isBinary)
      const binFrames = pendingFrames.filter(f => f.isBinary)
      for (const frame of textFrames) {
        upstream.send(frame.data, { binary: false })
      }
      for (const frame of binFrames) {
        upstream.send(frame.data, { binary: true })
      }
      pendingFrames.length = 0
    }
    upstream.on('open', () => {
      clearTimeout(upstreamTimeout)
      ctx.logger.debug('host-voicespirit: realtime upstream connected')
      flushPending()
    })
    upstream.on('message', (data, isBinary) => {
      if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary })
    })
    client.on('message', (data, isBinary) => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(data, { binary: isBinary })
        return
      }
      if (pendingFrames.length < MAX_PENDING_FRAMES) {
        pendingFrames.push({ data, isBinary })
      } else {
        ctx.logger.warn('host-voicespirit: dropped a client frame — upstream still connecting and buffer full')
      }
    })
    upstream.on('close', (code, reason) => {
      closeDownstream(code, reason.toString('utf-8') || 'upstream closed')
    })
    client.on('close', () => {
      if (closed) return
      closed = true
      try { upstream.close() } catch { upstream.terminate() }
    })
    upstream.on('error', (error: Error) => {
      ctx.logger.warn(error)
      closeDownstream(1013, 'VoiceSpirit backend is not reachable — start it in settings')
    })
    client.on('error', () => {
      if (!closed) {
        closed = true
        try { upstream.close() } catch { upstream.terminate() }
      }
    })
  })
}

/** The upgrade route type this module registers, exported for tests. */
export type VoiceSpiritUpgradeRoute = WebUpgradeRoute
