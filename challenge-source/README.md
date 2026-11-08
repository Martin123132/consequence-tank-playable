# Consequence Tank: Gate-Change Challenge

A playable, synthetic comparison of direct routing and shared success memory.
Move the safe corridor during a run and inspect the delivery, damage and energy
trade-offs. Both policies start with the same workload and per-event costs;
neither gets an Oracle hazard map or advance knowledge of the change time.

This is an experimental toy model, not a robotics benchmark or safety system.
One seed does not establish a winner. Shelves are visual landmarks; the gate
changes damaging cells, not impassable walls. Compute and memory costs, queues,
collisions and real robot physics are not modelled.

## Play And Replay

- Run, pause, reset or seek both maps together.
- Seed: 1-9999. Gate change: step 260-800. Runs finish at step 900.
- Changing the seed or gate timing resets both policies.
- Copy replay link captures the seed, timing, step and `gate-v1` rules.
- Copy result captures both sets of metrics, matched rules and limitations.

Replay fragment: `#challenge=gate-v1&seed=42&change=520&step=519`.
Links open paused and require this challenge build, not the original playground.
Unsupported replay versions are rejected visibly. Post-change metrics include
the selected change step. The rule version must change if the model changes.

Success memory records completed routes, including damaged trips. It can help
delivery totals while retaining routes that become harmful after the gate moves.
The display deliberately keeps total and post-change outcomes separate.

## Run Locally

Use Node.js 22.12 or newer and a current desktop or mobile browser. From this
source folder:

```sh
npm ci
npm test
npm run build
npm run preview
```

The preview prints its local URL. Stop it with Ctrl+C. Build output is
`dist/gate-challenge/`; its relative asset paths support a nested static-site
folder. No account, application backend, telemetry or browser storage is used.
Clipboard-denied browsers expose selectable replay/result text instead.

The package cache is local to this source folder. Set `TEMP` and `TMP` to a
local folder on the desired data drive before installing or testing if required.
The original playground tests are retained as shared-simulator regression checks.

## Licence

Source-available under the existing TWO HANDS NETWORK LTD company terms, not an
unrestricted open-source grant. Read `LICENSE.md`, `NOTICE.md` and
`COMMERCIAL-LICENSE.md`; commercial use needs a separate company licence.
Third-party dependency licences are retained in `THIRD-PARTY-NOTICES.txt`.

Contact Glyn: glyn@twohandsnetwork.co.uk.
