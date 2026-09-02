---
description: "VoiceSpirit backend bridge for DeepSeek Harness: managed backend lifecycle, browser proxy routes, realtime WebSocket pipe, and the voicespirit settings namespace."
kind: "package-reference"
---

# @deepseek-ai/dsh-host-voicespirit

English | [中文](README.zh.md)

## Summary

`dsh-host-voicespirit` provides the host-side bridge for VoiceSpirit in DeepSeek Harness. It manages the VoiceSpirit backend child process lifecycle, proxies API and WebSocket routes with host-side authentication, and exposes the `voicespirit` settings namespace.

## Model Experience

None, as this host bridge provides backend process management and network proxy routes.

#### KV Cache effect

None.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. Host routes, child process management, and settings persistence are asserted through host integration tests.
