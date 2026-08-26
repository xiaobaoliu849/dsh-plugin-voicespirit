# Echo 实时语音插件 - DeepSeek Harness

中文 | [English](README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-brightgreen.svg)](https://github.com/topics/dsh-plugin)

**Echo for DeepSeek Harness** 是专为 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 打造的实时全双工语音交互与通话插件，基于 [Cordis](https://github.com/cordiverse/cordis) 微内核插件架构设计。（Echo 是 VoiceSpirit 后端的新产品名；包名、路由、设置键等内部标识仍沿用 `voicespirit`。）

它为 DeepSeek Harness Web 界面带来了超低延迟流式语音对话、智能 VAD 语音打断、动态音频波形 HUD 可视化以及沉浸式通话交互体验——**并且由 Harness 全程托管 Echo 后端**：启动时自动拉起后端进程、代理实时语音 WebSocket（浏览器无需跨域、无需持有凭证），并在设置页提供完整的服务商 / API Key / 生命周期配置卡片。

---

## ✨ 核心特性

- 🚀 **零操作后端托管**：Harness 启动时探测 `127.0.0.1:8000`，无服务则自动从 Echo (VoiceSpirit) 检出目录拉起 FastAPI 后端子进程；启动 / 停止 / 健康状态 / 实时日志尽在设置卡片一键操作。
- 🔐 **浏览器零凭证**：实时语音 WebSocket 由 Harness 代理（`/api/voicespirit/ws`），鉴权由宿主注入；API Key 保存在后端自己的 config 文档中，通过代理路由读写。
- 🎙️ **实时全双工语音通话**：流式音频管道（上行 PCM16 16 kHz / 下行 24 kHz），人机自然、无缝的即时语音对话。
- ⚡ **智能 VAD 语音打断**：用户说话时自动打断 Agent 播报，体验贴近真人交谈。
- 🌊 **动态声波律动 + 沉浸全屏**：实时频谱律动波形，支持一键展开沉浸式大屏通话界面。
- 🎛️ **完整设置卡片**（设置 → 插件 → Echo (voicespirit)）：
  - **后端服务**：后端目录、Python 解释器、端口、数据目录、自动启动、启动/停止、日志查看。
  - **语音服务商**：DashScope / Google / OpenAI / 豆包 / Cartesia / PersonaPlex / GLM4Voice，模型与音色选择，支持从后端拉取可用模型列表。
  - **服务商密钥**：按所选服务商动态渲染凭证字段（如 DashScope API Key + Realtime WebSocket 地址、豆包 Token + App ID、Cartesia + DeepSeek Key），保存直写后端配置文档，已配置项带 ✓ 标记。
- 🧩 **Cordis 标准插件架构**：前端 UI 组件包（`@deepseek-ai/dsh-client-ui-voicespirit`）与宿主桥接包（`@deepseek-ai/dsh-host-voicespirit`），通过 Harness 标准插件组合接入。

---

## 📁 项目目录结构

```text
dsh-plugin-voicespirit/
├── packages/
│   ├── client-ui/   # 前端插件 (@deepseek-ai/dsh-client-ui-voicespirit)
│   │   └── src/     # 音频引擎、统一控制器、通话 Dock、设置卡片
│   └── host/        # 宿主桥接 (@deepseek-ai/dsh-host-voicespirit)
│       └── src/     # 后端生命周期、/api/voicespirit 路由、WS 代理
├── scripts/
│   └── start-voicespirit-harness.ps1  # 一键启动脚本
├── README.md
└── README.zh.md
```

---

## 🚀 快速开始

### 1. 环境要求
- Node.js >= 20，pnpm >= 9
- DeepSeek Harness (`dsh`)
- Echo (VoiceSpirit) 检出目录（默认 `D:\voicespirit`，需含 Python venv）——Harness 会自动在 `<检出目录>\backend` 下执行 `python -m uvicorn main:app`

### 2. 接入 DeepSeek Harness

将 `packages/client-ui` 拷入 Harness 工作区 `packages/client/ui-voicespirit`、`packages/host` 拷入 `packages/host/voicespirit`（或直接引用本仓库），并在 `cordis.patch.yml` 中声明两行：

```yaml
- insert:
    # 宿主桥接：后端生命周期 + 浏览器路由
    - id: host-voicespirit
      name: '@deepseek-ai/dsh-host-voicespirit'

    # 浏览器名册：通话 Dock、快捷设置、设置卡片
    - id: ui-voicespirit
      name: '@deepseek-ai/dsh-client-ui-voicespirit'
```

构建在 Harness 工作区内进行（`pnpm build`），`workspace:^` 依赖在其中解析。

### 3. 运行

```bash
./scripts/start-voicespirit-harness.ps1
# 或直接
pnpm dsh web
```

后端自动启动（可在设置卡片中关闭自动启动）。打开 Web 界面后，输入框右侧出现麦克风按钮；点击通话时若后端未启动会自动先行拉起。

---

## ⚙️ 配置说明

全部配置均在 Web 界面完成：

- **设置 → 插件 → Echo (voicespirit)**（完整卡片）：
  - **后端服务** — 后端目录、Python 路径、端口、数据目录、自动启动、启动/停止、日志。
  - **语音服务商** — 服务商、模型（可从后端拉取列表）、音色。
  - **服务商密钥** — 所选服务商的凭证字段（如 DashScope API Key + Realtime WebSocket 地址、豆包 Token + App ID、Cartesia + DeepSeek Key），通过 Harness 代理保存进后端配置文档。
- **通话 Dock 快捷设置**（通话中齿轮图标）：一键切换服务商/模型/音色，查看后端状态。

### 数据目录

默认情况下 Harness 为后端分配独立数据目录（`~/.dsh/voicespirit`）。首次启动时后端会从检出目录的旧版 `config.json` 播种，因此已有密钥自动继承，同时与桌面版的登录数据库相互独立（Harness 使用自注入的令牌鉴权）。如需与桌面版共享状态，可将 `dataDir` 指向 `%APPDATA%\VoiceSpirit`；对外部启动且开启鉴权的后端，在 `apiToken` 字段粘贴访问令牌即可。

### HTTP 接口（宿主路由）

| 路由 | 用途 |
|---|---|
| `GET /api/voicespirit/status` | 后端阶段、健康状态、生效配置 |
| `POST /api/voicespirit/backend/start` / `stop` | 生命周期命令 |
| `GET /api/voicespirit/backend/log` | 后端近期输出 |
| `GET`/`PUT /api/voicespirit/settings` | 后端配置文档代理 |
| `POST /api/voicespirit/models/fetch` | 服务商模型探测 |
| `WS /api/voicespirit/ws` | 实时语音通话管道（鉴权由宿主注入） |

---

## 🤝 参与贡献

欢迎提交 Issue 与 Pull Request！如有建议或问题反馈，请随时发起讨论。

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。
