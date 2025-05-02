import type { TransportationProblem, Solution, Allocation, Step } from "@/src/lib/types"
import { findMinCostCell } from "@/src/lib/utils"

export function solveLCM(problem: TransportationProblem): Solution {
  const { supply, demand, costs } = problem

  // Create copies of supply and demand arrays to track remaining values
  const remainingSupply = [...supply]
  const remainingDemand = [...demand]

  const allocations: Allocation[] = []
  const steps: Step[] = []

  while (remainingSupply.some((s) => s > 0) && remainingDemand.some((d) => d > 0)) {
    // Find cell with minimum cost
    const { source, destination } = findMinCostCell(costs, remainingSupply, remainingDemand)

    if (source === -1 || destination === -1) {
      break
    }

    const currentSupply = remainingSupply[source]
    const currentDemand = remainingDemand[destination]

    // Determine allocation amount
    const allocation = Math.min(currentSupply, currentDemand)

    // Create allocation
    const allocationObj: Allocation = {
      source,
      destination,
      value: allocation,
    }

    allocations.push(allocationObj)

    // Update remaining supply and demand
    remainingSupply[source] -= allocation
    remainingDemand[destination] -= allocation

    // Create step
    const step: Step = {
      type: "allocation",
      description: `Allocate ${allocation} units from Source ${source + 1} to Destination ${destination + 1} (minimum cost: ${costs[source][destination]})`,
      allocation: allocationObj,
      remainingSupply: [...remainingSupply],
      remainingDemand: [...remainingDemand],
    }

    steps.push(step)
  }

  // Calculate total cost
  const totalCost = allocations.reduce(
    (sum, allocation) => sum + allocation.value * costs[allocation.source][allocation.destination],
    0,
  )

  return {
    allocations,
    totalCost,
    steps,
  }
}
