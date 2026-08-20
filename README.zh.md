# VoiceSpirit 实时语音插件 - DeepSeek Harness

中文 | [English](README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-brightgreen.svg)](https://github.com/topics/dsh-plugin)

**VoiceSpirit for DeepSeek Harness** 是专为 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 打造的实时全双工语音交互与通话插件，基于 [Cordis](https://github.com/cordiverse/cordis) 微内核插件架构设计。

它为 DeepSeek Harness Web 界面带来了超低延迟流式语音对话、智能 VAD 语音打断、动态音频波形 HUD 可视化以及沉浸式通话交互体验。

---

## ✨ 核心特性

- 🎙️ **实时全双工语音通话**：基于流式音频管道与 WebSocket 协议，实现人机自然、无缝的即时语音对话。
- ⚡ **智能 VAD 语音打断**：内置语音活动检测（Voice Activity Detection），用户说话时自动打断 Agent 播报，体验贴近真人交谈。
- 🌊 **动态声波律动 (Live Waveform HUD)**：沉浸式频谱律动波形，实时反映说话状态与音量强弱。
- 🎛️ **丰富多样的交互形态**：
  - **Dock 底部通话栏**：常驻输入区下方，随时静音、挂断或切换。
  - **沉浸式通话弹窗 (Immersive Modal)**：大屏全景通话界面，专注语音交互。
  - **快捷设置面板**：实时调节网关地址、音频设备、采样率与灵敏度。
- 🧩 **Cordis 标准插件架构**：解耦为前端 UI 组件包（`@deepseek-ai/dsh-client-ui-voicespirit`）与后端服务包（`@deepseek-ai/dsh-host-voicespirit`）。

---

## 📁 项目目录结构

```text
dsh-plugin-voicespirit/
├── packages/
│   ├── client-ui/   # 前端 UI 与客户端音频引擎 (@deepseek-ai/dsh-client-ui-voicespirit)
│   │   ├── src/     # 音频引擎、波形渲染组件、Slot 插槽注册
│   │   └── ...
│   └── host/        # 宿主端/服务端桥接 (@deepseek-ai/dsh-host-voicespirit)
│       ├── src/     # Cordis 服务扩展与 API 代理网关
│       └── ...
├── scripts/
│   └── start-voicespirit-harness.ps1  # 一键启动脚本
├── README.md        # 英文说明文档
├── README.zh.md     # 中文说明文档
└── package.json
```

---

## 🚀 快速上手

### 1. 环境依赖
- Node.js >= 20
- pnpm >= 9
- DeepSeek Harness (`dsh`)
- VoiceSpirit 语音网关服务（或兼容的 WebSocket / WebRTC 音频服务端）

### 2. 在 DeepSeek Harness 中配置插件

在 `cordis.patch.yml` 中注册插件服务与 UI 组件：

```yaml
- insert:
    # 注入宿主端语音服务
    - id: host-voicespirit
      name: '@deepseek-ai/dsh-host-voicespirit'

    # 注入 Web 前端组件与插槽
    - id: ui-voicespirit
      name: '@deepseek-ai/dsh-client-ui-voicespirit'
```

### 3. 构建与启动

```bash
# 安装依赖并构建
pnpm install
pnpm build

# 启动 Harness Web 服务
./scripts/start-voicespirit-harness.ps1
# 或直接
pnpm dsh web
```

---

## ⚙️ 配置说明

在 Web UI 通话设置面板中可进行如下配置：
- **网关地址 (Voice Gateway URL)**：例如 `ws://127.0.0.1:8000/ws/voice` 或 HTTP 端点
- **音频输入/输出设备**：自由选择麦克风与扬声器
- **VAD 灵敏度与阈值**：调节语音激活灵敏度与静音判定时长

---

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！如果有任何改进建议或功能需求，欢迎随时交流探讨。

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源。
