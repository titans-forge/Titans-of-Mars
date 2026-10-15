import { isOperational } from './buildingStatus.js'
export const UTILITY_REACH = 2

export function gridDistance(a, b) {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))
}

export function buildUtilityNetwork(buildings) {
  const operational = buildings.filter(isOperational)
  const connected = new Set(operational.filter((building) => building.type === 'cargo').map((building) => building.uid))
  const edges = []

  while (connected.size) {
    let nearest = null
    operational.forEach((candidate) => {
      if (connected.has(candidate.uid)) return
      operational.forEach((source) => {
        if (!connected.has(source.uid)) return
        const distance = gridDistance(source, candidate)
        if (distance > UTILITY_REACH) return
        if (!nearest || distance < nearest.distance || (distance === nearest.distance && candidate.uid < nearest.toUid)) {
          nearest = { fromUid: source.uid, toUid: candidate.uid, distance }
        }
      })
    })
    if (!nearest) break
    connected.add(nearest.toUid)
    edges.push(nearest)
  }

  const isolatedUids = operational.filter((building) => !connected.has(building.uid)).map((building) => building.uid)
  return {
    connectedUids: [...connected],
    isolatedUids,
    edges,
    online: connected.size,
    total: operational.length,
  }
}

export function cellWithinUtilityReach(buildings, network, col, row) {
  const connected = new Set(network.connectedUids)
  return buildings.some((building) => (
    connected.has(building.uid)
    && isOperational(building)
    && gridDistance(building, { col, row }) <= UTILITY_REACH
  ))
}
