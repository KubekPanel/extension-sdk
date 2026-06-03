/**
 * @kubekpanel/extension-sdk
 *
 * Type contract the panel exports to extension authors. An extension adds panel behaviour
 * (backend logic, UI, permissions, event handlers) without forking Kubek. Backend half runs on
 * Bun from TypeScript, frontend half is transpiled to ESM at install; types only, ctx is injected.
 * Server types are not registered here, that is a separate subsystem (blueprints)
 */
export {};
