/**
 * @kubekpanel/extension-sdk
 *
 * Type contract the panel exports to extension authors. An extension adds panel behaviour
 * (backend logic, UI, permissions, event handlers) without forking Kubek. Backend half runs on
 * Bun from TypeScript, frontend half is transpiled to ESM at install; types only, ctx is injected.
 * Server types are not registered here, that is a separate subsystem (blueprints)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Manifest (kubek-extension.json)
// ─────────────────────────────────────────────────────────────────────────────

export interface KubekExtensionManifest {
  manifestVersion: 1;
  /** reverse-domain: /^[a-z0-9]+(\.[a-z0-9-]+)+$/ */
  id: string;
  name: string;
  /** semver */
  version: string;
  description?: string;
  author?: { name: string; url?: string; email?: string };
  license?: string;
  homepage?: string;
  /** path to a .png inside the package, or an emoji/text icon */
  icon?: string;
  keywords?: string[];

  /** semver-range, e.g. ">=4.0.0 <5.0.0" */
  engines: { kubek: string };
  /** extId -> semver-range */
  dependencies?: Record<string, string>;

  permissions: ExtensionPermissions;
  /** omit for a UI-only extension */
  backend?: BackendManifest;
  /** omit for a background-only extension */
  frontend?: FrontendManifest;
  /**
   * The panel builds the settings form of the extension from this, read the values with ctx.config.
   * Needs the "settings" capability for ctx.config
   */
  settingsSchema?: SettingField[];
  signature?: ExtensionSignature;
}

export interface ExtensionPermissions {
  /** new permissions the extension introduces into the panel's permission registry */
  declares?: PermissionDef[];
  /** capabilities the extension itself needs (consent screen at install) */
  requires?: Capability[];
}

export interface PermissionDef {
  /** e.g. "ext.discord.configure", core keys like "file_manager" are refused */
  key: string;
  label: string;
  /** grouping in the permission-granting UI */
  group?: string;
}

/** Closed capability set, host grants only approved ones */
export type Capability =
  | "events:server"
  | "events:logs"
  | "events:tasks"
  | "events:backups"
  | "events:players"
  | "events:auth"
  | "events:files"
  | "servers:read"
  | "servers:control"
  | "http:routes"
  | "http:outbound"
  | "storage"
  | "settings"
  | "commands"
  | "tasks"
  /** run programs from the extension data dir, see ctx.processes. @since Kubek 4.1.3 */
  | "process:spawn";

export interface BackendManifest {
  /** "backend/index.ts" */
  entry: string;
  /** default: in-process, any other value is refused at install */
  isolation?: "in-process" | "worker";
  /** for lazy activation */
  events?: ExtEventName[];
}

export interface FrontendManifest {
  /** "frontend/index.ts"; panel transpiles to dist/ via Bun.build */
  entry: string;
  contributes?: FrontendContributions;
}

export interface FrontendContributions {
  sidebar?: SidebarContribution[];
  serverTabs?: ServerTabContribution[];
  dashboardWidgets?: DashboardWidgetContribution[];
  settingsPanels?: SettingsPanelContribution[];
  slots?: SlotContribution[];
}

export interface SidebarContribution {
  id: string;
  /** i18n key */
  label: string;
  /** lucide icon name */
  icon: string;
  /**
   * "<extId>/<Component>": the page opens at /ext?view=<extId>/<Component> and renders that
   * component of the frontend bundle
   */
  route: string;
  /** permission required for visibility */
  permission?: string;
  /** sidebar section */
  section?: string;
}

export interface ServerTabContribution {
  id: string;
  label: string;
  component: string;
  permission?: string;
}

export interface DashboardWidgetContribution {
  id: string;
  label: string;
  component: string;
  defaultSize?: { w: number; h: number };
}

export interface SettingsPanelContribution {
  id: string;
  label: string;
  component: string;
  permission?: string;
}

export interface SlotContribution {
  slot: SlotName;
  component: string;
  order?: number;
}

/**
 * server.sidebar is the card column next to the console, context is { serverId }. login.footer
 * renders on the login page before anyone is signed in, keep it to public content
 */
export type SlotName =
  | "dashboard.header"
  | "server.toolbar"
  | "server.console.actions"
  | "server.sidebar"
  | "files.contextMenu"
  | "settings.footer"
  | "login.footer";

/** Declarative settings form field (settingsSchema), ctx.config.get returns default until it is saved */
export interface SettingField {
  key: string;
  type: "string" | "number" | "boolean" | "select" | "multiselect" | "secret";
  label: string;
  description?: string;
  default?: unknown;
  /** never sent to the browser, the form only shows whether it is set. type "secret" implies it */
  secret?: boolean;
  /** required for select and multiselect */
  options?: string[];
  /**
   * "required|url|min:1|max:64", checked when the form is saved. min and max compare numbers by
   * value and strings by length, unknown rules are ignored
   */
  rules?: string;
}

export interface ExtensionSignature {
  alg: "ed25519";
  publicKeyId: string;
  value: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend SDK: context and events
// ─────────────────────────────────────────────────────────────────────────────

export type Unsubscribe = () => void;

export interface KubekExtensionContext {
  readonly id: string;
  readonly version: string;
  /** backend/extensions/.data/<id>/ */
  readonly dataDir: string;
  readonly logger: ExtLogger;
  events: ExtEvents;
  servers: ExtServersApi;
  http: ExtHttpApi;
  permissions: { has(user: ExtUser, key: string): boolean };
  storage: KeyValueStore;
  config: ExtConfigApi;
  tasks: ExtTasksApi;
  commands: { register(cmd: ExtCommand): void };
  /** process:spawn, @since Kubek 4.1.3 */
  processes: ExtProcessesApi;
  // No serverTypes: server types are a separate subsystem
}

export interface ExtLogger {
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

/**
 * Handlers run after the code that published the event, a throwing handler is logged and never
 * breaks the panel or other handlers. Subscriptions end when the extension is disabled
 */
export interface ExtEvents {
  /** panel events, each needs its events:* capability */
  on<K extends ExtEventName>(event: K, handler: (p: ExtEventMap[K]) => void): Unsubscribe;
  /** events extensions emit, no capability needed */
  on(event: `ext.${string}`, handler: (p: unknown) => void): Unsubscribe;
  /** the name must start with "ext.", anything else throws, so core events cannot be faked */
  emit(event: `ext.${string}`, payload: unknown): void;
}

/** All bus events. */
export type ExtEventName = keyof ExtEventMap;

export interface ExtEventMap {
  /** the server row exists, its files may still be installing, task.completed tells when */
  "server.created": { serverId: string; name: string; blueprintId: string };
  /** the process was started, the game is not up yet */
  "server.started": { serverId: string; pid?: number; port?: number };
  /** the game finished loading and accepts players */
  "server.running": { serverId: string };
  /** every stop, a crash included */
  "server.stopped": { serverId: string; exitCode: number | null };
  /** a crash fires server.stopped first and then this */
  "server.crashed": { serverId: string; exitCode: number | null; restartAttempts: number };
  "server.log": { serverId: string; line: InstanceLog };
  "server.error": { serverId: string; errorType: string; severity: ErrorSeverity };
  "server.deleted": { serverId: string };
  "task.created": { taskId: string; type: string };
  "task.completed": { taskId: string; status: "success" | "failed" | "cancelled"; result?: unknown };
  /** after the archive is written and checked, a failed backup fires nothing */
  "backup.created": { serverId: string; backupId: string };
  /** from the Kubek Companion plugin, player is the name */
  "player.joined": { serverId: string; player: string };
  /** from the Kubek Companion plugin, kicks included */
  "player.left": { serverId: string; player: string };
  "user.login": { userId: string; ip: string };
  /**
   * a change made through the panel (editor, upload, delete, rename, new folder, archive, extract).
   * path is relative to the server folder, a bulk operation fires once per top level path
   */
  "file.changed": { serverId: string; path: string };
}

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export interface ExtServersApi {
  list(): ServerSummary[];
  get(id: string): ServerSummary | null;
  /** servers:control */
  sendCommand(id: string, cmd: string): Promise<boolean>;
  /** servers:control */
  start(id: string): Promise<void>;
  /** servers:control */
  stop(id: string): Promise<void>;
  /** servers:read and events:logs, stops on its own when the extension is disabled */
  onLog(id: string, cb: (line: InstanceLog) => void): Unsubscribe;
  /**
   * Ports the server listens on 127.0.0.1, server.properties wins for the primary one
   * @since Kubek 4.1.3
   */
  ports(id: string): Promise<ServerPort[]>;
}

export interface ServerPort {
  /** blueprint port key, e.g. "game" or "bedrock" */
  key: string;
  port: number;
  protocol: "tcp" | "udp" | "tcp+udp";
  /** the port players connect to */
  primary: boolean;
}

export interface ServerSummary {
  id: string;
  name: string;
  blueprintId: string;
  status: ServerStatus;
}

export type ServerStatus = "stopped" | "running" | "starting" | "stopping";

export interface ExtHttpApi {
  /** http:routes */
  registerRoutes(routes: ExtRoute[]): void;
  /** http:outbound */
  fetch(url: string, init?: RequestInit): Promise<Response>;
  /** http:outbound */
  post(url: string, json: unknown): Promise<Response>;
}

export interface ExtRoute {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "ALL";
  /** relative to /api/ext/<id> */
  path: string;
  permission?: string;
  handler: (req: ExtRequest, res: ExtResponse) => unknown | Promise<unknown>;
}

export interface ExtRequest {
  user: ExtUser;
  body: unknown;
  query: Record<string, string>;
  params: Record<string, string>;
}

export interface ExtResponse {
  json(data: unknown): void;
  status(code: number): ExtResponse;
  send(body?: unknown): void;
}

export interface ExtUser {
  id: string;
  username: string;
  isAdmin?: boolean;
  permissions: string[];
  /**
   * Servers this user may touch, "all" when not restricted. Check it before acting on a server
   * from a route, the route permission alone is panel wide. @since Kubek 4.1.3
   */
  servers?: "all" | string[];
}

export interface KeyValueStore {
  get<T = unknown>(key: string): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  keys(): string[];
}

/** Values of the settings form, see settingsSchema */
export interface ExtConfigApi {
  /** saved value, or the settingsSchema default */
  get<T = unknown>(key: string): T;
  set(key: string, value: unknown): void;
  all(): Record<string, unknown>;
}

/** Tasks show up in the panel task list like the panel's own and fire task.* events */
export interface ExtTasksApi {
  /**
   * Starts a running task and returns its id. payload.title is the label in the task list,
   * payload.serverId ties it to a server. Created inside a route or a command it belongs to that user
   */
  create(type: string, payload?: unknown): string;
  /**
   * progress is 0-100. status "success" finishes it, "failed" fails it with message as the error,
   * "cancelled" cancels it, "running" keeps it going. Only tasks of this extension can be updated
   */
  update(
    taskId: string,
    patch: { progress?: number; status?: "running" | "success" | "failed" | "cancelled" | (string & {}); message?: string },
  ): void;
}

/** Shows up in the panel command palette for users that have permission */
export interface ExtCommand {
  id: string;
  title: string;
  icon?: string;
  permission?: string;
  /** what it does is written to the audit log under the user who ran it, a throw shows as an error */
  run(): void | Promise<void>;
}

/** Helper programs like tunnel clients, the host kills them when the extension is disabled or the panel stops */
export interface ExtProcessesApi {
  spawn(options: ExtSpawnOptions): ExtProcess;
}

export interface ExtSpawnOptions {
  /** absolute path or a program on PATH */
  command: string;
  args?: string[];
  /** relative to dataDir and must stay inside it, dataDir by default */
  cwd?: string;
  /** added on top of the panel environment */
  env?: Record<string, string>;
  /** kept open when true, see ExtProcess.write */
  stdin?: boolean;
}

export interface ExtProcess {
  readonly pid: number | undefined;
  /** stdout and stderr split into lines, ANSI colors left as is */
  onLine(cb: (line: string, stream: "stdout" | "stderr") => void): Unsubscribe;
  /** exit code, null when killed by a signal */
  readonly exited: Promise<number | null>;
  /** needs stdin: true */
  write(data: string): void;
  /** SIGTERM, then SIGKILL after graceMs (default 5000) */
  kill(graceMs?: number): Promise<void>;
}

/** Instance log line (mirrors the internal IInstanceLog). */
export interface InstanceLog {
  type: "stdout" | "stderr" | "kubek";
  timestamp: string;
  line?: string;
  data?: unknown;
}

/** A frontend bundle exports this as its default. */
export interface KubekFrontendModule {
  components: Record<string, unknown /* React.ComponentType<any> */>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontend runtime: window.Kubek
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The host injects window.Kubek before any extension bundle loads. Frontend bundles externalize
 * React and read what they need from here, sharing the panel's singletons. Declaring the type and
 * the global below means authors get autocomplete without redeclaring it in every extension
 *
 * React/ui/icons are loose on purpose — typing them precisely would pull react/lucide deps into this
 * package, which the backend half imports too. http/query/hooks keep precise signatures
 */
export interface KubekRuntime {
  /** the panel's React namespace (createElement, hooks, …) */
  React: any;
  /**
   * shadcn-style UI kit: Button, Input, Label, Badge, Separator, Card, CardContent, CardHeader, CardTitle,
   * and since Kubek 4.1.3 Switch, Alert, AlertTitle, AlertDescription, Dialog, DialogContent, DialogHeader,
   * DialogTitle, DialogDescription, DialogBody, DialogFooter, Tooltip, TooltipTrigger, TooltipContent,
   * InfoCard (a card of the console rail: icon, tone, label, value, action) and CopyButton
   */
  ui: Record<string, any>;
  /** lucide-react icon components by name */
  icons: Record<string, any>;
  /** the panel's typed API client (host-defined) */
  api: unknown;
  /** auth'd HTTP client; paths are relative to /api (e.g. "ext/<id>/route"), throws KubekHttpError */
  http: {
    get: <T>(path: string) => Promise<T>;
    post: <T = unknown>(path: string, json?: unknown) => Promise<T>;
    delete: <T = unknown>(path: string) => Promise<T>;
  };
  /** react-query primitives bound to the panel's QueryClient */
  query: {
    useQuery: <T>(opts: {
      queryKey: unknown[];
      queryFn: () => Promise<T>;
      enabled?: boolean;
      refetchInterval?: number;
      meta?: KubekQueryMeta;
    }) => KubekQueryResult<T>;
    useMutation: <TArgs = void>(opts: {
      mutationFn: (args: TArgs) => Promise<unknown>;
      onSuccess?: () => void;
      onError?: (error: unknown) => void;
      meta?: KubekQueryMeta;
    }) => KubekMutationResult<TArgs>;
    useQueryClient: () => { invalidateQueries: (opts: { queryKey: unknown[] }) => void };
  };
  /** selected host hooks */
  hooks: {
    useAuthStore: () => unknown;
    useTranslation: () => { t: (key: string) => string };
    /** streamer mode masking for addresses and secrets, @since Kubek 4.1.3 */
    useStreamerMask?: () => { text: (value: string) => string; enabled: boolean };
  };
  /** navigate within the panel SPA */
  navigate: (path: string) => void;
}

/** silent: no panel toast on error, the extension shows it itself */
export type KubekQueryMeta = { silent?: boolean };

/** What window.Kubek.http throws on a non 2xx answer, body is what the route sent. @since Kubek 4.1.3 */
export interface KubekHttpError extends Error {
  status: number;
  body: unknown;
}

/** Subset of react-query's UseQueryResult exposed to extensions */
export interface KubekQueryResult<T> {
  data?: T;
  isPending: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/** Subset of react-query's UseMutationResult exposed to extensions */
export interface KubekMutationResult<TArgs> {
  mutate: (args: TArgs) => void;
  isPending: boolean;
  isError: boolean;
  error: unknown;
}

declare global {
  interface Window {
    Kubek?: KubekRuntime;
  }
}
