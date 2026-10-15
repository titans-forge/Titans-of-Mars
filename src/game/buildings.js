export const BUILDINGS = {
  cargo: {
    id: 'cargo', name: 'Cargo Lander', frame: 0, category: 'mission', buildable: false,
    description: 'Temporary command shelter and the colony\'s remaining imported stores.',
    powerUse: 5, maintenance: 0.4, labor: { operations: 0.5 },
  },
  solar: {
    id: 'solar', name: 'Solar Array', frame: 1, category: 'power', buildable: true,
    description: 'Reliable in clear weather. Dust fronts can reduce output by more than two thirds.',
    cost: { parts: 35, cargo: 1.4 }, power: 55, maintenance: 0.5, labor: { engineering: 0.15 },
  },
  nuclear: {
    id: 'nuclear', name: 'Fission Surface Unit', frame: 2, category: 'power', buildable: true,
    description: 'Expensive imported baseload power that remains stable through dust and darkness.',
    cost: { parts: 85, cargo: 3.2 }, power: 150, maintenance: 1.4, labor: { engineering: 1 },
  },
  ice: {
    id: 'ice', name: 'Ice Extraction Rig', frame: 3, category: 'life-support', buildable: true,
    description: 'Mines subsurface ice and feeds the settlement water loop.',
    cost: { parts: 45, cargo: 1.8 }, powerUse: 18, water: 54, maintenance: 0.8, labor: { operations: 1 },
  },
  habitat: {
    id: 'habitat', name: 'Pressure Habitat', frame: 4, category: 'habitation', buildable: true,
    description: 'Permanent bunks, storm shelter and medical support for eight colonists.',
    cost: { parts: 70, cargo: 2.2 }, powerUse: 26, waterUse: 6, oxygenUse: 6,
    crewCapacity: 8, maintenance: 0.9, labor: { operations: 0.25 },
  },
  oxygen: {
    id: 'oxygen', name: 'Oxygen Plant', frame: 5, category: 'life-support', buildable: true,
    description: 'Electrolyzes water and maintains breathable reserves.',
    cost: { parts: 50, cargo: 1.6 }, powerUse: 20, waterUse: 8, oxygen: 58, maintenance: 0.8, labor: { engineering: 0.5, operations: 0.5 },
  },
  workshop: {
    id: 'workshop', name: 'Machine Workshop', frame: 6, category: 'industry', buildable: true,
    description: 'Processes provisioned metal feedstock into replacement parts. Feedstock is bundled for this short campaign.',
    cost: { parts: 60, cargo: 2 }, powerUse: 18, parts: 12, maintenance: 0.7, labor: { engineering: 1.25, operations: 0.5 },
  },
  storage: {
    id: 'storage', name: 'Reserve Tanks', frame: 7, category: 'storage', buildable: true,
    description: 'Protected water and oxygen capacity for emergencies and transfer delays.',
    cost: { parts: 30, cargo: 1 }, powerUse: 3, waterCapacity: 1800,
    oxygenCapacity: 1400, maintenance: 0.3, labor: { operations: 0.15 },
  },
  battery: {
    id: 'battery', name: 'Grid Battery Bank', atlas: 'building-expansion', frame: 0, category: 'power', buildable: true,
    description: 'A 6 MWh storage block. Stores surplus and supplies limited backup power; the reserve must cover the full 24.6-hour sol.',
    cost: { parts: 52, cargo: 1.6 }, powerUse: 1, batteryCapacity: 6000, batteryChargeRate: 85,
    batteryDischargeRate: 110, maintenance: 0.7, labor: { engineering: 0.6 },
  },
  greenhouse: {
    id: 'greenhouse', name: 'Sealed Greenhouse', atlas: 'building-expansion', frame: 1, category: 'life-support', buildable: true,
    description: 'Turns water, power, crew time, and a provisioned nutrient stock into a renewable food supply. Nutrients are bundled for this short campaign.',
    cost: { parts: 55, cargo: 2 }, powerUse: 28, waterUse: 12, food: 18,
    maintenance: 0.7, labor: { operations: 0.5, support: 0.25 },
  },
  recycling: {
    id: 'recycling', name: 'Water Reclamation Plant', atlas: 'building-expansion', frame: 2, category: 'life-support', buildable: true,
    description: 'Recovers water from habitat waste streams and reduces dependence on continuous ice hauling.',
    cost: { parts: 45, cargo: 1.4 }, powerUse: 14, waterRecovery: 0.42,
    maintenance: 0.5, labor: { engineering: 0.25, operations: 0.35 },
  },
}

export const BUILD_MENU = ['solar', 'nuclear', 'battery', 'ice', 'habitat', 'oxygen', 'greenhouse', 'recycling', 'workshop', 'storage']

export function buildingById(id) {
  return BUILDINGS[id]
}
