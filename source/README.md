# Consequence Tank

**A playable experiment in routing, disruption and consequence memory.**

Created by Martin Ollett. Copyright (c) 2026 TWO HANDS NETWORK LTD.

This source-available preview runs a real, deterministic TypeScript simulation
in your browser. It is not a video or a remote AI service. No account, API key,
telemetry or backend is required for the built playground.

## Play

Run a shift, jump to the disruption at step 220 or the gate change at step 520,
then compare the selected policy with direct routing. Switch between both maps,
inspect the memory fields, change the seed or scenario, and finish at step 900.
Changing policy replays to the same step; changing seed or scenario starts a new
run. Replay links encode mode, scenario, seed and step; they open paused.

Results contain both policies' actual metrics and the configuration needed to
reproduce them. Copy a result or replay link to share it. Everything remains in
memory until you explicitly copy it; a reload starts fresh unless a replay link
is in the address. Browsers may retain normal HTTP cache and history.

## Run Locally

Use Node.js 24 LTS and npm. On this Windows development laptop, all project
files, package caches, temporary files and output must stay on D:. Extract the
source folder somewhere on D:, open PowerShell there, then run:

```powershell
$env:npm_config_cache = Join-Path (Get-Location) '.npm-cache'
$env:TEMP = Join-Path (Get-Location) '.tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP
npm.cmd ci --ignore-scripts
npm.cmd run dev
```

Open the local URL printed by Vite. It binds to loopback, not your network.
Dependencies are downloaded during installation. The built app makes no
external service requests.

## Verify And Build

```powershell
npm.cmd test
npm.cmd run public:liveness
npm.cmd run public:liveness -- --validation
npm.cmd run build
npm.cmd audit --audit-level=moderate
npm.cmd audit --omit=dev --audit-level=moderate
npm.cmd run preview
```

`dist/public-playable` is the static site. Serve that directory over HTTP(S),
not by double-clicking the HTML. Its relative asset paths also support hosting
in a project subdirectory. The separate `site` directory in a prepared release
pack contains a prebuilt copy. No Vite server or local data API belongs on a
public production host. Host access logs and privacy settings depend on the
host chosen later; this preview does not choose or provision one.

## What The Results Mean

- This is a synthetic, scaled demonstration, not a calibrated warehouse,
  robot controller or safety assessment. Energy and damage are abstract units.
- Modes have different built-in costs, repairs and routing assumptions.
  Efficient candidate has advantages beyond memory. This demo does not isolate
  memory's causal effect or establish a commercial saving.
- Candidate memory detects repeated visits and briefly penalizes revisiting
  those cells. This uses its own movement history, not Oracle knowledge.
  Recovery can cross hazards and increase damage; it is a progress mechanism,
  not a safety guarantee. Result JSON records the policy and recovery counters.
- Oracle uses A* with privileged knowledge of the current hazard map, not future
  changes. It replans when gates change. If a gate closes around an agent, it
  escapes one cell at a time and pays normal damage/repair costs; it is not
  invulnerable. The older greedy research oracle is retained separately for
  reproducing historical runs. Shelves are visual landmarks, not
  collision geometry. More agents does not model real congestion or queues.
- One seed is an example, not statistical evidence. Equal-cost and fresh-seed
  research in the wider Tank project has exposed failures as well as gains;
  the experimental memory revisions are not promoted into these demo controls.
- This package contains the actual simulation source, including dormant
  controlled-experiment and pathfinding support required by that module. It
  does not contain the full local Analytics / Evidence / Audit workspace,
  partner data, private reports, development history or the separate Python
  Warehouse Safety project. It is a scoped playable release, not the whole repo.

## Licence And Contact

The existing [PolyForm Noncommercial License 1.0.0](LICENSE.md),
[company notice](NOTICE.md) and [commercial licensing terms](COMMERCIAL-LICENSE.md)
are included unchanged. This is source-available, not OSI open source.
Third-party dependencies retain their own licences; see
`THIRD-PARTY-NOTICES.txt` and the notices emitted in each build.

For collaboration, information on existing products, or other enquiries:
**Glyn: glyn@twohandsnetwork.co.uk**. Commercial licensing enquiries go to the
same company contact. No commercial licence is granted by downloading this pack.

Version: 0.1.0-preview.4. Local review candidate; publication is a separate step.
This polish revision improves seed editing, consistent scenario names and
visible recovery accounting. It does not change preview.3 simulation results.
Preview.3 added local loop recovery to playable Candidate memory. Preview.2
fixed the playable Oracle's greedy-routing stalls. Replay links reproduce within
the same app version, not across changed simulation rules. Use archived source
and site versions to reproduce older results. Snapshots record app and policy.

Seed edits apply on Enter or leaving the field; invalid input retains the current
seed and run. Results distinguish completed runs from partial snapshots. The
Candidate comparison shows recovery counts and its possible damage trade-off.

The liveness commands each check 1,000 runs across all five modes, four presets
and 50 seeds (the validation set is separate). They flag 32 active positions in
four or fewer cells and delivery gaps of at least 120 steps, tracking each
agent and excluding repair pauses from active positions. Their evidence stays
in `.tmp/mode-liveness`. This audit requires a D-drive checkout on this laptop.
Passing a finite synthetic audit does not prove every seed or environment safe.
