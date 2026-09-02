---
description: "VoiceSpirit 实时全双工语音通话客户端插件，支持流式音频、VAD 打断与动态波形 HUD。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-voicespirit

[English](README.md) | 中文

## 概述

`dsh-client-ui-voicespirit` 是 DeepSeek Harness 的 VoiceSpirit 实时语音客户端插件，提供输入栏语音呼叫按钮、浮动通话 Dock 栏、实时音频波形可视化以及插件设置卡片。

## 模型体验

无，本包为浏览器端 UI 插件，不注册模型层 Prompt。

#### KV Cache 影响

无。

<a id="dev-note"></a>
### 开发说明

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。VoiceSpirit 客户端 UI 生命周期与设置作用域通过客户端与渲染器集成测试进行验证。
