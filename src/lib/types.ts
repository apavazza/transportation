export type Method = "nwcm" | "lcm" | "vam"
export type NodeType = "supply" | "demand" | "transshipment"

export interface TransportationProblem {
  supply: number[]
  demand: number[]
  costs: number[][]
  // Add transshipment support
  nodeTypes?: NodeType[] // Type of each node (supply, demand, or transshipment)
  isTransshipment?: boolean // Flag to indicate if this is a transshipment problem
  transshipmentCosts?: number[][] // Costs between all nodes (including transshipment nodes)
}

export interface Allocation {
  source: number
  destination: number
  value: number
}

export interface Cell {
  source: number
  destination: number
}

export type Cycle = Cell[];

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
  allAllocations?: Allocation[]
  epsilonGrid?: boolean[][]
  pivotCell?: { source: number; destination: number }
}

export interface UVStep {
  type: "uv"
  description: string
  uValues?: number[]
  vValues?: number[]
  opportunityCosts?: number[][]
  enteringCell?: Cell
  leavingValue?: number
  cycle?: Cell[]
  allAllocations?: Allocation[]
  epsilonGrid?: boolean[][]
}

export type Step = PenaltyStep | AllocationStep | UVStep

export interface Solution {
  allocations: Allocation[]
  totalCost: number
  steps: Step[]
  isOptimal?: boolean
  epsilonGrid?: boolean[][]
}

export interface OptimizationResult {
  initialSolution: Solution
  optimizedSolution: Solution
}

// New interfaces for transshipment problems
export interface TransshipmentNode {
  id: number
  type: NodeType
  value: number // Supply (positive), demand (negative), or transshipment (0)
  name: string
}

export interface TransshipmentLink {
  from: number
  to: number
  cost: number
  flow: number
}

export interface TransshipmentProblem extends TransportationProblem {
  nodes: TransshipmentNode[]
  links: TransshipmentLink[]
  balanceValue?: number
  transshipmentIndices?: number[]
  supplyNodesDemand?: number[]
  demandNodesSupply?: number[]
}
