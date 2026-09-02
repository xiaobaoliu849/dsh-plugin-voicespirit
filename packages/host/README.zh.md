---
description: "VoiceSpirit 后端桥接插件：托管后端生命周期、浏览器代理路由、实时 WebSocket 通道与 voicespirit 设置命名空间。"
kind: "package-reference"
---

# @deepseek-ai/dsh-host-voicespirit

[English](README.md) | 中文

## 概述

`dsh-host-voicespirit` 为 DeepSeek Harness 提供 VoiceSpirit 后端桥接服务，负责管理 VoiceSpirit 后端子进程生命周期、提供带鉴权注入的 HTTP/WebSocket 代理路由，并注册 `voicespirit` 设置命名空间。

## 模型体验

无，本包为宿主端进程管理与代理桥接，不注册模型层内容。

#### KV Cache 影响

无。

<a id="dev-note"></a>
### 开发说明

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。宿主路由、子进程管理与设置持久化通过宿主集成测试进行验证。
