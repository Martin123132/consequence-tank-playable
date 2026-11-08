# Consequence Tank

**A playable experiment in routing, disruption and consequence memory.**

[Play in your browser](https://martin123132.github.io/consequence-tank-playable/)
| [Download preview.4](https://github.com/Martin123132/consequence-tank-playable/releases/tag/v0.1.0-preview.4)
| [Source and local setup](source/README.md)

Created by Martin Ollett. Copyright (c) 2026 TWO HANDS NETWORK LTD.

Run a synthetic warehouse shift, change routing policies, inspect memory fields
and compare deliveries, damage and energy. Five modes, four scenarios, repeatable
seeds, replay links and copyable result snapshots. No account or API key required.

## Gate-Change Challenge

[Play the matched challenge](https://martin123132.github.io/consequence-tank-playable/challenge/)
| [Replay just before the gate changes](https://martin123132.github.io/consequence-tank-playable/challenge/#challenge=gate-v1&seed=42&change=520&step=519)
| [Challenge source and setup](challenge-source/README.md)

Run **Direct routing** and **Success memory** side by side, move the gate-change
time, and share an exact replay. Initial conditions, per-event costs and random
task streams are paired; shared success memory is the intentional policy
difference. Neither policy has Oracle's hazard-map knowledge or knows the future
change time. Total and post-change results are shown separately, without a
combined winner score.

This is a separate `gate-v1` experiment, not a new mode for the original
playground. Gate changes affect damaging cells, not physical walls. Compute and
memory costs, collisions and real robot physics are not modelled. One replay is
not a benchmark, and success memory can retain routes that become harmful.

## Three Replays To Try

Watch the silent, captioned [36-second demo in the preview.4 release](https://github.com/Martin123132/consequence-tank-playable/releases/tag/v0.1.0-preview.4),
then explore the same situations below. The clip uses actual playground
captures with condensed playback, not real-time footage.

Each replay opens paused. Press **Run**; use **Results** to inspect the totals.
All three use Normal shift and finish at step 900.

### 1. Keep Moving After The Gate Changes

[Start at step 500](https://martin123132.github.io/consequence-tank-playable/#mode=adaptive_candidate_efficient&scenario=normal_shift&seed=42&step=500)
| [Completed run](https://martin123132.github.io/consequence-tank-playable/#mode=adaptive_candidate_efficient&scenario=normal_shift&seed=42&step=900)

**Efficient candidate, seed 42.** The gate changes at step 520. Watch routes
change and deliveries continue. The first delivery after the shift is at 522;
this selected run finishes with 162 deliveries.

### 2. Recovery Has A Price

[Start at step 213](https://martin123132.github.io/consequence-tank-playable/#mode=adaptive_candidate_lock&scenario=normal_shift&seed=5&step=213)
| [Completed run](https://martin123132.github.io/consequence-tank-playable/#mode=adaptive_candidate_lock&scenario=normal_shift&seed=5&step=900)

**Candidate memory, seed 5.** The first recovery starts at step 243. It uses
local movement history, not Oracle's hazard-map knowledge. The run finishes
with 144 deliveries and 616 synthetic damage. Recovery can restore movement
while increasing damage; it is not a safety guarantee.

### 3. What Full Map Knowledge Changes

[Start at step 500](https://martin123132.github.io/consequence-tank-playable/#mode=oracle&scenario=normal_shift&seed=42&step=500)
| [Completed run](https://martin123132.github.io/consequence-tank-playable/#mode=oracle&scenario=normal_shift&seed=42&step=900)

**Oracle (planned), seed 42.** Oracle knows the current hazard map, not future
changes. This run finishes with 163 deliveries and zero damage, but uses more
energy than Direct routing. Zero damage here is not a guarantee for other runs.

These are deliberately selected illustrations, not a benchmark or ranking.
Policies have unequal costs, repair rules and information. These results do
not isolate memory's effect or establish real-world savings or safety.

Found something interesting or confusing? Use **Copy replay link** in Results
and describe what you expected and what happened. Include your browser/device
when reporting an interface problem; no personal or customer data is needed.

## This Release

This repository preserves the reviewed `0.1.0-preview.4` playable release:

- `source/`: the unchanged 35-file source pack, including the actual simulation.
- `docs/` root: the unchanged seven-file static build served by GitHub Pages, plus
  a `.nojekyll` deployment marker.
- `release/preview.4-reviewed-manifest.json`: the original review inventory and
  hashes. Its historical review-only status records the pre-publication snapshot;
  this repository and release publish that approved snapshot.

The independently reviewed `gate-v1` challenge adds:

- `challenge-source/`: its 42-file source, test, configuration and notice pack.
- `docs/challenge/`: its seven-file static build, hosted alongside the playground.
- `release/gate-v1-reviewed-manifest.json`: its exact reviewed inventory and
  hashes. The historical review-only status records the approved local snapshot.

The original playground URLs, three replays, demo clip and preview.4 tag remain
unchanged. Challenge replay links use the `/challenge/` path and their own version.

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

For the challenge, use the same install/test/build commands from
`challenge-source/`, following [its setup instructions](challenge-source/README.md).
Its separate workflow job runs 52 tests, rebuilds the challenge and checks every
source, hosted and rebuilt file against the reviewed manifest. Both packs retain
the same company terms and third-party notices.

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
