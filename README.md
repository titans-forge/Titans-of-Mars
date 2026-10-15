# Titans of Mars: First City

Build the first Martian settlement capable of surviving when Earth cannot help it.

[Play in your browser](https://titans-forge.itch.io/titans-of-mars) · [Download v0.4.0](https://github.com/titans-forge/Titans-of-Mars/releases/tag/v0.4.0) · [Release licensing](./LICENSING.md)

This repository contains four playable founding campaigns: the American Public-Private Compact at Ares Pathfinder in 2033, the Chinese National Mars Directorate at Tianwen Settlement in 2034, the German-led European Mars Cooperative at Kepler Settlement in 2036, and the Russian Mars Directorate at Zvezda Settlement in 2038. Each begins on Sol 1 with a dust front forecast for Sol 18, but resources, personnel, rover doctrine, political constraints, and payload choices differ.

## Play locally

```bash
npm install
npm run dev
```

## Browser release

The production build is a self-contained HTML5 game and does not require GitHub, an AI model, or a server-side application. Run `npm run build`, ZIP the contents of `dist/` with `index.html` at the archive root, and upload it to an HTML5 host such as itch.io. The build stages the current license, preserved MIT notices, dependency notices and art provenance automatically; `npm run check:licenses` checks the staged copies. See [docs/ITCH_RELEASE.md](./docs/ITCH_RELEASE.md) for the page settings.

## Version 0.4.0

The terrain and camera pass gives each sponsor a distinct regional landscape: the existing Arcadia plate, pale polygonal Utopia, darker volcanic Elysium, and a warm Isidis basin margin. These are illustrative fictional landing sites; surveyed grid markers and the operating simulation determine resource yields. See [terrain art provenance](./docs/TERRAIN_ART.md) and the [portable generation prompts](./docs/TERRAIN_PROMPTS.json).

Use the map toolbar to zoom from 100% to 220%, **Focus** the selected structure, or return to **Overview**. Toggle **Pan** before dragging; placement and selection pause while pan mode is active. **Grid** and **Utilities** control the map overlays, with the construction grid kept visible while placing. When the toolbar has keyboard focus, `+` / `−` zoom, arrow keys pan, `0` resets, `F` focuses selection, and `P` toggles pan mode. Camera changes affect only the view.

Use **+1 sol** to learn the opening at your own pace; 1× advances once every five seconds. Start by assigning Ground Survey, confirm a lens, commission an ice rig, then restore hauling. Guides, roster, dispatch and construction planning pause time. The precise grid supports arrow-key placement with a forecast before confirmation. Saved Missions provides export, import, a previous-good backup and paused recovery.

The existing delivered-production ledger, 24.6-hour battery accounting, 30-sol no-delivery city forecast and finite construction queues remain in place. Directional rover and EVA activity follows actual assignments, paid work and pause/reduced-motion settings. See [activity art provenance](./docs/ACTIVITY_ART.md).

More animation frames and physical-device usability testing remain on the art and polish roadmap. This browser edition is not an Apple native-app release.

## Current gameplay

- Interactive isometric construction site rendered with Phaser, bounded zoom/pan, selection focus and optional grid/utility overlays.
- Founding sponsor selection with distinct American, Chinese, European, and Russian campaign baselines.
- Three sponsor-specific opening doctrines for each campaign.
- Conditional Sol 24 review with three sponsor-specific expansion strategies per campaign.
- Two sponsor-specific command crises per campaign, with permanent choices on Sol 12 and Sol 30.
- A sponsor-specific rival settlement, Sol 27 strategic encounter, and final Mars-order assessment.
- Ten buildable structures spanning power, storage, life support, food, water recycling, and local industry.
- Connected utility-grid placement: structures outside the live network remain offline.
- Rover dispatch between ice hauling, construction support, maintenance patrols, and ground survey, with visible activity derived from actual assignments.
- Real construction work queues: foundations, frame/services, assembly and commissioning, with shared crew/rover capacity and cancellable supply receipts.
- Four region-inspired terrain illustrations alongside sponsor-specific discoverable ice lenses, yields, dust severity and solar-ridge bonuses.
- Engineering, surface-operations, medical, and resident population cohorts with cross-training.
- Deterministic power, water, oxygen, food, maintenance, confidence, and integrity simulation.
- Named mission officers whose health, fatigue, and specialties affect settlement performance.
- State-driven operational incidents with persistent consequences and a campaign chronicle.
- Solar degradation during a four-sol dust storm.
- Structure-level storm and debris damage, reduced equipment efficiency, and parts-funded repairs.
- Mission objectives and state-based Sol 24 outcomes.
- A second expansion act, Sol 34 debris hazard, and Sol 42 permanent-city audit.
- A six-part final assessment covering resilience, independence, science, crew welfare, sponsor legitimacy, and diplomacy.
- Pause, one-sol step, 1x, 4x, and 12x simulation speeds.
- Guarded local browser saves, previous-good recovery and portable JSON import/export.
- An opt-in, self-hosted four-track classical soundtrack with source and rights links in the player.
- A nine-topic Mars Field Guide covering surface science, space weather, local resources, planetary history, and robotic exploration with NASA and JPL references.
- Responsive mission-control interface.

The core game requires no AI model or network connection.

## Verify

```bash
npm test
npm run build
```

## Roadmap

The four founding campaigns are complete through the Sol 42 permanent-city audit. A later game or major expansion may explore mature inter-settlement trade, government, and conflict; those systems are intentionally outside the scope of *First City*.

## License

This v0.4.0 edition identifies qualifying new Forge-controlled upgrade contributions under [Forge Game License 2.0](./LICENSE), edition FG2-TITANS-OF-MARS-V0.4.0-20261015. Earlier MIT and other applicable grants remain available for their material, including any legally effective grants attached to earlier copies. See the [release scope](./LICENSING.md), [preserved MIT text](./LICENSE-LEGACY-MIT.txt), [checkpoint](./LICENSING_CHECKPOINT.json) and [offline licensing page](./FORGE-LICENSING.html). Third-party media terms and generated-art provenance remain separately recorded in [MEDIA_RIGHTS.md](./MEDIA_RIGHTS.md), [activity art](./docs/ACTIVITY_ART.md) and [terrain art](./docs/TERRAIN_ART.md).
