# Player status page (GitHub Pages)

Public repo for the join README and live leaderboard. **Do not** copy the whole `ac-host` tree here — it contains NixOS host config and secrets paths.

## One-time setup

1. Create a public repo (default name `ac-practice`).
2. Copy everything in this `site/` folder to the repo root (`index.html`, `content.json`, `leaderboard.json`, this README).
3. Replace `imkarrer` in `content.json` with your GitHub username (or edit after `publish_124.py` runs).
4. Enable **GitHub Pages**: Settings → Pages → Deploy from branch → `main` / root.
5. Create a fine-grained PAT with **Contents: Read and write** on this repo only. On the NixOS box, set `GITHUB_STATUS_TOKEN` in `/var/lib/ac-host/.env` (never commit it).
6. Upload the patched 124 zip once: `python scripts/publish_124.py --owner imkarrer` from `ac-host/` on your PC.

Pages URL: `https://imkarrer.github.io/ac-practice/`

## Live status (push from home server)

The game box runs `plugin.py`, which writes `leaderboard.json` locally and PUTs the same JSON to this repo via the GitHub Contents API. No inbound port on the home server.

| Env var | Example |
| --- | --- |
| `GITHUB_STATUS_TOKEN` | fine-grained PAT |
| `GITHUB_STATUS_REPO` | `yourname/ac-practice` |
| `GITHUB_STATUS_BRANCH` | `main` |
| `GITHUB_STATUS_PATH` | `leaderboard.json` |

Occupancy and laps may lag ~30–60s (debounce + Pages CDN). The page shows the `updated` timestamp.

## Content Manager

`content.json` in this repo lists **only** the patched 124 Spider (GitHub Release). GR86, Civic, tracks, and CSP must be installed from the source links on `index.html` before joining. CM “Download missing content” will fetch the 124 only.

On the game box, set `AC_GITHUB_OWNER`, `AC_GITHUB_REPO`, and `AC_PAGES_URL` in `.env` so `acctl.py` generates matching `state/dist/content.json` for the details sidecar.
