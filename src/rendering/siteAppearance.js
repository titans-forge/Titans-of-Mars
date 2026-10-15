// Visual site identities only. Resource cells and operating rules remain in siteFeatures.
// These regional interpretations are illustrative, not surveyed maps of the fictional sites.
export const SITE_APPEARANCES = Object.freeze({
  'american-compact': Object.freeze({ key: 'arcadia', name: 'Arcadia Planitia', textureKey: 'terrain-arcadia-v4', asset: './assets/mars-terrain.png', landform: 'Rust ridges and shallow shelves', accent: '#edb57d', palette: Object.freeze({ grid: 0xf1c080, fill: 0xd48c52, backdrop: 0x763420 }), source: 'https://science.nasa.gov/resource/arcadia-planitia/' }),
  'china-directorate': Object.freeze({ key: 'utopia', name: 'Utopia Planitia', textureKey: 'terrain-utopia-v4', asset: './assets/terrain/utopia-v4.png', landform: 'Polygon plain and scalloped margins', accent: '#c4c9ae', palette: Object.freeze({ grid: 0xd6d8bd, fill: 0xa9a28a, backdrop: 0x6b6454 }), source: 'https://www.jpl.nasa.gov/images/pia07839-polygons-in-utopia/' }),
  'europe-cooperative': Object.freeze({ key: 'elysium', name: 'Elysium Planitia', textureKey: 'terrain-elysium-v4', asset: './assets/terrain/elysium-v4.png', landform: 'Dark basalt and dusted lava benches', accent: '#bdc6d0', palette: Object.freeze({ grid: 0xc8d0d7, fill: 0x8b8f96, backdrop: 0x4a4948 }), source: 'https://www.jpl.nasa.gov/news/press_kits/insight/landing/mission/landing-site/' }),
  'russia-directorate': Object.freeze({ key: 'isidis', name: 'Isidis Planitia', textureKey: 'terrain-isidis-v4', asset: './assets/terrain/isidis-v4.png', landform: 'Basin-floor sands and eroded rim blocks', accent: '#dfc392', palette: Object.freeze({ grid: 0xe7d1a5, fill: 0xba9360, backdrop: 0x80644b }), source: 'https://science.nasa.gov/resource/isidis-rim/' }),
})
export function appearanceForSponsor(sponsorId) {
  return Object.hasOwn(SITE_APPEARANCES, sponsorId) ? SITE_APPEARANCES[sponsorId] : SITE_APPEARANCES['american-compact']
}
