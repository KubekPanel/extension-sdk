/**
 * @kubekpanel/extension-sdk
 *
 * Type contract the panel exports to extension authors. An extension adds panel behaviour
 * (backend logic, UI, permissions, event handlers) without forking Kubek. Backend half runs on
 * Bun from TypeScript, frontend half is transpiled to ESM at install; types only, ctx is injected.
 * Server types are not registered here, that is a separate subsystem (blueprints)
 */
export interface KubekExtensionManifest {
    manifestVersion: 1;
    /** reverse-domain: /^[a-z0-9]+(\.[a-z0-9-]+)+$/ */
    id: string;
    name: string;
    /** semver */
    version: string;
    description?: string;
    author?: {
        name: string;
        url?: string;
        email?: string;
    };
    license?: string;
    homepage?: string;
    /** path to a .png inside the package, or an emoji/text icon */
    icon?: string;
    keywords?: string[];
    /** semver-range, e.g. ">=4.0.0 <5.0.0" */
    engines: {
        kubek: string;
    };
    /** extId -> semver-range */
    dependencies?: Record<string, string>;
    permissions: ExtensionPermissions;
    /** omit for a UI-only extension */
    backend?: BackendManifest;
    /** omit for a background-only extension */
    frontend?: FrontendManifest;
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
    /** e.g. "ext.discord.configure" */
    key: string;
    label: string;
    /** grouping in the permission-granting UI */
    group?: string;
}
/** Closed capability set, host grants only approved ones */
export type Capability = "events:server" | "events:logs" | "events:tasks" | "events:backups" | "events:players" | "events:auth" | "events:files" | "servers:read" | "servers:control" | "http:routes" | "http:outbound" | "storage" | "settings" | "commands" | "tasks";
export interface BackendManifest {
    /** "backend/index.ts" */
    entry: string;
    /** default: in-process */
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
    /** /ext/<route> */
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
    defaultSize?: {
        w: number;
        h: number;
    };
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
export type SlotName = "dashboard.header" | "server.toolbar" | "server.console.actions" | "server.sidebar" | "files.contextMenu" | "settings.footer" | "login.footer";
/** Declarative settings form field (settingsSchema). */
export interface SettingField {
    key: string;
    type: "string" | "number" | "boolean" | "select" | "multiselect" | "secret";
    label: string;
    description?: string;
    default?: unknown;
    /** value not returned to the frontend in cleartext */
    secret?: boolean;
    options?: string[];
    /** "required|url|min:1" (laravel-like) */
    rules?: string;
}
export interface ExtensionSignature {
    alg: "ed25519";
    publicKeyId: string;
    value: string;
}
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
    permissions: {
        has(user: ExtUser, key: string): boolean;
    };
    storage: KeyValueStore;
    config: ExtConfigApi;
    tasks: ExtTasksApi;
    commands: {
        register(cmd: ExtCommand): void;
    };
}
export interface ExtLogger {
    info(msg: string, meta?: unknown): void;
    warn(msg: string, meta?: unknown): void;
    error(msg: string, meta?: unknown): void;
}
export interface ExtEvents {
    on<K extends ExtEventName>(event: K, handler: (p: ExtEventMap[K]) => void): Unsubscribe;
    emit(event: `ext.${string}`, payload: unknown): void;
}
/** All bus events. */
export type ExtEventName = keyof ExtEventMap;
export interface ExtEventMap {
    "server.created": {
        serverId: string;
        name: string;
        blueprintId: string;
    };
    "server.started": {
        serverId: string;
        pid?: number;
        port?: number;
    };
    "server.running": {
        serverId: string;
    };
    "server.stopped": {
        serverId: string;
        exitCode: number | null;
    };
    "server.crashed": {
        serverId: string;
        exitCode: number | null;
        restartAttempts: number;
    };
    "server.log": {
        serverId: string;
        line: InstanceLog;
    };
    "server.error": {
        serverId: string;
        errorType: string;
        severity: ErrorSeverity;
    };
    "server.deleted": {
        serverId: string;
    };
    "task.created": {
        taskId: string;
        type: string;
    };
    "task.completed": {
        taskId: string;
        status: "success" | "failed";
        result?: unknown;
    };
    "backup.created": {
        serverId: string;
        backupId: string;
    };
    "player.joined": {
        serverId: string;
        player: string;
    };
    "player.left": {
        serverId: string;
        player: string;
    };
    "user.login": {
        userId: string;
        ip: string;
    };
    "file.changed": {
        serverId: string;
        path: string;
    };
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
    onLog(id: string, cb: (line: InstanceLog) => void): Unsubscribe;
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
}
export interface KeyValueStore {
    get<T = unknown>(key: string): T | null;
    set(key: string, value: unknown): void;
    delete(key: string): void;
    keys(): string[];
}
export interface ExtConfigApi {
    get<T = unknown>(key: string): T;
    set(key: string, value: unknown): void;
    all(): Record<string, unknown>;
}
export interface ExtTasksApi {
    create(type: string, payload: unknown): string;
    update(taskId: string, patch: {
        progress?: number;
        status?: string;
        message?: string;
    }): void;
}
export interface ExtCommand {
    id: string;
    title: string;
    icon?: string;
    permission?: string;
    run(): void | Promise<void>;
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
    components: Record<string, unknown>;
}
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
    /** shadcn-style UI kit: Button, Input, Label, Badge, Separator, Card, CardContent, CardHeader, CardTitle, … */
    ui: Record<string, any>;
    /** lucide-react icon components by name */
    icons: Record<string, any>;
    /** the panel's typed API client (host-defined) */
    api: unknown;
    /** auth'd HTTP client; paths are relative to /api (e.g. "ext/<id>/route") */
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
        }) => KubekQueryResult<T>;
        useMutation: <TArgs = void>(opts: {
            mutationFn: (args: TArgs) => Promise<unknown>;
            onSuccess?: () => void;
            onError?: (error: unknown) => void;
        }) => KubekMutationResult<TArgs>;
        useQueryClient: () => {
            invalidateQueries: (opts: {
                queryKey: unknown[];
            }) => void;
        };
    };
    /** selected host hooks */
    hooks: {
        useAuthStore: () => unknown;
        useTranslation: () => {
            t: (key: string) => string;
        };
    };
    /** navigate within the panel SPA */
    navigate: (path: string) => void;
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
