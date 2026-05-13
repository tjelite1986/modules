# admin-metadata-crud

Admin editor + API for catalog item metadata. Covers everything you'd otherwise edit by hand:

- `info.md` frontmatter (name/developer/category/tagline/description/website/tags) + body
- Logo upload (PNG/JPG/WebP, max 5 MB)
- Banner upload (max 10 MB) + delete
- Screenshot upload (max 8 MB) + delete

All endpoints are guarded by `requireAdmin` from `auth-nextauth`.

## Dependencies
- **app-catalog-core** (uses `assetsDir`, `infoFile`, `isValidType`, `isValidSlug`, `AppEntry`)
- **auth-nextauth** (uses `requireAdmin`)
- `lucide-react`

## Wiring

You need an admin landing page that links into the editor. Minimal example:

```tsx
// src/app/admin/page.tsx
import { listAll } from "@/lib/store";
import Link from "next/link";

export default function AdminIndex() {
  const entries = listAll();
  return (
    <ul>
      {entries.map(e => (
        <li key={`${e.type}/${e.slug}`}>
          <Link href={`/admin/${e.type}/${encodeURIComponent(e.slug)}`}>
            {e.meta.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// src/app/admin/[type]/[slug]/page.tsx
import { readEntry, decodeSlug, isValidType } from "@/lib/store";
import { AdminEditor } from "@/components/AdminEditor";
import { notFound } from "next/navigation";

export default function AdminEntryPage({ params }: { params: { type: string; slug: string } }) {
  if (!isValidType(params.type)) notFound();
  const entry = readEntry(params.type, decodeSlug(params.slug));
  if (!entry) notFound();
  return <AdminEditor entry={entry} />;
}
```

## YAML escaping

The PUT `/info` route serializes frontmatter manually (no `yaml` lib needed):
- Strings with newlines, colons, hash, or starting with reserved YAML chars get JSON-stringified (which is also valid YAML)
- Tag arrays become flow style: `tags: [foo, "bar with: colon"]`

## Customization

- **Field set**: edit `Field` calls in `AdminEditor.tsx` and matching keys in `info/route.ts`
- **File size limits**: `MAX_BYTES` in each upload route
- **Allowed image types**: `ALLOWED` map in each upload route
- **Add removable screenshot to existing list**: handled — uses timestamp-based filenames

## Limitations

- No version-file management here (only assets/metadata). Drop APKs into `versions/<x.y.z>/` manually
- No bulk operations
- No audit log
