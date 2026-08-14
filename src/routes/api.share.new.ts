import { createFileRoute } from '@tanstack/react-router'

/**
 * Mints a short share link.
 *
 * The store is pulled in with a dynamic import so `cloudflare:workers` — which
 * only exists inside the Worker — never becomes an import of the route file
 * that the client bundle also pulls in.
 */
export const Route = createFileRoute('/api/share/new')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { ShareStoreError, assertWithinRateLimit, putShare } =
          await import('#/server/shareStore')

        try {
          await assertWithinRateLimit(request)

          // Trimmed so a stray newline from a hand-made request is not a 400.
          const payload = (await request.text()).trim()
          const { id, expiresAt } = await putShare(payload)

          return Response.json({ id, expiresAt }, { status: 201 })
        } catch (error) {
          if (error instanceof ShareStoreError) {
            return Response.json(
              { error: error.message },
              { status: error.status },
            )
          }

          return Response.json(
            { error: 'The short link could not be created.' },
            { status: 500 },
          )
        }
      },
    },
  },
})
