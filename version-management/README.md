# version-management

`<VersionList>` component — shows all versions of a catalog entry with per-file architecture labels and direct download links. Marks the most recent version as "Latest".

## Dependencies

- **app-catalog-core** (uses `AppVersion` type, `formatBytes`, `ARCH_LABELS`)
- **file-download-with-logging** (soft — provides the `/api/download/...` URL the links point to)
- `lucide-react` (Download icon)

## Usage

```tsx
import { VersionList } from "@/components/VersionList";
import { readEntry } from "@/lib/store";

const entry = readEntry("apps", slug);
if (!entry) return notFound();

return <VersionList type={entry.type} slug={entry.slug} versions={entry.versions} />;
```

## Customization

- **Download URL**: hard-coded `/api/download/${type}/${slug}/${versionDir}/${file}`. Change the `href=` if your download endpoint lives elsewhere.
- **Empty state**: "No versions uploaded yet." — change in the early return.
- **Latest badge**: only the first item gets it; remove the `i === 0` block to drop it.
- **Styling**: Tailwind dark theme — restyle freely.
