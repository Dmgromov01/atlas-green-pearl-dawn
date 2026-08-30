/**
 * Grok App Builder PWA injector — disabled for this product.
 * The hub already ships `public/manifest.webmanifest` and its own head tags
 * in `__root.tsx`. Nitro still auto-loads this file because vite.config.ts
 * sets `serverDir: "./server"`.
 */
export default async function grokPwaMiddleware(
  _event: unknown,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  return next();
}
