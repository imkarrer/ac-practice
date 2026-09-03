# Player status page (GitHub Pages)

Public repo for the join README and live leaderboard. **Do not** copy the whole `ac-host` tree here — it contains NixOS host config and secrets paths.

## Layout

| Path | Role |
| --- | --- |
| `/` (`index.html`, `leaderboard.json`) | Production |
| `/dev/` (`dev/index.html`, `dev/leaderboard.json`) | Isolated test lobby (slot 8 / HTTP 8089) |

Same repo, same Pages branch — no second GitHub Pages site.

## One-time setup

1. Create a public repo (default name `ac-practice`).
2. Copy everything in this `site/` folder to the repo root (including `dev/`).
3. Enable **GitHub Pages**: Settings → Pages → Deploy from branch → `main` / root.
4. Seed tokens on the box (never commit them):
   ```bash
   gh auth token | sudo AC_STATE=/var/lib/ac-host python3 seed_github_env.py --env prod
   gh auth token | sudo AC_STATE=/var/lib/ac-host-dev python3 seed_github_env.py --env dev
   ```
5. Upload the patched 124 zip once: `python scripts/publish_124.py --owner imkarrer` from `ac-host/` on your PC.

Pages URL: https://imkarrer.github.io/ac-practice/  
Dev URL: https://imkarrer.github.io/ac-practice/dev/

## Live status (push from home server)

| Stack | `GITHUB_STATUS_PATH` | Page |
| --- | --- | --- |
| prod | `leaderboard.json` | `/` |
| dev | `dev/leaderboard.json` | `/dev/` |

| Env var | Example |
| --- | --- |
| `GITHUB_STATUS_TOKEN` | `gh auth token` or fine-grained PAT |
| `GITHUB_STATUS_REPO` | `imkarrer/ac-practice` |
| `GITHUB_STATUS_BRANCH` | `main` |

Occupancy and laps may lag ~30–60s (debounce + Pages CDN). The page shows the `updated` timestamp.

## Content Manager

`content.json` and `dev/content.json` list **only** the patched 124 Spider (shared GitHub Release). GR86, Civic, tracks, and CSP must be installed from the source links before joining.
