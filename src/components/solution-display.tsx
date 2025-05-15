"use client"
import type { TransportationProblem, Solution, Method, OptimizationResult, Allocation, Cell, AllocationStep } from "@/src/lib/types"

interface SolutionDisplayProps {
  solution: Solution | OptimizationResult
  problem: TransportationProblem
  originalProblem: TransportationProblem
  method: Method
  viewMode: "solution" | "steps"
  useUVOptimization: boolean
  isBalanced: boolean
}

export default function SolutionDisplay({
  solution,
  problem,
  originalProblem,
  method,
  viewMode,
  useUVOptimization,
  isBalanced,
}: SolutionDisplayProps) {
  const methodNames = {
    nwcm: "North-West Corner Method",
    lcm: "Least Cost Method",
    vam: "Vogel's Approximation Method",
  }

  // Determine if we have an optimization result or just a solution
  const isOptimizationResult = "initialSolution" in solution && "optimizedSolution" in solution

  // Get the initial and optimized solutions
  const initialSolution = isOptimizationResult ? solution.initialSolution : (solution as Solution)
  const optimizedSolution = isOptimizationResult ? solution.optimizedSolution : null

  // Get all steps for step-by-step view
  const initialSteps = initialSolution.steps
  const optimizationSteps = optimizedSolution ? optimizedSolution.steps : []

  // Function to get allocations at a specific step
  const getAllocationsAtStep = (stepIndex: number): Allocation[] => {
    if (!isOptimizationResult || stepIndex < initialSteps.length) {
      // For initial solution steps
      const allocations: Allocation[] = []
      for (let i = 0; i <= stepIndex; i++) {
        const step = initialSteps[i]
        if (step.type === "allocation" && "allocation" in step && step.allocation) {
          allocations.push(step.allocation)
        }
      }
      return allocations
    } else {
      // For optimization steps
      const optimizationStepIndex = stepIndex - initialSteps.length

      // Start with the initial solution's allocations
      let allocations = [...initialSolution.allocations]

      // Apply each optimization step up to the current one
      for (let i = 0; i <= optimizationStepIndex; i++) {
        const step = optimizationSteps[i]
        if (step.type === "uv" && step.cycle && step.leavingValue) {
          // Apply the cycle changes to the allocations
          allocations = applyUVStep(allocations, step.cycle, step.leavingValue)
        }
      }

      return allocations
    }
  }

  // Function to apply a UV step to the allocations
  const applyUVStep = (
    allocations: Allocation[],
    cycle: Cell[],
    leavingValue: number,
  ): Allocation[] => {
    if (!cycle || cycle.length === 0) return allocations

    // Create a deep copy of allocations
    const newAllocations = JSON.parse(JSON.stringify(allocations)) as Allocation[]

    // Apply the cycle changes
    for (let i = 0; i < cycle.length; i++) {
      const cell = cycle[i]
      const sign = i % 2 === 0 ? 1 : -1 // Add to even-indexed cells, subtract from odd-indexed

      // Find if this cell already has an allocation
      const existingIndex = newAllocations.findIndex(
        (a) => a.source === cell.source && a.destination === cell.destination,
      )

      if (existingIndex >= 0) {
        // Update existing allocation
        newAllocations[existingIndex].value += sign * leavingValue

        // Remove allocation if it becomes zero
        if (Math.abs(newAllocations[existingIndex].value) < 0.000001) {
          newAllocations.splice(existingIndex, 1)
        }
      } else {
        // Add new allocation
        newAllocations.push({
          source: cell.source,
          destination: cell.destination,
          value: sign * leavingValue, // This will be the entering variable
        })
      }
    }

    return newAllocations
  }

  // Function to format numbers to avoid displaying infinity
  const formatNumber = (num: number): string => {
    if (!isFinite(num)) return "0";

    // Display epsilon if ≤ 1e-6
    if (Math.abs(num) <= 1e-6 && num !== 0) {
      return "ε";
    }

    if (Math.abs(num) < 0.001) return "0";
    return num.toFixed(2);
  }

  // Function to determine if a cell is a dummy cell
  const isDummyCell = (sourceIndex: number, destIndex: number): boolean => {
    if (isBalanced) return false

    // If problem has more sources than original, the last ones are dummy
    if (problem.supply.length > originalProblem.supply.length && sourceIndex >= originalProblem.supply.length) {
      return true
    }

    // If problem has more destinations than original, the last ones are dummy
    if (problem.demand.length > originalProblem.demand.length && destIndex >= originalProblem.demand.length) {
      return true
    }

    return false
  }

  // Function to render an allocation table
  const renderAllocationTable = (allocations: Allocation[], title: string, showCostImprovement = false) => {
    // Calculate total cost
    const totalCost = allocations.reduce(
      (sum, allocation) => sum + allocation.value * problem.costs[allocation.source][allocation.destination],
      0,
    )

    // Calculate improvement if needed
    let improvement = 0
    if (showCostImprovement && initialSolution) {
      improvement = initialSolution.totalCost - totalCost
    }

    return (
      <div className="border rounded-lg mb-6">
        <div className="p-4 border-b">
          <h4 className="font-medium">{title}</h4>
          <div className="mt-2 font-bold text-blue-700">
            Total Cost: {formatNumber(totalCost)}
            {showCostImprovement && initialSolution && (
              <span className={`ml-2 text-sm ${improvement > 0 ? "text-green-600" : improvement < 0 ? "text-red-600" : "text-gray-600"}`}>
                {improvement > 0 
                  ? `(Improved by ${formatNumber(Math.abs(improvement))})` 
                  : improvement < 0 
                    ? `(Increased by ${formatNumber(Math.abs(improvement))})` 
                    : "(No change)"}
              </span>
            )}
          </div>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 border"></th>
                  {Array.from({ length: problem.demand.length }).map((_, index) => (
                    <th
                      key={`header-dest-${index}`}
                      className={`p-2 border ${isDummyCell(0, index) ? "bg-gray-100" : ""}`}
                    >
                      D{index + 1}
                      {isDummyCell(0, index) && <span className="text-xs text-gray-500"> (Dummy)</span>}
                    </th>
                  ))}
                  <th className="p-2 border">Supply</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: problem.supply.length }).map((_, sourceIndex) => (
                  <tr key={`row-${sourceIndex}`}>
                    <th className={`p-2 border ${isDummyCell(sourceIndex, 0) ? "bg-gray-100" : ""}`}>
                      S{sourceIndex + 1}
                      {isDummyCell(sourceIndex, 0) && <span className="text-xs text-gray-500"> (Dummy)</span>}
                    </th>
                    {Array.from({ length: problem.demand.length }).map((_, destIndex) => {
                      const allocation = allocations.find(
                        (a) => a.source === sourceIndex && a.destination === destIndex,
                      )
                      const isDummy = isDummyCell(sourceIndex, destIndex)

                      return (
                        <td
                          key={`cell-${sourceIndex}-${destIndex}`}
                          className={`p-2 border text-center ${
                            isDummy ? "bg-gray-100" : allocation ? "bg-blue-600/10" : ""
                          }`}
                        >
                          {allocation ? (
                            <div>
                              <div className="font-bold">{formatNumber(allocation.value)}</div>
                              <div className="text-xs text-gray-500">Cost: {problem.costs[sourceIndex][destIndex]}</div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">Cost: {problem.costs[sourceIndex][destIndex]}</div>
                          )}
                        </td>
                      )
                    })}
                    <td className="p-2 border text-center font-medium">{problem.supply[sourceIndex]}</td>
                  </tr>
                ))}
                <tr>
                  <th className="p-2 border">Demand</th>
                  {problem.demand.map((d, index) => (
                    <td
                      key={`demand-${index}`}
                      className={`p-2 border text-center font-medium ${isDummyCell(0, index) ? "bg-gray-100" : ""}`}
                    >
                      {d}
                    </td>
                  ))}
                  <td className="p-2 border"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">{methodNames[method]}</h3>
        </div>
      </div>

      {viewMode === "solution" ? (
        <div className="space-y-4">
          {/* Initial solution */}
          {renderAllocationTable(initialSolution.allocations, "Initial Solution")}

          {/* Optimized solution (if available) */}
          {isOptimizationResult && optimizedSolution && (
            <>
              {renderAllocationTable(optimizedSolution.allocations, "Optimized Solution (MODI Method)", true)}

              <div className="border rounded-lg">
                <div className="p-4 border-b">
                  <h4 className="font-medium">Allocation Details</h4>
                </div>
                <div className="p-4">
                  <ul className="space-y-2">
                    {optimizedSolution.allocations.map((allocation, index) => (
                      <li key={`allocation-${index}`}>
                        Allocated {formatNumber(allocation.value)} units from S{allocation.source + 1} to D
                        {allocation.destination + 1}
                        (Cost: {problem.costs[allocation.source][allocation.destination]} per unit)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          {/* If no optimization, show allocation details for initial solution */}
          {!isOptimizationResult && (
            <div className="border rounded-lg">
              <div className="p-4 border-b">
                <h4 className="font-medium">Allocation Details</h4>
              </div>
              <div className="p-4">
                <ul className="space-y-2">
                  {initialSolution.allocations.map((allocation, index) => (
                    <li key={`allocation-${index}`}>
                      Allocated {formatNumber(allocation.value)} units from S{allocation.source + 1} to D
                      {allocation.destination + 1}
                      (Cost: {problem.costs[allocation.source][allocation.destination]} per unit)
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Initial solution steps */}
          <div className="mb-6">
            <h4 className="font-medium text-lg mb-4 pb-2 border-b">Initial Solution Steps</h4>
            {initialSteps.map((step, stepIndex) => (
              <div key={`step-${stepIndex}`} className="border rounded-lg mb-4">
                <div className="p-4 border-b">
                  <h4 className="font-medium">Step {stepIndex + 1}</h4>
                </div>
                <div className="p-4">
                  <p className="mb-2">{step.description}</p>

                  {step.type === "allocation" && step.remainingSupply && step.remainingDemand && (
                    <div className="overflow-x-auto mt-2">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="p-2 border"></th>
                            {Array.from({ length: problem.demand.length }).map((_, index) => (
                              <th
                                key={`step-header-dest-${index}`}
                                className={`p-2 border ${isDummyCell(0, index) ? "bg-gray-100" : ""}`}
                              >
                                D{index + 1}
                                {isDummyCell(0, index) && <span className="text-xs text-gray-500"> (Dummy)</span>}
                              </th>
                            ))}
                            <th className="p-2 border">Supply</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: problem.supply.length }).map((_, sourceIndex) => (
                            <tr key={`step-row-${sourceIndex}`}>
                              <th className={`p-2 border ${isDummyCell(sourceIndex, 0) ? "bg-gray-100" : ""}`}>
                                S{sourceIndex + 1}
                                {isDummyCell(sourceIndex, 0) && <span className="text-xs text-gray-500"> (Dummy)</span>}
                              </th>
                              {Array.from({ length: problem.demand.length }).map((_, destIndex) => {
                                const relevantAllocations = step.allAllocations 
                                  ? step.allAllocations 
                                  : initialSteps
                                      .slice(0, stepIndex + 1)
                                      .filter((s) => s.type === "allocation" && "allocation" in s && s.allocation)
                                      .map((s) => (s as AllocationStep).allocation!);

                                const allocation = relevantAllocations.find(
                                  (a) => a.source === sourceIndex && a.destination === destIndex
                                );

                                return (
                                  <td
                                    key={`step-cell-${sourceIndex}-${destIndex}`}
                                    className={`p-2 border text-center ${
                                      allocation ? "bg-blue-600/10" : ""
                                    }`}
                                  >
                                    {allocation ? (
                                      <div>
                                        <div className="font-bold">{formatNumber(allocation.value)}</div>
                                        <div className="text-xs text-gray-500">
                                          Cost: {problem.costs[sourceIndex][destIndex]}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-xs text-gray-500">
                                        Cost: {problem.costs[sourceIndex][destIndex]}
                                      </div>
                                    )}
                                  </td>
                                )
                              })}
                              <td className="p-2 border text-center font-medium">
                                {problem.supply[sourceIndex]}
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <th className="p-2 border">Demand</th>
                            {(step.remainingDemand ?? problem.demand).map((d, index) => (
                              <td
                                key={`step-demand-${index}`}
                                className={`p-2 border text-center font-medium ${isDummyCell(0, index) ? "bg-gray-100" : ""}`}
                              >
                                {formatNumber(d)}
                              </td>
                            ))}
                            <td className="p-2 border"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {method === "vam" && step.type === "penalty" && (
                    <div className="mt-2">
                      <h5 className="font-medium mb-1">Penalties:</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h6 className="text-sm font-medium">Row Penalties:</h6>
                          <ul className="list-disc list-inside">
                            {step.rowPenalties?.map((penalty, idx) => (
                              <li key={`row-penalty-${idx}`}>
                                Row {idx + 1}: {formatNumber(penalty)}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h6 className="text-sm font-medium">Column Penalties:</h6>
                          <ul className="list-disc list-inside">
                            {step.columnPenalties?.map((penalty, idx) => (
                              <li key={`col-penalty-${idx}`}>
                                Column {idx + 1}: {formatNumber(penalty)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Optimization steps */}
          {isOptimizationResult && optimizationSteps.length > 0 && (
            <div>
              <h4 className="font-medium text-lg mb-4 pb-2 border-b">Optimization Steps (MODI Method)</h4>
              {optimizationSteps.map((step, stepIndex) => {
                const overallStepIndex = initialSteps.length + stepIndex
                const currentAllocations = getAllocationsAtStep(overallStepIndex)

                return (
                  <div key={`opt-step-${stepIndex}`} className="border rounded-lg mb-4">
                    <div className="p-4 border-b bg-blue-50">
                      <h4 className="font-medium">Optimization Step {stepIndex + 1}</h4>
                    </div>
                    <div className="p-4">
                      <p className="mb-2">{step.description}</p>

                      {step.type === "uv" && (
                        <div className="mt-2">
                          {/* Current allocation table with cycle visualization */}
                          <h5 className="font-medium mb-2">Current Allocation:</h5>
                          <div className="overflow-x-auto mb-4 relative">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr>
                                  <th className="p-2 border"></th>
                                  {Array.from({ length: problem.demand.length }).map((_, index) => (
                                    <th
                                      key={`curr-header-dest-${index}`}
                                      className={`p-2 border ${isDummyCell(0, index) ? "bg-gray-100" : ""}`}
                                    >
                                      D{index + 1}
                                      {isDummyCell(0, index) && <span className="text-xs text-gray-500"> (Dummy)</span>}
                                    </th>
                                  ))}
                                  <th className="p-2 border">Supply</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Array.from({ length: problem.supply.length }).map((_, sourceIndex) => (
                                  <tr key={`curr-row-${sourceIndex}`}>
                                    <th className={`p-2 border ${isDummyCell(sourceIndex, 0) ? "bg-gray-100" : ""}`}>
                                      S{sourceIndex + 1}
                                      {isDummyCell(sourceIndex, 0) && (
                                        <span className="text-xs text-gray-500"> (Dummy)</span>
                                      )}
                                    </th>
                                    {Array.from({ length: problem.demand.length }).map((_, destIndex) => {
                                      const allocation = currentAllocations.find(
                                        (a) => a.source === sourceIndex && a.destination === destIndex,
                                      )

                                      // Check if this cell is part of the cycle
                                      let isCycleCell = false
                                      let cycleSign = 0
                                      let cycleIndex = -1

                                      if (step.cycle) {
                                        cycleIndex = step.cycle.findIndex(
                                          (c) => c.source === sourceIndex && c.destination === destIndex,
                                        )
                                        if (cycleIndex >= 0) {
                                          isCycleCell = true
                                          cycleSign = cycleIndex % 2 === 0 ? 1 : -1
                                        }
                                      }

                                      // Check if this is the entering cell
                                      const isEnteringCell =
                                        step.enteringCell?.source === sourceIndex &&
                                        step.enteringCell?.destination === destIndex

                                      const isDummy = isDummyCell(sourceIndex, destIndex)

                                      return (
                                        <td
                                          key={`curr-cell-${sourceIndex}-${destIndex}`}
                                          className={`p-2 border text-center relative ${
                                            isDummy
                                              ? "bg-gray-100"
                                              : isEnteringCell
                                                ? "bg-yellow-300 border-yellow-600 border-2"
                                                : isCycleCell
                                                  ? cycleSign > 0
                                                    ? "bg-green-50"
                                                    : "bg-red-50"
                                                  : allocation
                                                    ? "bg-blue-600/10"
                                                    : ""
                                          }`}
                                        >
                                          {allocation ? (
                                            <div>
                                              <div className="font-bold">
                                                {formatNumber(allocation.value)}
                                                {isCycleCell && (
                                                  <span className={cycleSign > 0 ? "text-green-600" : "text-red-600"}>
                                                    {cycleSign > 0 ? " (+)" : " (-)"}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-xs text-gray-500">
                                                Cost: {problem.costs[sourceIndex][destIndex]}
                                              </div>
                                            </div>
                                          ) : (
                                            <div>
                                              {/* Show sign for empty cells that are part of the cycle */}
                                              {(isEnteringCell || isCycleCell) && (
                                                <div
                                                  className={`font-bold ${
                                                    isCycleCell && cycleSign < 0 ? "text-red-600" : "text-green-600"
                                                  }`}
                                                >
                                                  {isCycleCell && cycleSign < 0 ? "(-)" : "(+)"}
                                                </div>
                                              )}
                                              <div className="text-xs text-gray-500">
                                                Cost: {problem.costs[sourceIndex][destIndex]}
                                              </div>
                                            </div>
                                          )}
                                        </td>
                                      )
                                    })}
                                    <td className="p-2 border text-center font-medium">
                                      {problem.supply[sourceIndex]}
                                    </td>
                                  </tr>
                                ))}
                                <tr>
                                  <th className="p-2 border">Demand</th>
                                  {problem.demand.map((d, index) => (
                                    <td
                                      key={`curr-demand-${index}`}
                                      className={`p-2 border text-center font-medium ${isDummyCell(0, index) ? "bg-gray-100" : ""}`}
                                    >
                                      {d}
                                    </td>
                                  ))}
                                  <td className="p-2 border"></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {step.uValues && step.vValues && (
                            <div className="mb-4">
                              <h5 className="font-medium mb-1">U and V Values:</h5>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h6 className="text-sm font-medium">U Values:</h6>
                                  <ul className="list-disc list-inside">
                                    {step.uValues.map((value, idx) => (
                                      <li key={`u-value-${idx}`}>
                                        U{idx + 1}: {formatNumber(value)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <h6 className="text-sm font-medium">V Values:</h6>
                                  <ul className="list-disc list-inside">
                                    {step.vValues.map((value, idx) => (
                                      <li key={`v-value-${idx}`}>
                                        V{idx + 1}: {formatNumber(value)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}

                          {step.opportunityCosts && (
                            <div className="mb-4">
                              <h5 className="font-medium mb-1">Opportunity Costs (Cij - (Ui + Vj)):</h5>
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr>
                                      <th className="p-2 border"></th>
                                      {Array.from({ length: problem.demand.length }).map((_, index) => (
                                        <th
                                          key={`opp-header-${index}`}
                                          className={`p-2 border ${isDummyCell(0, index) ? "bg-gray-100" : ""}`}
                                        >
                                          D{index + 1}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {step.opportunityCosts.map((row, rowIndex) => (
                                      <tr key={`opp-row-${rowIndex}`}>
                                        <th className={`p-2 border ${isDummyCell(rowIndex, 0) ? "bg-gray-100" : ""}`}>
                                          S{rowIndex + 1}
                                        </th>
                                        {row.map((cost, colIndex) => {
                                          const isEnteringCell =
                                            step.enteringCell?.source === rowIndex &&
                                            step.enteringCell?.destination === colIndex

                                          // Check if this is a basic cell (has allocation)
                                          const isBasicCell = currentAllocations.some(
                                            (a) => a.source === rowIndex && a.destination === colIndex,
                                          )

                                          const isDummy = isDummyCell(rowIndex, colIndex)

                                          return (
                                            <td
                                              key={`opp-cell-${rowIndex}-${colIndex}`}
                                              className={`p-2 border text-center ${
                                                isDummy
                                                  ? "bg-gray-100"
                                                  : isEnteringCell
                                                    ? "bg-yellow-300 border-yellow-600 border-2"
                                                    : cost < 0
                                                      ? "bg-red-100"
                                                      : isBasicCell
                                                        ? "bg-gray-100"
                                                        : ""
                                              }`}
                                            >
                                              <span className={isBasicCell ? "text-gray-500" : ""}>
                                                {formatNumber(cost)}
                                              </span>
                                            </td>
                                          )
                                        })}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {step.cycle && step.cycle.length > 0 && (
                            <div className="mb-4">
                              <h5 className="font-medium mb-1">Cycle:</h5>
                              <p>
                                {step.cycle.map((cell, idx) => (
                                  <span key={`cycle-${idx}`}>
                                    (S{cell.source + 1}, D{cell.destination + 1})
                                    <span className={idx % 2 === 0 ? "text-green-600" : "text-red-600"}>
                                      {idx % 2 === 0 ? " (+)" : " (-)"}
                                    </span>
                                    {idx < (step.cycle?.length ?? 0) - 1 ? " → " : ""}
                                  </span>
                                ))}
                              </p>
                              {step.leavingValue && (
                                <p className="mt-1">
                                  Leaving value: <span className="font-medium">{formatNumber(step.leavingValue)}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* If this is an allocation step, show the same allocation table used in the initial steps */}
                      {step.type === "allocation" && step.remainingSupply && step.remainingDemand && (
                        <div className="overflow-x-auto mt-2">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr>
                                <th className="p-2 border"></th>
                                {Array.from({ length: problem.demand.length }).map((_, index) => (
                                  <th
                                    key={`step-header-dest-${index}`}
                                    className={`p-2 border ${isDummyCell(0, index) ? "bg-gray-100" : ""}`}
                                  >
                                    D{index + 1}
                                    {isDummyCell(0, index) && <span className="text-xs text-gray-500"> (Dummy)</span>}
                                  </th>
                                ))}
                                <th className="p-2 border">Supply</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({ length: problem.supply.length }).map((_, sourceIndex) => (
                                <tr key={`step-row-${sourceIndex}`}>
                                  <th className={`p-2 border ${isDummyCell(sourceIndex, 0) ? "bg-gray-100" : ""}`}>
                                    S{sourceIndex + 1}
                                    {isDummyCell(sourceIndex, 0) && <span className="text-xs text-gray-500"> (Dummy)</span>}
                                  </th>
                                  {Array.from({ length: problem.demand.length }).map((_, destIndex) => {
                                    const relevantAllocations = step.allAllocations 
                                      ? step.allAllocations 
                                      : initialSteps
                                          .slice(0, stepIndex + 1)
                                          .filter((s) => s.type === "allocation" && "allocation" in s && s.allocation)
                                          .map((s) => (s as AllocationStep).allocation!);

                                    const allocation = relevantAllocations.find(
                                      (a) => a.source === sourceIndex && a.destination === destIndex
                                    );

                                    return (
                                      <td
                                        key={`step-cell-${sourceIndex}-${destIndex}`}
                                        className={`p-2 border text-center ${
                                          allocation ? "bg-blue-600/10" : ""
                                        }`}
                                      >
                                        {allocation ? (
                                          <div>
                                            <div className="font-bold">{formatNumber(allocation.value)}</div>
                                            <div className="text-xs text-gray-500">
                                              Cost: {problem.costs[sourceIndex][destIndex]}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-xs text-gray-500">
                                            Cost: {problem.costs[sourceIndex][destIndex]}
                                          </div>
                                        )}
                                      </td>
                                    )
                                  })}
                                  <td className="p-2 border text-center font-medium">
                                    {formatNumber(step.remainingSupply?.[sourceIndex] ?? problem.supply[sourceIndex])}
                                  </td>
                                </tr>
                              ))}
                              <tr>
                                <th className="p-2 border">Demand</th>
                                {(step.remainingDemand ?? problem.demand).map((d, index) => (
                                  <td
                                    key={`step-demand-${index}`}
                                    className={`p-2 border text-center font-medium ${isDummyCell(0, index) ? "bg-gray-100" : ""}`}
                                  >
                                    {formatNumber(d)}
                                  </td>
                                ))}
                                <td className="p-2 border"></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Legend for UV optimization */}
          {useUVOptimization && (
            <div className="border rounded-lg mt-6">
              <div className="p-4 border-b">
                <h4 className="font-medium">Legend</h4>
              </div>
              <div className="p-4">
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <span className="w-4 h-4 bg-blue-600/10 inline-block mr-2"></span>
                    <span>Allocated cell</span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-4 h-4 bg-yellow-300 border-yellow-600 border-2 inline-block mr-2"></span>
                    <span>Entering cell (cell with most positive opportunity cost)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-4 h-4 bg-green-50 inline-block mr-2"></span>
                    <span>Cell where value is increased (+)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-4 h-4 bg-red-50 inline-block mr-2"></span>
                    <span>Cell where value is decreased (-)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-4 h-4 bg-red-100 inline-block mr-2"></span>
                    <span>Cell with negative opportunity cost (potential for improvement)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-4 h-4 bg-gray-100 inline-block mr-2"></span>
                    <span>Basic cell (opportunity cost is always 0) or dummy cell</span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-4 h-4 bg-gray-200 inline-block mr-2"></span>
                    <span>Unavailable cell (crossed out)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block mr-2 text-green-600 font-bold">+</span>
                    <span>Cells where units are added during reallocation (even positions in cycle)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block mr-2 text-red-600 font-bold">-</span>
                    <span>Cells where units are subtracted during reallocation (odd positions in cycle)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-4 h-4 border border-dashed border-yellow-500 inline-block mr-2"></span>
                    <span>
                      The cycle forms a rectangular or rectangular-like shape with only horizontal and vertical
                      movements
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
