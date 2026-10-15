# Regional terrain art provenance

The v0.4 landscape plates are **illustrative geology for fictional landing sites**. Their color, relief, camera and playable clearings are art direction. The pictures do not establish surveyed terrain, buried ice, traversability or resource yield. Those rules remain in the game's marked grid and simulation.

Three new PNGs were generated on 2026-10-15 with the built-in OpenAI `image_gen` tool, using the existing Arcadia terrain as a material, lighting and strategy-camera reference. The mode was reference-image generation of new regional illustrations. The original generated PNGs were copied into the project without bitmap edits; all three actual images are 1672 × 941 pixels. The runtime displays them within the 1200 × 680 map canvas. Full prompts are preserved verbatim in [TERRAIN_PROMPTS.json](./TERRAIN_PROMPTS.json).

The American campaign continues to use `public/assets/mars-terrain.png` unchanged from the prior candidate. It was originally recorded as OpenAI-generated project art on 2026-07-16 in the existing media provenance. This pass did not regenerate or edit it. The three new plates are generated artwork, and the NASA/JPL pages below are regional scientific references rather than source bitmaps or agency endorsement.

| Campaign | Region and visual direction | Project asset |
|---|---|---|
| American Compact | Arcadia Planitia: the existing rust-colored ridges and shelves | `public/assets/mars-terrain.png` |
| Chinese Directorate | Utopia Planitia: pale, low-relief polygonal plain with subdued pits and margins | `public/assets/terrain/utopia-v4.png` |
| European Cooperative | Elysium Planitia: darker, dusted basalt plain with shallow old flow margins | `public/assets/terrain/elysium-v4.png` |
| Russian Directorate | Isidis Planitia: warm basin-floor tones and low eroded rim blocks | `public/assets/terrain/isidis-v4.png` |

The reference pages describe rounded hills and ridges with smoother slope deposits in [Arcadia Planitia](https://science.nasa.gov/resource/arcadia-planitia/), polygon-cracked and pitted terrain in [western Utopia](https://www.jpl.nasa.gov/images/pia07839-polygons-in-utopia/), a broad smooth lava plain at the [InSight landing site in Elysium](https://www.jpl.nasa.gov/news/press_kits/insight/landing/mission/landing-site/), and rugged highland fragments surrounded by resurfaced lowland terrain along the [Isidis rim](https://science.nasa.gov/resource/isidis-rim/). The generated plates interpret these regional cues for a consistent game camera; they do not reproduce those observations at a specific scale or coordinate.

## File verification

| Asset | Bytes | SHA-256 |
|---|---:|---|
| Existing Arcadia | 2,771,137 | `ba6ecdb988404c5f49c1a9e126869a4e8dac4de5124197681ad2ceafe79ec261` |
| New Utopia | 3,491,441 | `dce411b7f8f399bd4f60775e5fc2a591e376e1a72609f6c951c319beea944959` |
| New Elysium | 3,529,351 | `18a1489dad4384dff3618335ddc6c76bfda714d399b72e1fd683d564eb827806` |
| New Isidis | 3,635,537 | `6edf8ddb6a978eb558e67e89a197eb686f440da4c09711dd86f745efb1c73e31` |

Local terrain-camera evidence retains the original generated-output paths, project-copy metadata and hashes. The source package carries these project-relative asset paths and the full prompts so the provenance remains useful without the original machine's directory layout. The HTML5 package includes this document, the prompts and the existing activity-art note alongside the game.

This document records provenance. The existing license and media-rights documents are unchanged in this pass.
