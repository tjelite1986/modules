// Parses capture dates embedded in common camera/app filenames. Used as a
// fallback when EXIF has no DateTimeOriginal — videos, WhatsApp/Telegram
// re-compressed media, and screenshots all strip or never had EXIF, but
// their filenames usually encode when they were taken.

const MIN_YEAR = 1990;
// Date-only patterns get noon UTC so the calendar day survives display in
// any reasonable timezone.
const DEFAULT_HOUR = 12;

function buildDate(
  y: number,
  mo: number,
  d: number,
  h = DEFAULT_HOUR,
  mi = 0,
  s = 0,
): Date | null {
  if (y < MIN_YEAR) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  // Reject rollovers like Feb 30
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  // Reject dates in the future (allow slack for timezone differences)
  if (date.getTime() > Date.now() + 48 * 3600 * 1000) return null;
  return date;
}

function fromEpoch(ms: number): Date | null {
  const min = Date.UTC(2000, 0, 1);
  const max = Date.now() + 48 * 3600 * 1000;
  if (ms < min || ms > max) return null;
  return new Date(ms);
}

type Parser = (name: string) => Date | null;

const parsers: Parser[] = [
  // WhatsApp: IMG-20250720-WA0000.jpg / VID-20250720-WA0001.mp4
  (name) => {
    const m = name.match(/(?:IMG|VID|PTT|AUD|DOC|STK)-(\d{4})(\d{2})(\d{2})-WA\d+/i);
    return m ? buildDate(+m[1], +m[2], +m[3]) : null;
  },
  // Compact date + time: IMG_20250720_134512.jpg, 20250811_220838.mp4
  // (Samsung), Screenshot_20250720-134512.png, PXL_20250720_134512123.jpg
  // (Pixel, trailing milliseconds)
  (name) => {
    const m = name.match(
      /(?<!\d)(\d{4})(\d{2})(\d{2})[-_. ](\d{2})(\d{2})(\d{2})(?:\d{3})?(?!\d)/,
    );
    return m ? buildDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]) : null;
  },
  // ISO-ish date + time: photo_2025-07-20_13-45-12.jpg (Telegram),
  // signal-2025-07-20-13-45-12.jpg, "2025-07-20 13.45.12.jpg" (Dropbox),
  // "Screenshot 2025-07-20 at 13.45.12.png" (macOS)
  (name) => {
    const m = name.match(
      /(?<!\d)(\d{4})-(\d{2})-(\d{2})[ _T.-](?:at[ _])?(\d{2})[.:\-_](\d{2})[.:\-_](\d{2})(?!\d)/,
    );
    return m ? buildDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]) : null;
  },
  // Millisecond epoch: received_1626789012345.jpeg (Snapchat/FB exports)
  (name) => {
    const m = name.match(/(?<!\d)(1\d{12})(?!\d)/);
    return m ? fromEpoch(+m[1]) : null;
  },
  // Second epoch: 1626789012.jpg
  (name) => {
    const m = name.match(/(?<!\d)(1\d{9})(?!\d)/);
    return m ? fromEpoch(+m[1] * 1000) : null;
  },
  // Compact date only: IMG-20250720.jpg
  (name) => {
    const m = name.match(/(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/);
    return m ? buildDate(+m[1], +m[2], +m[3]) : null;
  },
  // ISO date only: 2025-07-20-holiday.jpg
  (name) => {
    const m = name.match(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/);
    return m ? buildDate(+m[1], +m[2], +m[3]) : null;
  },
];

// Most-specific pattern wins; every candidate is validated (real calendar
// date, year >= 1990, not in the future) so digit noise rarely parses.
export function parseFilenameDate(filename: string): Date | null {
  for (const parse of parsers) {
    const d = parse(filename);
    if (d) return d;
  }
  return null;
}
