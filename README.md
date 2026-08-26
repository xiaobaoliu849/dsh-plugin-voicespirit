# Echo Plugin for DeepSeek Harness

[中文文档](README.zh.md) | English

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-brightgreen.svg)](https://github.com/topics/dsh-plugin)

**Echo for DeepSeek Harness** is a realtime duplex voice interaction plugin built on top of [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) and powered by [Cordis](https://github.com/cordiverse/cordis). (Echo is the new product name of the VoiceSpirit backend; internal identifiers — package names, routes, settings keys — still use `voicespirit`.)

It brings low-latency streaming voice conversation, intelligent VAD interruption, dynamic live waveform visualizer HUD, and multi-modal call UI experiences directly into your DeepSeek Harness Web interface — **with the harness managing the Echo backend for you**: it spawns the backend on boot, proxies the realtime audio WebSocket (so the browser never needs CORS or a credential), and gives you a full settings card for providers, API keys, and the backend lifecycle.

---

## ✨ Features

- 🚀 **Zero-touch backend lifecycle**: the harness probes `127.0.0.1:8000` on boot and spawns the Echo FastAPI backend as a managed child process when nothing answers. Start/stop, health, and a live log tail are one click in Settings.
- 🔐 **Credential-free browser**: the realtime WebSocket is piped through the harness (`/api/voicespirit/ws`). The host injects backend authentication; API keys live in the backend's own config document and are edited through the proxied settings routes.
- 🎙️ **Realtime Duplex Voice Calls**: ultra-low latency voice exchange powered by streaming audio pipelines (PCM16 16 kHz up / 24 kHz down).
- ⚡ **Intelligent VAD & Interruption**: automatically pauses or cancels ongoing speech generation when user starts talking.
- 🌊 **Live Waveform & Audio HUD**: responsive audio spectrum animation for both user and agent speech, plus an immersive full-screen call view.
- 🎛️ **Full settings card** (Settings → Plugins → Echo (voicespirit)):
  - Backend: directory, Python interpreter, port, data directory, auto-start, access token for external backends, log tail.
  - Providers: DashScope / Google / OpenAI / Doubao / Cartesia / PersonaPlex / GLM4Voice with model + voice selection and backend-side model discovery.
  - Keys: per-provider credential fields written straight into the backend config (`api_keys`, `realtime_api_urls`, …), with "configured" markers.
- 🧩 **Modular Cordis Architecture**: client UI (`@deepseek-ai/dsh-client-ui-voicespirit`) and host bridge (`@deepseek-ai/dsh-host-voicespirit`), wired through the standard harness plugin composition.

---

## 📁 Repository Structure

```text
dsh-plugin-voicespirit/
├── packages/
│   ├── client-ui/   # Frontend plugin (@deepseek-ai/dsh-client-ui-voicespirit)
│   │   └── src/     # Audio engine, controller, call dock, settings card
│   └── host/        # Backend bridge (@deepseek-ai/dsh-host-voicespirit)
│       └── src/     # Gateway lifecycle, /api/voicespirit routes, WS proxy
├── scripts/
│   └── start-voicespirit-harness.ps1  # One-click startup script
├── README.md
└── README.zh.md
```

---

## 🚀 Quick Start

### 1. Requirements
- Node.js >= 20, pnpm >= 9
- DeepSeek Harness (`dsh`)
- An Echo (VoiceSpirit) checkout (default `D:\voicespirit`) with its Python venv — the harness launches `python -m uvicorn main:app` from `<checkout>\backend` for you

### 2. Integration into DeepSeek Harness

Copy `packages/client-ui` → `packages/client/ui-voicespirit` and `packages/host` → `packages/host/voicespirit` inside the harness workspace (or reference this repo), then declare the two rows in your `cordis.patch.yml`:

```yaml
- insert:
    # Host bridge: backend lifecycle + browser routes
    - id: host-voicespirit
      name: '@deepseek-ai/dsh-host-voicespirit'

    # Browser roster: call dock, quick settings, settings card
    - id: ui-voicespirit
      name: '@deepseek-ai/dsh-client-ui-voicespirit'
```

Building happens inside the harness workspace (`pnpm build`), where the `workspace:^` peer dependencies resolve.

### 3. Run

```bash
./scripts/start-voicespirit-harness.ps1
# or simply
pnpm dsh web
```

The backend starts automatically (auto-start can be turned off in the settings card). Open the harness web UI: a mic button appears at the right of the composer; starting a call brings the backend up if needed.

---

## ⚙️ Configuration

Everything is configured in the web UI:

- **Settings → Plugins → Echo (voicespirit)** (full card):
  - 后端服务 — backend directory, Python path, port, data directory, auto-start, start/stop, log tail.
  - 语音服务商 — provider, model (with "fetch models" from the backend), voice.
  - 服务商密钥 — the selected provider's credential fields (e.g. DashScope API key + realtime WebSocket URL, Doubao API key + realtime WebSocket URL, Cartesia + DeepSeek keys). Saved into the backend's own config document through the harness proxy.
- **Call dock quick settings** (gear icon while calling): one-click provider/model/voice switch and backend status.

### Data directories

By default the harness gives the backend its own data directory (`~/.dsh/voicespirit`). On first launch the backend seeds it from the checkout's legacy `config.json`, so existing provider keys are inherited while the desktop app's login database stays separate (the harness authenticates with its own injected token). Point `dataDir` at `%APPDATA%\VoiceSpirit` to share state with the desktop app instead; for an externally started, auth-enabled backend, paste an access token into the `apiToken` field.

### HTTP surface (host routes)

| Route | Purpose |
|---|---|
| `GET /api/voicespirit/status` | Backend phase, health, resolved settings |
| `POST /api/voicespirit/backend/start` / `stop` | Lifecycle commands |
| `GET /api/voicespirit/backend/log` | Recent backend output |
| `GET`/`PUT /api/voicespirit/settings` | Proxied backend settings document |
| `POST /api/voicespirit/models/fetch` | Provider model discovery |
| `WS /api/voicespirit/ws` | Realtime voice-chat pipe (auth injected host-side) |

---

## 🤝 Contributing

Issues and pull requests are welcome! If you have suggestions or bug reports, feel free to open an issue or start a discussion.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
