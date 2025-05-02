import type { TransportationProblem, Solution, Allocation, Step } from "@/src/lib/types"

export function solveNWCM(problem: TransportationProblem): Solution {
  const { supply, demand, costs } = problem

  // Create copies of supply and demand arrays to track remaining values
  const remainingSupply = [...supply]
  const remainingDemand = [...demand]

  const allocations: Allocation[] = []
  const steps: Step[] = []

  let i = 0
  let j = 0

  while (i < remainingSupply.length && j < remainingDemand.length) {
    const currentSupply = remainingSupply[i]
    const currentDemand = remainingDemand[j]

    if (currentSupply <= 0) {
      i++
      continue
    }

    if (currentDemand <= 0) {
      j++
      continue
    }

    // Determine allocation amount
    const allocation = Math.min(currentSupply, currentDemand)

    // Create allocation
    const allocationObj: Allocation = {
      source: i,
      destination: j,
      value: allocation,
    }

    allocations.push(allocationObj)

    // Update remaining supply and demand
    remainingSupply[i] -= allocation
    remainingDemand[j] -= allocation

    // Create step
    const step: Step = {
      type: "allocation",
      description: `Allocate ${allocation} units from Source ${i + 1} to Destination ${j + 1}`,
      allocation: allocationObj,
      remainingSupply: [...remainingSupply],
      remainingDemand: [...remainingDemand],
    }

    steps.push(step)

    // Move to next cell
    if (remainingSupply[i] === 0) {
      i++
    } else {
      j++
    }
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
