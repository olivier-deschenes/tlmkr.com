/**
 * Typings for the Cloudflare bindings declared in `wrangler.jsonc`.
 *
 * `@cloudflare/workers-types` and `wrangler types` both publish the whole
 * Workers runtime as ambient globals, which collide with the DOM lib this app
 * is compiled against (their `Response` is not the browser's). Only two
 * bindings are used, and only a handful of methods on each, so they are spelled
 * out here instead. Keep this in sync with `wrangler.jsonc`.
 */
declare module 'cloudflare:workers' {
  export interface KvPutOptions {
    /** Seconds until Cloudflare deletes the key. Minimum 60. */
    expirationTtl?: number
    metadata?: unknown
  }

  export interface KvValueWithMetadata<TMetadata> {
    value: string | null
    metadata: TMetadata | null
  }

  export interface ShareKvNamespace {
    put: (key: string, value: string, options?: KvPutOptions) => Promise<void>
    getWithMetadata: <TMetadata>(
      key: string,
      type?: 'text',
    ) => Promise<KvValueWithMetadata<TMetadata>>
  }

  /** The Workers rate limiting binding, configured under `ratelimits`. */
  export interface ShareRateLimiter {
    limit: (options: { key: string }) => Promise<{ success: boolean }>
  }

  export const env: {
    SHARE_LINKS: ShareKvNamespace
    /** Optional: not every local runtime provides the rate limiting binding. */
    SHARE_RATE_LIMIT?: ShareRateLimiter
  }
}
