# Consequence Tank

**A playable experiment in routing, disruption and consequence memory.**

[Play in your browser](https://martin123132.github.io/consequence-tank-playable/)
| [Download preview.4](https://github.com/Martin123132/consequence-tank-playable/releases/tag/v0.1.0-preview.4)
| [Source and local setup](source/README.md)

Created by Martin Ollett. Copyright (c) 2026 TWO HANDS NETWORK LTD.

Run a synthetic warehouse shift, change routing policies, inspect memory fields
and compare deliveries, damage and energy. Five modes, four scenarios, repeatable
seeds, replay links and copyable result snapshots. No account or API key required.

## This Release

This repository publishes the reviewed `0.1.0-preview.4` playable release:

- `source/`: the unchanged 35-file source pack, including the actual simulation.
- `docs/`: the unchanged seven-file static build served by GitHub Pages, plus
  a `.nojekyll` deployment marker.
- `release/preview.4-reviewed-manifest.json`: the original review inventory and
  hashes. Its historical review-only status records the pre-publication snapshot;
  this repository and release publish that approved snapshot.

The wrapper README, licence copies and verification workflow support publication.
No private development history, partner data or local evidence workspace is included.
The source README is preserved as reviewed, including its pre-publication wording.

## Run And Verify

Follow [the source instructions](source/README.md), starting in `source/`.
Use Node.js 24 and npm. On the development laptop, files and caches remain on D:.

```powershell
cd source
$env:npm_config_cache = Join-Path (Get-Location) '.npm-cache'
$env:TEMP = Join-Path (Get-Location) '.tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP
npm.cmd ci --ignore-scripts
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

The public source has 36 tests. The release workflow checks source and site
hashes, runs those tests and checks the rebuilt site against the reviewed build.
The liveness audit has a Windows D-drive requirement as described in the source
README. The live playground itself needs only a modern JavaScript browser.

## What It Does Not Claim

This is a synthetic experiment, not a calibrated warehouse, robot controller or
safety assessment. Modes have unequal built-in costs and repair rules; Oracle
has privileged current-map knowledge. Candidate loop recovery can increase
damage. Results do not establish commercial savings or isolate memory's effect.
Finite liveness checks are not guarantees for every seed or environment.

The built app uses no telemetry, backend or persistent app storage. Browsers and
GitHub Pages may maintain their own normal history, caches and hosting logs.

## Licence And Contact

The existing company [PolyForm Noncommercial License 1.0.0](LICENSE.md),
[notice](NOTICE.md) and [commercial-use terms](COMMERCIAL-LICENSE.md) are unchanged.
This is source-available software, not OSI open source. Commercial use requires
a separate written licence from TWO HANDS NETWORK LTD.

Third-party dependencies retain their [own licences](THIRD-PARTY-NOTICES.txt).

For collaboration, product information or licensing enquiries:
**Glyn: glyn@twohandsnetwork.co.uk**.
