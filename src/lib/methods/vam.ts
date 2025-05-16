import type { TransportationProblem, Solution, Allocation, Step, AllocationStep, PenaltyStep } from "@/src/lib/types" // Added AllocationStep
import { calculatePenalties, findMaxPenaltyCell, createEpsilonGridFromAllocations } from "@/src/lib/utils" // Added createEpsilonGridFromAllocations

export function solveVAM(problem: TransportationProblem): Solution {
  const { supply, demand, costs } = problem
  const m = supply.length // Number of sources
  const n = demand.length // Number of destinations

  // Create copies of supply and demand arrays to track remaining values
  const remainingSupply = [...supply]
  const remainingDemand = [...demand]

  const finalAllocations: Allocation[] = [] // Renamed for clarity, these are for the final solution object
  const steps: Step[] = []
  const cumulativeAllocationsForSteps: Allocation[] = [] // To track allocations for each step

  while (remainingSupply.some((s) => s > 1e-9) && remainingDemand.some((d) => d > 1e-9)) {
    // Use a small threshold for float comparison
    // Calculate penalties
    const { rowPenalties, columnPenalties } = calculatePenalties(costs, remainingSupply, remainingDemand)

    // Add penalty calculation step
    steps.push({
      type: "penalty",
      description: "Calculate row and column penalties",
      rowPenalties,
      columnPenalties,
    } as PenaltyStep)

    // Find cell with maximum penalty
    const { source, destination } = findMaxPenaltyCell(
      costs,
      remainingSupply,
      remainingDemand,
      rowPenalties,
      columnPenalties,
    )

    if (source === -1 || destination === -1) {
      // This might happen if all remaining supplies/demands are zero or costs are prohibitive
      // or if calculatePenalties/findMaxPenaltyCell can't find a valid cell.
      break
    }

    const currentSupplyValue = remainingSupply[source]
    const currentDemandValue = remainingDemand[destination]

    // Determine allocation amount
    const allocationValue = Math.min(currentSupplyValue, currentDemandValue)

    if (allocationValue < 1e-9) {
      // Avoid creating zero or near-zero allocations if logic leads here
      // Mark the smaller of supply/demand as exhausted to prevent infinite loops
      if (currentSupplyValue <= currentDemandValue) {
        remainingSupply[source] = 0
      } else {
        remainingDemand[destination] = 0
      }
      continue
    }

    // Create allocation
    const allocationObj: Allocation = {
      source,
      destination,
      value: allocationValue,
    }

    finalAllocations.push(allocationObj)
    cumulativeAllocationsForSteps.push({ ...allocationObj }) // Add to cumulative list for steps

    // Update remaining supply and demand
    remainingSupply[source] -= allocationValue
    remainingDemand[destination] -= allocationValue

    // Create step
    const step: AllocationStep = {
      // Cast to AllocationStep
      type: "allocation",
      description: `Allocate ${allocationValue.toFixed(2)} units from Source ${source + 1} to Destination ${destination + 1} (cost: ${costs[source][destination]})`,
      allocation: { ...allocationObj },
      remainingSupply: [...remainingSupply],
      remainingDemand: [...remainingDemand],
      allAllocations: cumulativeAllocationsForSteps.map((a) => ({ ...a })), // All allocations up to this step
      epsilonGrid: createEpsilonGridFromAllocations(cumulativeAllocationsForSteps, m, n), // Grid for these allocations
    }

    steps.push(step)
  }

  // Calculate total cost
  const totalCost = finalAllocations.reduce(
    (sum, alloc) => sum + alloc.value * costs[alloc.source][alloc.destination],
    0,
  )

  return {
    allocations: finalAllocations,
    totalCost,
    steps,
    epsilonGrid: createEpsilonGridFromAllocations(finalAllocations, m, n), // Epsilon grid for the final solution
  }
}
