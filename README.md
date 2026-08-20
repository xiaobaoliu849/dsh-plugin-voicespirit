# VoiceSpirit Plugin for DeepSeek Harness

[中文文档](README.zh.md) | English

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-brightgreen.svg)](https://github.com/topics/dsh-plugin)

**VoiceSpirit for DeepSeek Harness** is a realtime duplex voice interaction plugin built on top of [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) and powered by [Cordis](https://github.com/cordiverse/cordis).

It brings low-latency streaming voice conversation, intelligent VAD interruption, dynamic live waveform visualizer HUD, and multi-modal call UI experiences directly into your DeepSeek Harness Web interface.

---

## ✨ Features

- 🎙️ **Realtime Duplex Voice Calls**: Ultra-low latency voice exchange powered by streaming audio pipelines.
- ⚡ **Intelligent VAD & Interruption**: Automatically pauses or cancels ongoing speech generation when user starts talking.
- 🌊 **Live Waveform & Audio HUD**: Responsive audio spectrum animation providing visual feedback for both user and agent speech.
- 🎛️ **Versatile UI Presentation**:
  - **Dock Bar**: Seamless floating call controls at the bottom of the conversation window.
  - **Immersive Modal**: Full-screen audio calling view with real-time waveform and status indicators.
  - **Customizable Audio Settings**: Easy gateway URL, voice model, and device configuration.
- 🧩 **Modular Cordis Architecture**: Cleanly separated into client UI (`@deepseek-ai/dsh-client-ui-voicespirit`) and host service (`@deepseek-ai/dsh-host-voicespirit`).

---

## 📁 Repository Structure

```text
dsh-plugin-voicespirit/
├── packages/
│   ├── client-ui/   # Frontend plugin (@deepseek-ai/dsh-client-ui-voicespirit)
│   │   ├── src/     # Voice audio engine, HUD components, reactive hooks
│   │   └── ...
│   └── host/        # Backend host service (@deepseek-ai/dsh-host-voicespirit)
│       ├── src/     # Cordis service registration & API bridge
│       └── ...
├── scripts/
│   └── start-voicespirit-harness.ps1  # One-click startup script
├── README.md
├── README.zh.md
└── package.json
```

---

## 🚀 Quick Start

### 1. Requirements
- Node.js >= 20
- pnpm >= 9
- DeepSeek Harness (`dsh`)
- VoiceSpirit Realtime Audio Backend (or compatible OpenAI / WebRTC / WebSocket voice gateway)

### 2. Integration into DeepSeek Harness

In your DeepSeek Harness configuration (`cordis.patch.yml`):

```yaml
- insert:
    # Register host service
    - id: host-voicespirit
      name: '@deepseek-ai/dsh-host-voicespirit'

    # Mount UI plugin into Web roster
    - id: ui-voicespirit
      name: '@deepseek-ai/dsh-client-ui-voicespirit'
```

### 3. Build & Run

```bash
# Install dependencies & build packages
pnpm install
pnpm build

# Start DeepSeek Harness Web UI with VoiceSpirit
./scripts/start-voicespirit-harness.ps1
# or
pnpm dsh web
```

---

## ⚙️ Configuration

Open the **Voice Call Settings** popover in the Web UI to configure:
- **Voice Gateway URL**: e.g., `ws://127.0.0.1:8000/ws/voice` or `http://127.0.0.1:8000`
- **Audio Input / Output Devices**: Select your preferred microphone and speaker
- **VAD Sensitivity**: Adjust speech detection sensitivity and silence threshold

---

## 🤝 Contributing

Issues and pull requests are welcome! If you have suggestions or bug reports, feel free to open an issue or start a discussion.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
