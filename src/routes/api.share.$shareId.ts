import { createFileRoute } from '@tanstack/react-router'

/** Serves the stored payload behind a short link. See `api.share.new.ts`. */
export const Route = createFileRoute('/api/share/$shareId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { ShareStoreError, getShare } =
          await import('#/server/shareStore')

        try {
          const { payload, expiresAt } = await getShare(params.shareId)

          return Response.json(
            { payload, expiresAt },
            {
              // The id is the secret, so this must not land in a shared cache.
              headers: { 'cache-control': 'private, max-age=300' },
            },
          )
        } catch (error) {
          if (error instanceof ShareStoreError) {
            return Response.json(
              { error: error.message },
              { status: error.status },
            )
          }

          return Response.json(
            { error: 'This shared timeline could not be loaded.' },
            { status: 500 },
          )
        }
      },
    },
  },
})
