# file-download-with-logging

Authenticated download endpoint for catalog files. Streams from disk, sets correct MIME types, supports non-ASCII filenames via RFC-5987 `Content-Disposition`, and writes a row to `downloads` for every successful fetch.

## API

`GET /api/download/[type]/[slug]/[version]/[file]`

- 401 if no session
- 400 for malformed type/slug/version/file
- 403 for path-traversal attempts
- 404 for missing file
- 200 streamed bytes otherwise

## Dependencies

- **app-catalog-core** (uses `appDir`, `isValidType`, `isValidSlug`, `isValidFileName`)
- **auth-nextauth** (uses `getServerSession`)

## Logged columns

```
downloads(id, user_id, type, app_name, version, file_name, created_at)
```

`user_id` is set from the session; `app_name` is the slug; `version` is the version-folder name (so re-uploads under a new architecture suffix log under the same base — see `app-catalog-core`'s `splitVersionDir`).

## Read recent downloads

```ts
import { listRecentDownloads } from "@/lib/downloads";
const recent = listRecentDownloads(50);
```

## Customization

- **Public downloads**: remove the `getServerSession` check
- **MIME types**: extend the `contentType` switch in route.ts for new file types
- **Anonymize logs**: set `userId` to null unconditionally

## Limitations

- No rate limiting
- No bandwidth caps
- No range request support — large files won't seek (add `Range` handling if needed; the `file-upload-storage` module already does this for its own files)
