export type Method = "nwcm" | "lcm" | "vam"

export interface TransportationProblem {
  supply: number[]
  demand: number[]
  costs: number[][]
}

export interface Allocation {
  source: number
  destination: number
  value: number
}

export interface PenaltyStep {
  type: "penalty"
  description: string
  rowPenalties?: number[]
  columnPenalties?: number[]
  maxPenaltyRow?: number
  maxPenaltyColumn?: number
}

export interface AllocationStep {
  type: "allocation"
  description: string
  allocation?: Allocation
  remainingSupply?: number[]
  remainingDemand?: number[]
}

export type Step = PenaltyStep | AllocationStep

export interface Solution {
  allocations: Allocation[]
  totalCost: number
  steps: Step[]
}
