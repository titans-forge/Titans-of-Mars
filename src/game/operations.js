import { advanceConstruction } from './construction.js'
import { BUILDINGS } from './buildings.js'
import { advanceCrewStatus } from './crewMembers.js'
import { crewLabor } from './crewLabor.js'
import { roverOperations } from './roverOperations.js'
import { iceDepositAt, siteForSponsor, solarRidgeAt } from './siteFeatures.js'
import { buildUtilityNetwork } from './utilityNetwork.js'

export const SOL_HOURS = 24.6
export const RESERVE_HORIZON = 30
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const round = (n) => Math.round(n * 10) / 10
export const isStormActive = (sol) => sol >= 18 && sol <= 21
export const isDebrisActive = (sol) => sol >= 34 && sol <= 36
export const buildingEfficiency = (integrity) => clamp((integrity ?? 0) / 100, 0, 1)

// Shared ledger for [sol, sol + 1): tick, inspector and audit use delivered output.
export function colonyStats(state) {
  const storm = isStormActive(state.sol), debris = isDebrisActive(state.sol)
  const network = buildUtilityNetwork(state.buildings), connected = new Set(network.connectedUids)
  const labor = crewLabor(state, network.connectedUids), rovers = roverOperations(state), production = {}
  let basePowerCapacity = 0, powerDemand = 0, maintenance = 0, crewCapacity = 0
  let waterCapacity = 4000, oxygenCapacity = 3000, batteryCapacity = 0, batteryChargeRate = 0, batteryDischargeRate = 0
  let domesticWater = state.crew * 4.8, oxygenUse = state.crew * 7.2
  const iceRows = [], oxygenRows = [], foodRows = [], online = []
  const dustFactor = clamp(0.28 / siteForSponsor(state.sponsorId).dustSeverity, 0.18, 0.38)
  for (const placed of state.buildings) {
    const def = BUILDINGS[placed.type], efficiency = buildingEfficiency(placed.integrity)
    const row = production[placed.uid] = { online: connected.has(placed.uid) && efficiency > 0, efficiency, powerGeneration: 0, powerUse: 0, water: 0, oxygen: 0, food: 0, parts: 0, waterInput: 0, reason: '' }
    if (!def || !row.online) { row.reason = efficiency <= 0 ? 'Destroyed' : 'Outside the live utility network'; continue }
    online.push({ placed, def, row })
    const ridge = placed.type === 'solar' ? (solarRidgeAt(state, placed.col, placed.row)?.multiplier ?? 1) : 1
    row.powerGeneration = (def.power ?? 0) * efficiency * ridge * (placed.type === 'solar' && storm ? dustFactor : 1)
    basePowerCapacity += row.powerGeneration
    row.powerUse = def.powerUse ?? 0
    powerDemand += row.powerUse
    maintenance += (def.maintenance ?? 0) + (1 - efficiency) * 1.5
    crewCapacity += Math.floor((def.crewCapacity ?? 0) * efficiency)
    waterCapacity += (def.waterCapacity ?? 0) * efficiency
    oxygenCapacity += (def.oxygenCapacity ?? 0) * efficiency
    batteryCapacity += (def.batteryCapacity ?? 0) * efficiency
    batteryChargeRate += (def.batteryChargeRate ?? 0) * efficiency
    batteryDischargeRate += (def.batteryDischargeRate ?? 0) * efficiency
    if (placed.type === 'habitat') domesticWater += def.waterUse ?? 0
    oxygenUse += def.oxygenUse ?? 0
  }
  const storedEnergy = clamp(state.batteryCharge ?? 0, 0, batteryCapacity)
  const batteryDispatch = Math.min(Math.max(0, powerDemand - basePowerCapacity), storedEnergy / SOL_HOURS, batteryDischargeRate)
  const powerCapacity = basePowerCapacity + batteryDispatch
  const powerRatio = powerDemand <= 0 ? 1 : clamp(powerCapacity / powerDemand, 0, 1)
  let waterRecovery = 0, waterOutput = 0, oxygenOutput = 0, foodOutput = 0, partsOutput = 0
  for (const entry of online) {
    const { placed, def, row } = entry
    const factor = row.efficiency * labor.ratios.operations * powerRatio
    if (placed.type === 'ice') iceRows.push({ ...entry, fieldYield: iceDepositAt(state, placed.col, placed.row)?.yield ?? 0, factor })
    if (placed.type === 'oxygen') oxygenRows.push({ ...entry, factor })
    if (placed.type === 'greenhouse') foodRows.push({ ...entry, factor: row.efficiency * Math.min(labor.ratios.operations, labor.ratios.support) * powerRatio })
    row.parts = (def.parts ?? 0) * factor
    partsOutput += row.parts
    waterRecovery = Math.max(waterRecovery, (def.waterRecovery ?? 0) * factor)
    if (!row.reason && factor < 0.999 && ['ice', 'oxygen', 'greenhouse', 'workshop', 'recycling'].includes(placed.type)) row.reason = powerRatio < 0.999 ? 'Limited by electrical supply' : 'Limited by available shift coverage'
  }
  iceRows.sort((a, b) => b.fieldYield - a.fieldYield)
  iceRows.forEach((entry, i) => {
    entry.row.water = entry.fieldYield * entry.factor * (i < rovers.assignments.water ? 1 : 0.3)
    if (i >= rovers.assignments.water) entry.row.reason = 'No dedicated hauling rover: 30% field delivery'
    waterOutput += entry.row.water
  })
  // Reclamation recovers domestic wastewater, not water split by electrolysis.
  const domesticWaterUse = domesticWater * (1 - waterRecovery)
  let availableWater = Math.max(0, state.resources.water + waterOutput - domesticWaterUse)
  const supply = (rows, output) => {
    const wanted = rows.reduce((sum, { def, factor }) => sum + (def.waterUse ?? 0) * factor, 0)
    const waterRatio = wanted > 0 ? Math.min(1, availableWater / wanted) : 1
    for (const { def, factor, row } of rows) {
      row.waterInput = (def.waterUse ?? 0) * factor * waterRatio
      row[output] = (def[output] ?? 0) * factor * waterRatio
      if (waterRatio < 0.999) row.reason = 'Water reserved for crew first; process input is limited'
    }
    const used = wanted * waterRatio
    availableWater -= used
    return used
  }
  const oxygenWater = supply(oxygenRows, 'oxygen'), foodWater = supply(foodRows, 'food')
  oxygenOutput = oxygenRows.reduce((sum, { row }) => sum + row.oxygen, 0)
  foodOutput = foodRows.reduce((sum, { row }) => sum + row.food, 0)
  if (storm) maintenance += 2.5
  if (debris) maintenance += 4
  maintenance = Math.max(0, maintenance - rovers.maintenanceRelief)
  maintenance += (1 - labor.ratios.engineering) * 5
  maintenance *= state.policyEffects?.maintenanceMultiplier ?? 1
  const waterUse = domesticWaterUse + oxygenWater + foodWater
  return {
    storm, debris, powerCapacity: round(powerCapacity), basePowerCapacity: round(basePowerCapacity), powerDemand: round(powerDemand), powerRatio,
    waterNet: round(waterOutput - waterUse), oxygenNet: round(oxygenOutput - oxygenUse), foodNet: round(foodOutput - state.crew * 1.15), partsNet: round(partsOutput - maintenance),
    waterOutput: round(waterOutput), waterUse: round(waterUse), oxygenOutput: round(oxygenOutput), oxygenUse: round(oxygenUse), foodOutput: round(foodOutput), foodUse: round(state.crew * 1.15), partsOutput: round(partsOutput), maintenance: round(maintenance),
    crewCapacity, waterCapacity: round(waterCapacity), oxygenCapacity: round(oxygenCapacity), waterRecovery,
    batteryCapacity: round(batteryCapacity), batteryChargeRate: round(batteryChargeRate), batteryDischargeRate: round(batteryDischargeRate), batteryDispatch, batteryEnergyDispatched: batteryDispatch * SOL_HOURS,
    batteryEnergyCharged: Math.min(Math.max(0, batteryCapacity - storedEnergy), Math.min(Math.max(0, basePowerCapacity - powerDemand), batteryChargeRate) * SOL_HOURS),
    storedEnergy, network, rovers: { ...rovers, activeIceRigs: iceRows.length, supportedIceRigs: Math.min(iceRows.length, rovers.assignments.water) }, labor, production,
  }
}

export function operateSol(state, stats = colonyStats(state)) {
  const resources = { ...state.resources,
    water: clamp(round(state.resources.water + stats.waterNet), 0, stats.waterCapacity),
    oxygen: clamp(round(state.resources.oxygen + stats.oxygenNet), 0, stats.oxygenCapacity),
    food: clamp(round(state.resources.food + stats.foodNet), 0, 1000),
    parts: clamp(round(state.resources.parts + stats.partsNet), 0, 999),
  }
  const depleted = ['water', 'oxygen', 'food'].some((key) => resources[key] <= 0)
  let damage = depleted ? 8 : 0
  if (stats.powerRatio < 1) damage += Math.max(1, (stats.powerDemand - stats.powerCapacity) * 0.22)
  if (state.phase === 'expansion' && resources.parts <= 0) damage += 3
  if (state.phase === 'expansion' && stats.crewCapacity < state.crew) damage += 1.5
  damage += Math.max(0, 1 - stats.labor.ratios.support)
  resources.integrity = clamp(round(resources.integrity - damage), 0, 100)
  return { ...state, sol: state.sol + 1, resources, buildings: advanceConstruction(state, stats),
    batteryCharge: clamp(round(stats.storedEnergy + stats.batteryEnergyCharged - stats.batteryEnergyDispatched), 0, stats.batteryCapacity),
    crewMembers: advanceCrewStatus(state, stats, depleted),
  }
}

export function colonyAssessment(state, horizon = RESERVE_HORIZON) {
  horizon = Number.isFinite(horizon) ? Math.max(1, Math.min(365, Math.floor(horizon))) : RESERVE_HORIZON
  const stats = colonyStats(state)
  const coverage = Object.fromEntries(['water', 'oxygen', 'food', 'parts'].map((key) => [key, stats[`${key}Net`] >= 0 ? Infinity : state.resources[key] / -stats[`${key}Net`]]))
  const essentialPositive = ['water', 'oxygen', 'food'].every((key) => state.resources[key] > 0)
  const operates = (type) => state.buildings.some((b) => b.type === type && stats.production[b.uid]?.online && b.integrity >= 50 && (['workshop', 'greenhouse', 'oxygen', 'ice'].includes(type) ? (stats.production[b.uid][{ workshop: 'parts', greenhouse: 'food', oxygen: 'oxygen', ice: 'water' }[type]] > 0) : stats.powerRatio >= 0.99))
  let shadow = state, firstFailureSol = null, forecastReason = ''
  for (let day = 0; day < horizon; day += 1) {
    const tick = colonyStats(shadow)
    shadow = operateSol(shadow, tick)
    const empty = ['water', 'oxygen', 'food', 'parts'].find((key) => shadow.resources[key] <= 0)
    if (empty || tick.powerRatio < 0.99 || shadow.resources.integrity < 70 || tick.crewCapacity < state.crew) {
      firstFailureSol = day + 1
      forecastReason = empty ? `${empty} reserve runs out` : tick.powerRatio < 0.99 ? 'electrical demand is not fully supplied' : tick.crewCapacity < state.crew ? 'usable housing is insufficient' : 'colony integrity falls below 70%'
      break
    }
  }
  const checks = [
    { id: 'essential-reserves', label: 'Positive water, oxygen and food reserves', complete: essentialPositive, reason: essentialPositive ? 'Essential stores are present.' : 'An essential reserve is empty.' },
    { id: 'operating-systems', label: 'Operate local water, oxygen, food, recycling and industry', complete: ['ice', 'oxygen', 'greenhouse', 'recycling', 'workshop'].every(operates), reason: 'Systems must be connected, supplied and at least 50% intact.' },
    { id: 'housing-margin', label: `Usable housing for ${state.crew} crew`, complete: stats.crewCapacity >= state.crew, reason: `${stats.crewCapacity} usable bunks / ${state.crew} crew.` },
    { id: 'staffed-systems', label: 'At least 75% coverage of every essential shift', complete: Object.values(stats.labor.ratios).every((ratio) => ratio >= 0.75), reason: 'Engineering, surface operations and medical support all count.' },
    { id: 'operating-forecast', label: `Survive ${horizon} sols without new orders or deliveries`, complete: firstFailureSol === null, reason: firstFailureSol === null ? `${horizon}-sol operating projection passes; funded construction continues with current assignments and evolving crew; no new orders, incidents or deliveries.` : `Forecast day ${firstFailureSol}: ${forecastReason}.` },
  ]
  const independent = ['water', 'oxygen', 'food', 'parts'].every((key) => stats[`${key}Net`] >= 0) && stats.basePowerCapacity >= stats.powerDemand && essentialPositive
  return { horizon, viable: checks.every((c) => c.complete) && state.resources.integrity >= 70, independent, checks, constraints: checks.filter((c) => !c.complete).map((c) => c.reason), firstFailureSol, coverage, stats }
}
