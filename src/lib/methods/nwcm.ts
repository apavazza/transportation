import type { TransportationProblem, Solution, Allocation, Step, AllocationStep } from "@/src/lib/types" // Added AllocationStep
import { createEpsilonGridFromAllocations } from "@/src/lib/utils"; // Added createEpsilonGridFromAllocations

export function solveNWCM(problem: TransportationProblem): Solution {
  const { supply, demand, costs } = problem
  const m = supply.length; // Number of sources
  const n = demand.length; // Number of destinations

  // Create copies of supply and demand arrays to track remaining values
  const remainingSupply = [...supply]
  const remainingDemand = [...demand]

  const finalAllocations: Allocation[] = [] // Renamed for clarity
  const steps: Step[] = []
  const cumulativeAllocationsForSteps: Allocation[] = []; // To track allocations for each step

  let i = 0 // current source index
  let j = 0 // current destination index

  while (i < m && j < n) {
    const currentSupplyValue = remainingSupply[i]
    const currentDemandValue = remainingDemand[j]

    // Determine allocation amount
    const allocationValue = Math.min(currentSupplyValue, currentDemandValue)

    if (allocationValue > 1e-9) { // Only process if allocation is significant
      // Create allocation
      const allocationObj: Allocation = {
        source: i,
        destination: j,
        value: allocationValue,
      }

      finalAllocations.push(allocationObj)
      cumulativeAllocationsForSteps.push({ ...allocationObj }); // Add to cumulative list

      // Update remaining supply and demand
      remainingSupply[i] -= allocationValue
      remainingDemand[j] -= allocationValue

      // Create step
      const step: AllocationStep = { // Cast to AllocationStep
        type: "allocation",
        description: `Allocate ${allocationValue.toFixed(2)} units from Source ${i + 1} to Destination ${j + 1}`,
        allocation: { ...allocationObj },
        remainingSupply: [...remainingSupply],
        remainingDemand: [...remainingDemand],
        allAllocations: cumulativeAllocationsForSteps.map(a => ({ ...a })), // All allocations up to this step
        epsilonGrid: createEpsilonGridFromAllocations(cumulativeAllocationsForSteps, m, n), // Grid for these allocations
      }
      steps.push(step)
    }


    // Move to next cell
    // Use a small threshold for floating point comparisons
    if (remainingSupply[i] < 1e-9) {
      i++
    }
    if (remainingDemand[j] < 1e-9) { // Changed from else to if, as both can be exhausted simultaneously
      j++
    }
    // If allocationValue was effectively zero and neither i nor j incremented, force one to prevent infinite loop.
    // This case should ideally be handled by the allocationValue > 1e-9 check.
    // If after an allocation, both supply and demand for current cell are zero, NWCM typically moves i++ then j++ (or vice-versa).
    // The current logic: if supply[i] becomes 0, i increments. If demand[j] becomes 0, j increments.
    // If both become 0 from one allocation, i will increment, then in the next iteration, j will increment.
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
