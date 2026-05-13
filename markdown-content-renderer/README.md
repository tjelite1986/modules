# markdown-content-renderer

Drop-in React Markdown renderer with GitHub-Flavored Markdown support (tables, task lists, strikethrough, autolinks).

## Usage

```tsx
import { Markdown } from "@/components/Markdown";

<Markdown>{`
# Hello

| col | col |
|-----|-----|
| 1   | 2   |

- [x] Done
- [ ] Todo
`}</Markdown>
```

## Dependencies
- `react-markdown@^9`
- `remark-gfm@^4`

## Sanitization

This renderer does **not** sanitize HTML by default. Safe for trusted content (your own markdown files). For user-generated content, add `rehype-sanitize`:

```bash
npm install rehype-sanitize
```

```tsx
import rehypeSanitize from "rehype-sanitize";

<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
  {children}
</ReactMarkdown>
```

## Customization

- **Styling**: wrap class is `markdown-body text-sm text-zinc-200`. Add your own typography rules in CSS targeting `.markdown-body` (or use `@tailwindcss/typography` and switch to `prose`)
- **Add plugins**: extend `remarkPlugins` (e.g. `remark-math`) and `rehypePlugins` (e.g. `rehype-katex`, `rehype-highlight`)
