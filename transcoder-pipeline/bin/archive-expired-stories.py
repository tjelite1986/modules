#!/usr/bin/env python3
"""
Archive stories older than --ttl-hours (default 24) out of each profile's
active `stories/` folder into `stories/_expired/`.

Storage layout:

    /mnt/4tb/elite/photos/<profile>/stories/<file>           # active
    /mnt/4tb/elite/photos/<profile>/stories/_expired/<file>  # archived

The `_expired` folder is invisible to the elite scanner (folders starting
with `_` are skipped), so the strip drops the stories as soon as they age
out — independently of this script. The script only reclaims disk-clarity
on the active folder. Sidecars (.md, poster image, .web.mp4 variant) are
moved alongside the primary file.

Usage:
    elite-archive-expired-stories.py            # dry run
    elite-archive-expired-stories.py --commit   # actually move
    elite-archive-expired-stories.py --ttl-hours 12 --commit
"""
from __future__ import annotations

import argparse
import shutil
import sys
import time
from pathlib import Path

ROOT = Path("/mnt/4tb/elite/photos")
DEFAULT_TTL_HOURS = 24

VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
SIDECAR_EXTS = {".md", ".jpg", ".jpeg", ".png", ".webp"}
WEB_SUFFIX = ".web.mp4"


def split_extensions(path: Path) -> tuple[str, str]:
    name = path.name
    if name.endswith(WEB_SUFFIX):
        return name[: -len(WEB_SUFFIX)], WEB_SUFFIX
    return path.stem, path.suffix


def primary_files(stories_dir: Path) -> list[Path]:
    out: list[Path] = []
    for entry in stories_dir.iterdir():
        if not entry.is_file():
            continue
        if entry.name.startswith(".") or entry.name.startswith("_"):
            continue
        _, ext = split_extensions(entry)
        if ext in VIDEO_EXTS or ext in IMAGE_EXTS or ext == WEB_SUFFIX:
            out.append(entry)
    return out


def collect_moves(root: Path, ttl_hours: float) -> list[tuple[Path, Path]]:
    cutoff = time.time() - ttl_hours * 3600
    moves: list[tuple[Path, Path]] = []
    seen: set[Path] = set()

    for profile_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        if profile_dir.name.startswith(".") or profile_dir.name.startswith("_"):
            continue
        stories_dir = profile_dir / "stories"
        if not stories_dir.is_dir():
            continue
        archive_dir = stories_dir / "_expired"

        for entry in primary_files(stories_dir):
            if entry.stat().st_mtime > cutoff:
                continue
            stem, ext = split_extensions(entry)

            # Primary file.
            target = archive_dir / entry.name
            if target in seen:
                continue
            seen.add(target)
            moves.append((entry, target))

            # Sidecars.
            for sidecar_ext in SIDECAR_EXTS:
                sidecar = stories_dir / f"{stem}{sidecar_ext}"
                if sidecar.is_file():
                    t = archive_dir / sidecar.name
                    if t not in seen:
                        seen.add(t)
                        moves.append((sidecar, t))

            if ext == WEB_SUFFIX:
                for orig_ext in VIDEO_EXTS:
                    orig = stories_dir / f"{stem}{orig_ext}"
                    if orig.is_file():
                        t = archive_dir / orig.name
                        if t not in seen:
                            seen.add(t)
                            moves.append((orig, t))
            elif ext in VIDEO_EXTS:
                web = stories_dir / f"{stem}{WEB_SUFFIX}"
                if web.is_file():
                    t = archive_dir / web.name
                    if t not in seen:
                        seen.add(t)
                        moves.append((web, t))

    return moves


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", action="store_true", help="actually move files")
    parser.add_argument("--root", default=str(ROOT), help="photos root (default: %(default)s)")
    parser.add_argument(
        "--ttl-hours",
        type=float,
        default=DEFAULT_TTL_HOURS,
        help="age threshold in hours (default: %(default)s)",
    )
    args = parser.parse_args()

    root = Path(args.root)
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        return 1

    moves = collect_moves(root, args.ttl_hours)
    if not moves:
        print(f"Nothing to archive in {root} (TTL {args.ttl_hours}h)")
        return 0

    archives_to_create = sorted({dst.parent for _, dst in moves if not dst.parent.exists()})

    print(f"Plan ({args.ttl_hours}h TTL):")
    print(f"  {len(moves)} file(s) into {len(archives_to_create)} archive folder(s)")
    print()
    for src, dst in moves:
        print(f"  {src.relative_to(root)}  ->  {dst.relative_to(root)}")

    if not args.commit:
        print()
        print("(dry run — pass --commit to apply)")
        return 0

    print()
    print("Applying...")
    for parent in archives_to_create:
        parent.mkdir(parents=True, exist_ok=True)

    moved = 0
    for src, dst in moves:
        if dst.exists():
            print(f"  skip (exists): {dst.relative_to(root)}", file=sys.stderr)
            continue
        shutil.move(str(src), str(dst))
        moved += 1
    print(f"Archived {moved} file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
