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
