# transcoder-pipeline

Host-side automation that keeps a self-hosted media library tidy.

## What it does

| Script                    | Triggered by                             | Effect |
|---------------------------|------------------------------------------|--------|
| `transcode.sh`            | `elite-transcode.timer` (every 5 min)    | Re-encode originals → `<slug>.web.mp4`, delete original. ffmpeg fast path, VLC fallback for broken DASH headers |
| `organize-shortvideos.py` | `/var/lib/elite-triggers/organize`       | Sort flat files into per-profile subfolders |
| `organize-shorts18.py`    | same                                     | Same for the 18+ tree (adds category layer) |
| `organize-photos.py`      | same                                     | Same for photos |
| `archive-expired-stories.py` | same                                  | Move stories older than 24h into `_expired/` |

## Why two transcoders?

ffmpeg is fast and reliable for most input — but some DASH-segment-only files (like ones yt-dlp downloads from FikFap) come without the codec config box and ffmpeg refuses to read the header. VLC's `cvlc` probes the bitstream directly and can decode them; the result is then remuxed by ffmpeg to add `+faststart`.

## Trigger model

Most jobs run as systemd timers (transcode every 5 min). For manual / on-demand runs, the unit files watch a sentinel file:

```bash
sudo -u elite touch /var/lib/elite-triggers/transcode   # run now
sudo -u elite touch /var/lib/elite-triggers/organize    # sort downloads
```

The unit deletes the sentinel before running, so dropping it again re-triggers the job.

## Install

See [module.json](./module.json) for the file map. Quick summary:

```bash
sudo useradd --system --home /var/lib/elite --shell /usr/sbin/nologin elite
sudo install -m 0755 bin/transcode.sh /usr/local/bin/elite-transcode.sh
sudo install -m 0755 bin/*.py /opt/elite/bin/
sudo cp systemd/*.{service,timer,path} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now elite-transcode.timer elite-trigger-transcode.path elite-trigger-organize.path
sudo install -d -m 0775 -o elite -g elite /var/lib/elite-triggers
```

## Configuration

All scripts read `ELITE_STORE_ROOT` (default `/mnt/storage/elite`) and look under `shortvideos/`, `shorts18/`, `tiktok/`, `photos/` for their respective inputs. Python scripts also accept `--root <path>` as an override.
