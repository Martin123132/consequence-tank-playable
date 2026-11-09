# Consequence Tank: 60 Gate-Change Comparisons

Synthetic research report by TWO HANDS NETWORK LTD, 8 November 2026.
The existing company licence and commercial-use terms apply unchanged.

## What It Shows

Direct routing and Success memory are compared across seeds 5000-5019 and gate
changes at steps 260, 520 and 800. Each pair runs to step 900. All 60 pairs / 120
policy runs are retained; this is 20 distinct seeds reused at three timings.

Memory's full-run delivery difference averages -4.30, +5.15 and +11.25 across
early, middle and late changes. But in the equal first-100-post-change window,
Memory takes more damage in 56/60 pairs, the same in two, and less in two.
The full-run and post-change views answer different questions. This is not
evidence of general superiority, real-world savings or operational safety.

## Read And Replay

Open `index.html` directly in a browser. No server or installation is needed.
The report has all comparisons, descriptive variation and 180 unique replay
links. The three highlighted examples follow predeclared selection rules, not
a representative-sample claim. Public replay links need an internet connection.
`report.md` and `comparisons.csv` provide text and tabular alternatives.

## Check The Evidence

With Node.js installed, run this from the report folder:

```sh
node verify.mjs
```

This checks the release file hashes, all checkpoint differences, statistical
summaries, CSV values, selected examples and replay URLs. Its independent
arithmetic uses `runs.jsonl`, not the report's analysis helper. Hashes detect
changes against this manifest; they are not a digital signature or independent
proof that an experiment occurred. Keep the manifest hash from the release
review when comparing copies.

For a fresh engine replay, use the `challenge-source` folder at the exact public
commit in `provenance.json`. Install that source's locked dependencies first,
using a cache and temporary directory on a drive with sufficient space. Then:

```sh
node verify.mjs --engine <path-to-challenge-source>
```

This checks the frozen engine source hashes and replays all 60 comparisons at
all three saved checkpoints. It uses the source's installed Vite dependency,
starts no listening preview server, and closes its compiler when done. Cache
and temporary files go inside that source folder's `.tmp` directory. No engine
source files are edited. The currently served replay site can change in a
future release; the pinned source commit and hashes are the reproduction anchor.

## Limits And Scope

- First-100 means steps change through change+99, with change-1 as baseline.
- All-post-change windows have 641, 381 and 101 steps: unequal exposure.
- Seeds are a fixed engineering sample, not a random sample or blinded holdout.
- Damage and movement energy are synthetic. Less energy can mean fewer
  attempts or more repair time, not necessarily better efficiency.
- Gate changes affect harmful cells, not physical walls. Compute cost,
  collisions, queues, real robot physics and realistic charging are excluded.
- The report does not isolate a causal mechanism or prove a proposed fix.
- No policy tuning or `gate-v1` change is included in this report.

This pack includes only synthetic report data, a verifier, public baseline
metadata, and existing company notices. It includes no private engine history,
partner evidence, credentials, workstation paths or process records.

Company and contact details are in `LICENSE.md`, `COMMERCIAL-LICENSE.md` and
`NOTICE.md`. No licence text has been replaced or amended for this report.
