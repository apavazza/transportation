import type { TransportationProblem, Solution, Allocation, Step, AllocationStep } from "@/src/lib/types" // Added AllocationStep
import { findMinCostCell, createEpsilonGridFromAllocations } from "@/src/lib/utils" // Added createEpsilonGridFromAllocations

export function solveLCM(problem: TransportationProblem): Solution {
  const { supply, demand, costs } = problem
  const m = supply.length // Number of sources
  const n = demand.length // Number of destinations

  // Create copies of supply and demand arrays to track remaining values
  const remainingSupply = [...supply]
  const remainingDemand = [...demand]

  const finalAllocations: Allocation[] = [] // Renamed for clarity
  const steps: Step[] = []
  const cumulativeAllocationsForSteps: Allocation[] = [] // To track allocations for each step

  while (remainingSupply.some((s) => s > 1e-9) && remainingDemand.some((d) => d > 1e-9)) {
    // Find cell with minimum cost
    const { source, destination } = findMinCostCell(costs, remainingSupply, remainingDemand)

    if (source === -1 || destination === -1) {
      break // No available cells to allocate
    }

    const currentSupplyValue = remainingSupply[source]
    const currentDemandValue = remainingDemand[destination]

    // Determine allocation amount
    const allocationValue = Math.min(currentSupplyValue, currentDemandValue)

    if (allocationValue < 1e-9) {
      // Avoid zero allocations if logic leads here
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
    cumulativeAllocationsForSteps.push({ ...allocationObj }) // Add to cumulative list

    // Update remaining supply and demand
    remainingSupply[source] -= allocationValue
    remainingDemand[destination] -= allocationValue

    // Create step
    const step: AllocationStep = {
      // Cast to AllocationStep
      type: "allocation",
      description: `Allocate ${allocationValue.toFixed(2)} units from Source ${source + 1} to Destination ${destination + 1} (minimum cost: ${costs[source][destination]})`,
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
