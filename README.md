# @kubekpanel/extension-sdk

TypeScript type contract for **Kubek extensions** — packages that add panel behaviour (backend logic,
UI contributions, permissions, event handlers, HTTP routes, scheduled tasks) without forking Kubek.

This package is **types only**: it has no runtime code. The backend `ctx` is injected by the panel,
and the frontend reads React / UI / icons / hooks from the host (`window.Kubek`, also typed here).

```sh
npm i -D @kubekpanel/extension-sdk
```

```ts
import type {
  KubekExtensionContext,
  KubekFrontendModule,
} from "@kubekpanel/extension-sdk";
```

See the [extension starter template](https://github.com/KubekPanel/extension-template)
for a complete, working example.

## 0.2.0

Needs Kubek 4.1.3 or newer, set `"engines": { "kubek": ">=4.1.3" }` when you use these:

- `process:spawn` capability and `ctx.processes.spawn()` for helper programs from the extension data
  dir. The panel kills them when the extension is disabled or updated
- `ctx.servers.ports(id)` - ports of a server, the primary one is what players connect to
- `ExtUser.servers` - servers the caller may touch, check it in routes that take a server id
- `window.Kubek.ui` has `Switch`, `Alert`, `Dialog` and `Tooltip` parts,
  `window.Kubek.hooks.useStreamerMask()` masks addresses in streamer mode
