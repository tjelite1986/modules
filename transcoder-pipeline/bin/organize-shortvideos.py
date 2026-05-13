#!/usr/bin/env python3
"""
Sort flat files in /mnt/4tb/elite/shortvideos/ into per-profile subfolders
based on filenames of the form:

    <profile>_<YYYY-MM-DD-HH-MM-SS>_<numericId>.<ext>

Examples:
    ch.reddit.fan_2026-05-06-18-21-19_1778084479878.web.mp4
        -> ch.reddit.fan/ch.reddit.fan_2026-05-06-18-21-19_1778084479878.web.mp4

Sidecars (.md, .jpg/.jpeg/.png/.webp posters, and the original-source variant
without `.web.mp4`) are moved alongside the video.

Files that don't match the pattern are left in place. Files already inside a
subdirectory are not touched.

Usage:
    elite-organize-shortvideos.py            # dry run, prints what would happen
    elite-organize-shortvideos.py --commit   # actually moves files
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

ROOT = Path("/mnt/4tb/elite/shortvideos")

# Allowed video extensions (the *primary* file we route on).
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}
# Sidecar extensions that should follow the primary file when its profile is
# detected. (.web.mp4 is a special case — see below.)
SIDECAR_EXTS = {".md", ".jpg", ".jpeg", ".png", ".webp"}

# The profile-name charset must match isValidProfile in src/lib/clips.ts:
# /^[A-Za-z0-9 ._\-()]+$/
PROFILE_RE = re.compile(r"^[A-Za-z0-9 ._\-()]+$")

# <profile>_<YYYY-MM-DD-HH-MM-SS>_<digits>
NAME_RE = re.compile(
    r"^(?P<profile>.+?)_(?P<ts>\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})_(?P<id>\d+)$"
)


def parse_basename(stem: str) -> str | None:
    """Return the profile name from a filename stem, or None if it doesn't match."""
    m = NAME_RE.match(stem)
    if not m:
        return None
    profile = m.group("profile")
    if not PROFILE_RE.match(profile):
        return None
    if ".." in profile:
        return None
    return profile


def split_extensions(path: Path) -> tuple[str, str]:
    """
    Split a filename into (stem, ext) treating `.web.mp4` as a single extension
    so the stem matches the corresponding original/poster files.
    """
    name = path.name
    if name.endswith(".web.mp4"):
        return name[: -len(".web.mp4")], ".web.mp4"
    return path.stem, path.suffix


def collect_moves(root: Path) -> list[tuple[Path, Path]]:
    """
    Walk the top level of `root` and produce a list of (source, destination)
    moves. Each detected profile contributes the primary video + any matching
    sidecars (.md, poster image, original-source variant if web.mp4 is primary).
    """
    moves: list[tuple[Path, Path]] = []
    seen_targets: set[Path] = set()

    for entry in sorted(root.iterdir()):
        if not entry.is_file():
            continue
        stem, ext = split_extensions(entry)
        if ext not in VIDEO_EXTS and ext != ".web.mp4":
            continue

        profile = parse_basename(stem)
        if profile is None:
            continue

        profile_dir = root / profile

        # The primary file itself.
        target = profile_dir / entry.name
        if target == entry:
            continue
        if target in seen_targets:
            continue
        seen_targets.add(target)
        moves.append((entry, target))

        # Sidecars sharing the stem.
        for sidecar_ext in SIDECAR_EXTS:
            sidecar = root / f"{stem}{sidecar_ext}"
            if sidecar.is_file():
                t = profile_dir / sidecar.name
                if t not in seen_targets:
                    seen_targets.add(t)
                    moves.append((sidecar, t))

        # If this is `<stem>.web.mp4`, also move `<stem>.<original_ext>` if any.
        if ext == ".web.mp4":
            for orig_ext in VIDEO_EXTS:
                orig = root / f"{stem}{orig_ext}"
                if orig.is_file():
                    t = profile_dir / orig.name
                    if t not in seen_targets:
                        seen_targets.add(t)
                        moves.append((orig, t))
        # If primary is an original (e.g. .mp4), also move companion .web.mp4.
        else:
            web = root / f"{stem}.web.mp4"
            if web.is_file():
                t = profile_dir / web.name
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
