// Missing jobs are commissioned legacy structures; pending sites only occupy land.
export const isCommissioned = (building) => !building?.construction
export const isOperational = (building) => Boolean(building && isCommissioned(building) && building.integrity > 0)
