# Research status dashboard (PUBLIC_SAFE)

A sanitized, public status page for an internal computational-research
campaign, served on GitHub Pages.

## What this repo intentionally does NOT contain

- No raw simulation inputs/outputs (no `pw.out`, `.xyz`, `.cif`, `.cube`,
  `.glb`, volumetric data, or atomic coordinates)
- No exact energies, charges, rankings, or other unpublished numbers
- No internal job names, cloud storage paths, project/bucket identifiers,
  local paths, or credentials

## How the page gets its data

The frontend renders **only** [`public-data.json`](public-data.json):
job **aliases** (`JOB-nn`), coarse status/progress/elapsed time, and
categorical summary codes. The file is produced by a private tool (kept
outside this repo) and must pass the allowlist validator before publishing:

```
python tools/validate_public_data.py public-data.json
```

The validator rejects unknown keys, free text, and any value outside the
documented enums/ranges — publishing anything else fails closed.

## Modes

- **PUBLIC_SAFE** (this repo, default): summary-only, no research originals,
  no login UI (client-side "logins" on static hosting are decorative and are
  deliberately avoided).
- **AUTHENTICATED**: the full dashboard (structures, detailed results) is
  served from a private deployment behind Google Cloud IAP — every asset
  inside the same authentication boundary. Not part of this repo.

## Frontend policy

- No `innerHTML` with data; DOM built via `createElement`/`textContent`
- CSP meta (`default-src 'none'`, self-only sources), `noindex`, no CDN
  dependencies, no downloads
- Service worker caches only the allowlisted app shell; `activate` deletes
  all older caches (including pre-v2 caches on previously installed clients)
