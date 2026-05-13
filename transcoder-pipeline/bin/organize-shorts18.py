#!/usr/bin/env python3
"""
Sort flat files in /mnt/4tb/elite/shorts18/ into the uncategorized inbox
(`shorts18/uncategorized/<profile>/`). The category subfolder layer is
handled by the app — this script only resolves the profile.

Rules, tried in order — first match wins:

    1. Underscore-dash:  <profile>_-_<title>
                         -> profile = everything before _-_
                         (also accepts the `<profile> - <title>` variant
                          with spaces.)
    2. RedGIFs:          <tags>_by_<profile>___RedGIFs(_<n>)?
                         -> profile = the captured name
    3. FikFap:           anything ending in FikFap(_<n>)?
                         -> bucket "fikfap"
    4. RDT:              RDT_<digits>_<digits>
                         -> bucket "rdt"
    5. Catch-all:        everything else
                         -> bucket "misc"

Sidecars (.md, .jpg/.jpeg/.png/.webp posters, parented .web.mp4/original
variant) are moved alongside the video.

Usage:
    elite-organize-shorts18.py            # dry run, prints what would happen
    elite-organize-shorts18.py --commit   # actually moves files
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

ROOT = Path("/mnt/4tb/elite/shorts18")
INBOX_SUBDIR = "uncategorized"

VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}
SIDECAR_EXTS = {".md", ".jpg", ".jpeg", ".png", ".webp"}

# Match isValidProfile in src/lib/clips.ts.
PROFILE_RE = re.compile(r"^[A-Za-z0-9 ._\-()]+$")

# `<profile>_-_<title>` is the standard naming. Also accepts `<profile> - <title>`
# (spaces around the dash) since older imports use that form. Lazy match so
# `Kristy_Fox_-_I_really_..._title` correctly captures `Kristy_Fox` even
# though the profile itself contains an underscore.
DASH_PROFILE_RE = re.compile(r"^(?P<profile>\S.+?)(?:_-_|\s-\s)")
# `..._by_<profile>___RedGIFs` optionally followed by `_<n>` dedupe suffix.
REDGIFS_RE = re.compile(r"^.+?_by_(?P<profile>.+?)___RedGIFs(?:_\d+)?$")
FIKFAP_RE = re.compile(r"FikFap(?:_\d+)?$")
RDT_RE = re.compile(r"^RDT_\d+_\d+$")
DEFAULT_BUCKET = "misc"


def parse_basename(stem: str) -> str:
    """Return the profile/bucket name for a filename stem. Always non-empty."""
    m = DASH_PROFILE_RE.match(stem)
    if m:
        profile = m.group("profile").strip()
        if profile and PROFILE_RE.match(profile) and ".." not in profile:
            return profile
    m = REDGIFS_RE.match(stem)
    if m:
        profile = m.group("profile")
        if PROFILE_RE.match(profile) and ".." not in profile:
            return profile
    if FIKFAP_RE.search(stem):
        return "fikfap"
    if RDT_RE.match(stem):
        return "rdt"
    return DEFAULT_BUCKET


def split_extensions(path: Path) -> tuple[str, str]:
    name = path.name
    if name.endswith(".web.mp4"):
        return name[: -len(".web.mp4")], ".web.mp4"
    return path.stem, path.suffix


# Characters that break either the URL slug regex (lib/clips.ts SEGMENT_RE)
# or VLC's comma/colon-separated --sout language. Sanitised at sort-time so
# new imports never end up in either trap.
UNSAFE_CHAR_RE = re.compile(r"[^A-Za-z0-9 ._\-()]")


def sanitize_stem(stem: str) -> str:
    """Replace forbidden chars with '_', then collapse runs of underscores."""
    cleaned = UNSAFE_CHAR_RE.sub("_", stem)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_ .")
    return cleaned or "clip"


def collect_moves(root: Path) -> list[tuple[Path, Path]]:
    moves: list[tuple[Path, Path]] = []
    seen_targets: set[Path] = set()
    inbox_root = root / INBOX_SUBDIR

    # Loose video files can land directly in either the library root (the
    # historical inbox) OR in the new uncategorized/ inbox layer if you drag
    # files there manually. Walk both.
    scan_dirs: list[Path] = [root]
    if inbox_root.is_dir() and inbox_root != root:
        scan_dirs.append(inbox_root)

    for scan_dir in scan_dirs:
        for entry in sorted(scan_dir.iterdir()):
            if not entry.is_file():
                continue
            stem, ext = split_extensions(entry)
            if ext not in VIDEO_EXTS and ext != ".web.mp4":
                continue

            profile = sanitize_stem(parse_basename(stem))
            profile_dir = inbox_root / profile
            # Rename the file at the same time we move it so the on-disk basename
            # is always URL/VLC-safe (lib/clips.ts SEGMENT_RE strips chars like
            # comma + bang; VLC --sout truncates filenames at commas).
            safe_stem = sanitize_stem(stem)
            target = profile_dir / f"{safe_stem}{ext}"
            if target == entry:
                continue
            if target in seen_targets:
                continue
            seen_targets.add(target)
            moves.append((entry, target))

            for sidecar_ext in SIDECAR_EXTS:
                sidecar = scan_dir / f"{stem}{sidecar_ext}"
                if sidecar.is_file():
                    t = profile_dir / f"{safe_stem}{sidecar_ext}"
                    if t not in seen_targets:
                        seen_targets.add(t)
                        moves.append((sidecar, t))

            if ext == ".web.mp4":
                for orig_ext in VIDEO_EXTS:
                    orig = scan_dir / f"{stem}{orig_ext}"
                    if orig.is_file():
                        t = profile_dir / f"{safe_stem}{orig_ext}"
                        if t not in seen_targets:
                            seen_targets.add(t)
                            moves.append((orig, t))
            else:
                web = scan_dir / f"{stem}.web.mp4"
                if web.is_file():
                    t = profile_dir / f"{safe_stem}.web.mp4"
                    if t not in seen_targets:
                        seen_targets.add(t)
                        moves.append((web, t))

    return moves


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", action="store_true", help="actually perform the moves")
    parser.add_argument("--root", default=str(ROOT), help="library root (default: %(default)s)")
    args = parser.parse_args()

    root = Path(args.root)
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        return 1

    moves = collect_moves(root)
    if not moves:
        print(f"Nothing to do in {root}")
        return 0

    profiles_to_create = sorted({dst.parent for _, dst in moves if not dst.parent.exists()})
    profiles_to_use = sorted({dst.parent.name for _, dst in moves})

    print(f"Plan for {root}:")
    print(f"  {len(moves)} files into {len(profiles_to_use)} profile folder(s)")
    if profiles_to_create:
        print(f"  new folders: {', '.join(p.name for p in profiles_to_create)}")
    print()
    for src, dst in moves:
        rel_src = src.relative_to(root)
        rel_dst = dst.relative_to(root)
        print(f"  {rel_src}  ->  {rel_dst}")

    if not args.commit:
        print()
        print("(dry run — pass --commit to apply)")
        return 0

    print()
    print("Applying...")
    for parent in profiles_to_create:
        parent.mkdir(parents=True, exist_ok=True)

    moved = 0
    for src, dst in moves:
        if dst.exists():
            print(f"  skip (target exists): {dst.relative_to(root)}", file=sys.stderr)
            continue
        shutil.move(str(src), str(dst))
        moved += 1
    print(f"Moved {moved} file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
