#!/usr/bin/env python3
"""
Sort flat files in /mnt/4tb/elite/photos/ into per-profile subfolders.

Rules, tried in order — first match wins:

    1. RedGIFs:    <tags>_by_<profile>___RedGIFs(_<n>)?
                   -> profile = the captured name
    2. FikFap:     anything ending in FikFap(_<n>)?
                   -> bucket "fikfap"
    3. RDT:        RDT_<digits>(_<digits>)?
                   -> bucket "rdt"
    4. Instagram:  <profile>_<id> where profile is lowercase a-z/0-9/._ (2-30
                   chars) and id is 10+ alphanumeric/_- chars
                   -> profile = the captured handle
    5. Catch-all:  everything else
                   -> bucket "misc"

Handles both images (.jpg/.jpeg/.png/.webp/.gif/.avif) and videos
(.mp4/.webm/.mov/.m4v + .web.mp4). Sidecars (.md, alt poster image,
paired .web.mp4 / original) follow the primary file.

Usage:
    elite-organize-photos.py            # dry run, prints what would happen
    elite-organize-photos.py --commit   # actually moves files
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

ROOT = Path("/mnt/4tb/elite/photos")

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}
SIDECAR_EXTS = {".md", ".jpg", ".jpeg", ".png", ".webp"}
WEB_SUFFIX = ".web.mp4"

# Match isValidProfile in src/lib/clips.ts.
PROFILE_RE = re.compile(r"^[A-Za-z0-9 ._\-()]+$")

REDGIFS_RE = re.compile(r"^.+?_by_(?P<profile>.+?)___RedGIFs(?:_\d+)?$")
FIKFAP_RE = re.compile(r"FikFap(?:_\d+)?$")
RDT_RE = re.compile(r"^RDT_\d+(?:_\d+)?$")
INSTAGRAM_RE = re.compile(r"^(?P<profile>[a-z0-9._]{2,30})_(?P<id>[A-Za-z0-9_-]{10,})$")
DEFAULT_BUCKET = "misc"


def parse_basename(stem: str) -> str:
    """Return the profile/bucket name for a filename stem. Always non-empty."""
    m = REDGIFS_RE.match(stem)
    if m:
        profile = m.group("profile")
        if PROFILE_RE.match(profile) and ".." not in profile:
            return profile
    if FIKFAP_RE.search(stem):
        return "fikfap"
    if RDT_RE.match(stem):
        return "rdt"
    m = INSTAGRAM_RE.match(stem)
    if m:
        profile = m.group("profile")
        if PROFILE_RE.match(profile) and ".." not in profile:
            return profile
    return DEFAULT_BUCKET


def split_extensions(path: Path) -> tuple[str, str]:
    name = path.name
    if name.endswith(WEB_SUFFIX):
        return name[: -len(WEB_SUFFIX)], WEB_SUFFIX
    return path.stem, path.suffix


def is_primary(ext: str) -> bool:
    return ext in IMAGE_EXTS or ext in VIDEO_EXTS or ext == WEB_SUFFIX


def collect_moves(root: Path) -> list[tuple[Path, Path]]:
    moves: list[tuple[Path, Path]] = []
    seen_targets: set[Path] = set()
    seen_sources: set[Path] = set()

    for entry in sorted(root.iterdir()):
        if not entry.is_file():
            continue
        if entry in seen_sources:
            continue
        stem, ext = split_extensions(entry)
        if not is_primary(ext):
            continue
        # Treat .jpg/.png/.webp as primary only if no same-stem video exists
        # (otherwise it's a poster sidecar handled below).
        if ext in IMAGE_EXTS:
            paired_video = any(
                (root / f"{stem}{v}").is_file() for v in VIDEO_EXTS
            ) or (root / f"{stem}{WEB_SUFFIX}").is_file()
            if paired_video:
                continue

        profile = parse_basename(stem)
        profile_dir = root / profile
        target = profile_dir / entry.name
        if target == entry:
            continue
        if target in seen_targets:
            continue
        seen_targets.add(target)
        seen_sources.add(entry)
        moves.append((entry, target))

        for sidecar_ext in SIDECAR_EXTS:
            sidecar = root / f"{stem}{sidecar_ext}"
            if sidecar == entry:
                continue
            if sidecar.is_file():
                t = profile_dir / sidecar.name
                if t not in seen_targets:
                    seen_targets.add(t)
                    seen_sources.add(sidecar)
                    moves.append((sidecar, t))

        if ext == WEB_SUFFIX:
            for orig_ext in VIDEO_EXTS:
                orig = root / f"{stem}{orig_ext}"
                if orig.is_file():
                    t = profile_dir / orig.name
                    if t not in seen_targets:
                        seen_targets.add(t)
                        seen_sources.add(orig)
                        moves.append((orig, t))
        elif ext in VIDEO_EXTS:
            web = root / f"{stem}{WEB_SUFFIX}"
            if web.is_file():
                t = profile_dir / web.name
                if t not in seen_targets:
                    seen_targets.add(t)
                    seen_sources.add(web)
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
