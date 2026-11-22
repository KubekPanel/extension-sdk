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
- `window.Kubek.http` throws `KubekHttpError` with `status` and the route `body`, `meta: { silent: true }` on a
  query or mutation turns off the panel toast so the extension can show the error itself (0.2.1)
- the `server.sidebar` slot shows up in the card column next to the console, `window.Kubek.ui.InfoCard`
  and `CopyButton` make a card that looks like the panel ones (0.2.1)
- `window.Kubek.ui` has `Switch`, `Alert`, `Dialog` and `Tooltip` parts,
  `window.Kubek.hooks.useStreamerMask()` masks addresses in streamer mode

## 0.3.0

Needs Kubek 4.1.3 or newer:

- event handlers run after the panel code that fired the event, a handler that throws is logged and
  breaks nothing else
- `ctx.events.emit()` only takes names starting with `ext.`, anything else throws. `ctx.events.on("ext.<name>")`
  listens to other extensions without a capability
- `ctx.servers.onLog()` needs `events:logs` on top of `servers:read` and stops when the extension is disabled
- `task.completed` also fires for cancelled tasks, `status` can be `"cancelled"`
- `server.created`, `player.joined`, `player.left` and `file.changed` now fire, `backup.created` waits until
  the backup is really done. A crash fires `server.stopped` and then `server.crashed`
- `ctx.tasks` makes real panel tasks: they show in the task list and fire `task.*` events.
  `payload.title` is the label, `payload.serverId` ties the task to a server
- commands from `ctx.commands.register()` show up in the panel command palette, filtered by `permission`.
  What a command does is written to the audit log under the user who ran it
- the panel builds a settings form from `settingsSchema` and checks `rules` on save. Secret fields never
  reach the browser. `ctx.config.get()` returns the schema `default` until something is saved
- the `login.footer` slot works on the login page, before anyone is signed in
- an update is unpacked and built next to the running version and swapped in only when that worked,
  the new backend code loads without a panel restart
- install checks slot names, `settingsSchema` field types and options, `backend.isolation` and that
  declared permissions don't reuse core keys
- `SidebarContribution.route` docs fixed: it is `"<extId>/<Component>"`, the page opens at
  `/ext?view=<extId>/<Component>`
