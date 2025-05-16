"use client"
import type { TransportationProblem, Solution, Method, OptimizationResult, Allocation, AllocationStep, UVStep } from "@/src/lib/types"

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

  const findPivotCellForStep = (step: AllocationStep, prevStep?: AllocationStep): { source: number; destination: number } | undefined => {
    // If the step already has a pivot cell defined, use it
    if (step.pivotCell) {
      return step.pivotCell;
    }

    // If there's no previous step (i.e., first step), the allocation in this step is the pivot
    if (!prevStep || !prevStep.allAllocations || prevStep.allAllocations.length === 0) {
      // For first step, if there's only one allocation, it's definitely the pivot
      if (step.allAllocations && step.allAllocations.length === 1) {
        return {
          source: step.allAllocations[0].source,
          destination: step.allAllocations[0].destination
        };
      }
      return undefined; // Can't determine pivot for first step with multiple allocations
    }

    // Find the new allocation in current step that isn't in the previous step
    const newAllocation = step.allAllocations?.find(curr => 
      !prevStep.allAllocations?.some(prev => 
        prev.source === curr.source && prev.destination === curr.destination
      )
    );

    if (newAllocation) {
      return {
        source: newAllocation.source,
        destination: newAllocation.destination
      };
    }

    return undefined;
  };

  // Function to render an allocation table
  const renderAllocationTable = (
    allocations: Allocation[],
    title: string,
    showCostImprovement = false,
    epsilonGridToUse?: boolean[][] // Parameter for the grid
  ) => {
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
                      );
                      const isDummy = isDummyCell(sourceIndex, destIndex);
                      const isEpsilon = epsilonGridToUse?.[sourceIndex]?.[destIndex]; // USE THE GRID

                      return (
                        <td
                          key={`cell-${sourceIndex}-${destIndex}`}
                          className={`p-2 border text-center ${
                            isDummy ? "bg-gray-100" : allocation ? "bg-blue-600/10" : ""
                          }`}
                        >
                          {allocation ? (
                            <div>
                              <div className="font-bold">
                                {isEpsilon ? "ε" : formatNumber(allocation.value)} {/* DISPLAY ε */}
                              </div>
                              <div className="text-xs text-gray-500">Cost: {problem.costs[sourceIndex][destIndex]}</div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">Cost: {problem.costs[sourceIndex][destIndex]}</div>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 border text-center font-medium">
                      {(() => {
                        const baseValue = formatNumber(problem.supply[sourceIndex]);
                        const rowEpsilon = epsilonGridToUse && epsilonGridToUse[sourceIndex]?.some(isEps => isEps);
                        return <>{baseValue}{rowEpsilon ? <span> + ε</span> : ""}</>;
                      })()}
                    </td>
                  </tr>
                ))}
                <tr>
                  <th className="p-2 border">Demand</th>
                  {problem.demand.map((d, index) => (
                    <td
                      key={`demand-${index}`}
                      className={`p-2 border text-center font-medium ${isDummyCell(0, index) ? "bg-gray-100" : ""}`}
                    >
                      {(() => {
                        const baseValue = formatNumber(d);
                        const colEpsilon = epsilonGridToUse && problem.supply.some((_, rIdx) => epsilonGridToUse[rIdx]?.[index]);
                        return <>{baseValue}{colEpsilon ? <span> + ε</span> : ""}</>;
                      })()}
                    </td>
                  ))}
                  <td className="p-2 border"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

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
          {renderAllocationTable(initialSolution.allocations, "Initial Solution", false, initialSolution.epsilonGrid)}

          {/* Optimized solution (if available) */}
          {isOptimizationResult && optimizedSolution && (
            <>
              {renderAllocationTable(optimizedSolution.allocations, "Optimized Solution (MODI Method)", true, optimizedSolution.epsilonGrid)}

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
            {initialSteps.map((step, stepIndex) => {
              // Get the previous step (if available)
              const prevStep = stepIndex > 0 ? initialSteps[stepIndex - 1] as AllocationStep : undefined;
              
              // Find the pivot cell for this step
              const inferredPivotCell = step.type === "allocation" 
                ? findPivotCellForStep(step as AllocationStep, prevStep as AllocationStep) 
                : undefined;

              return (
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
                                  const allocationsForStep = (step as AllocationStep).allAllocations || [];
                                  const allocation = allocationsForStep.find(
                                    (a) => a.source === sourceIndex && a.destination === destIndex
                                  );
                                  const isEpsilon = (step as AllocationStep).epsilonGrid?.[sourceIndex]?.[destIndex];

                                  // Check if this is a pivot cell - using both explicit pivotCell and our inferred one
                                  const isPivotCell = 
                                    ((step as AllocationStep).pivotCell?.source === sourceIndex && 
                                     (step as AllocationStep).pivotCell?.destination === destIndex) ||
                                    (inferredPivotCell?.source === sourceIndex && 
                                     inferredPivotCell?.destination === destIndex);
                                  
                                  // Check if the cell cannot be filled (source depleted or destination satisfied)
                                  const sourceExhausted = step.remainingSupply?.[sourceIndex] === 0;
                                  const destinationSatisfied = step.remainingDemand?.[destIndex] === 0;
                                  const cannotBeFilled = sourceExhausted || destinationSatisfied;

                                  return (
                                    <td
                                      key={`step-cell-${sourceIndex}-${destIndex}`}
                                      className={`p-2 border text-center ${
                                        isPivotCell
                                          ? "bg-yellow-300 border-yellow-600 border-2"
                                          : allocation
                                            ? "bg-blue-600/10"
                                            : cannotBeFilled
                                              ? "bg-gray-200"  // Gray out unavailable cells
                                              : ""
                                      }`}
                                    >
                                      {allocation ? (
                                        <div>
                                          <div className="font-bold">
                                            {isEpsilon ? "ε" : formatNumber(allocation.value)} {/* DISPLAY ε */}
                                          </div>
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
                                  {(() => {
                                    const stepEpsilonGrid = (step as AllocationStep).epsilonGrid;
                                    const rowHasEpsilonInThisStep = stepEpsilonGrid && stepEpsilonGrid[sourceIndex]?.some(isEps => isEps);
                                    // Use step's remaining supply for display
                                    const currentStepSupply = (step as AllocationStep).remainingSupply?.[sourceIndex] ?? 0;
                                    const baseValueString = formatNumber(currentStepSupply);
                                    return <>{baseValueString}{rowHasEpsilonInThisStep && baseValueString !== "ε" && currentStepSupply !== 0 ? <span> + ε</span> : ""}</>;
                                  })()}
                                </td>
                              </tr>
                            ))}
                            <tr>
                              <th className="p-2 border">Demand</th>
                              {((step as AllocationStep).remainingDemand!).map((d_step_remaining, index) => { // d_step_remaining is the remaining demand for the step
                                // Use step's remaining demand for display
                                const baseValueString = formatNumber(d_step_remaining);
                                const stepEpsilonGrid = (step as AllocationStep).epsilonGrid;
                                const colHasEpsilonInThisStep = stepEpsilonGrid && problem.supply.some((_, rIdx) => stepEpsilonGrid[rIdx]?.[index]);
                                return (
                                  <td
                                    key={`step-demand-${index}`}
                                    className={`p-2 border text-center font-medium ${isDummyCell(0, index) ? "bg-gray-100" : ""}`}
                                  >
                                    <>{baseValueString}{colHasEpsilonInThisStep && baseValueString !== "ε" && d_step_remaining !== 0 ? <span> + ε</span> : ""}</>
                                  </td>
                                );
                              })}
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
              );
            })}
          </div>

          {/* Optimization steps */}
          {isOptimizationResult && optimizationSteps.length > 0 && (
            <div>
              <h4 className="font-medium text-lg mb-4 pb-2 border-b">Optimization Steps (MODI Method)</h4>
              {optimizationSteps.map((step, stepIndex) => {
                // const overallStepIndex = initialSteps.length + stepIndex;
                // const currentAllocations = getAllocationsAtStep(overallStepIndex); // Use step.allAllocations instead

                return (
                  <div key={`opt-step-${stepIndex}`} className="border rounded-lg mb-4">
                    <div className="p-4 border-b bg-blue-50">
                      <h4 className="font-medium">Optimization Step {stepIndex + 1}</h4>
                    </div>
                    <div className="p-4">
                      <p className="mb-2">{step.description}</p>
                      {step.type === "uv" && (
                        <div className="mt-2">
                          <h5 className="font-medium mb-2">Current Allocation (Before Cycle Change):</h5>
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
                                      const allocationsForStep = (step as UVStep).allAllocations || [];
                                      const allocation = allocationsForStep.find(
                                        (a) => a.source === sourceIndex && a.destination === destIndex,
                                      );
                                      const isEpsilon = (step as UVStep).epsilonGrid?.[sourceIndex]?.[destIndex];
                                      const isDummy = isDummyCell(sourceIndex, destIndex);
                                      const cycleCells = step.cycle || [];
                                      const isCycleCell = cycleCells.some(c => c.source === sourceIndex && c.destination === destIndex);
                                      let cycleSign = 0;
                                      if (isCycleCell) {
                                        const cycleCellIndex = cycleCells.findIndex(c => c.source === sourceIndex && c.destination === destIndex);
                                        cycleSign = cycleCellIndex % 2 === 0 ? 1 : -1;
                                      }
                                      const isEnteringCell = step.enteringCell?.source === sourceIndex && step.enteringCell?.destination === destIndex;

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
                                                {isEpsilon ? "ε" : formatNumber(allocation.value)}
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
                                      );
                                    })}
                                    <td className="p-2 border text-center font-medium">
                                      {(() => {
                                        const stepEpsilonGrid = (step as UVStep).epsilonGrid;
                                        const rowEpsilon = stepEpsilonGrid && stepEpsilonGrid[sourceIndex]?.some(isEps => isEps);
                                        const baseValue = formatNumber(problem.supply[sourceIndex]);
                                        return <>{baseValue}{rowEpsilon ? <span> + ε</span> : ""}</>;
                                      })()}
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
                                      {(() => {
                                        const stepEpsilonGrid = (step as UVStep).epsilonGrid;
                                        const colEpsilon = stepEpsilonGrid && problem.supply.some((_, rIdx) => stepEpsilonGrid[rIdx]?.[index]);
                                        const baseValue = formatNumber(d);
                                        return <>{baseValue}{colEpsilon ? <span> + ε</span> : ""}</>;
                                      })()}
                                    </td>
                                  ))}
                                  <td className="p-2 border"></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* START: Display U and V values */}
                          {step.uValues && step.vValues && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <h5 className="font-medium mb-1 text-sm">U Values (Sources)</h5>
                                <ul className="list-disc list-inside text-xs">
                                  {step.uValues.map((u, index) => (
                                    <li key={`u-val-${index}`}>
                                      U<sub>{index + 1}</sub>: {formatNumber(u)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <h5 className="font-medium mb-1 text-sm">V Values (Destinations)</h5>
                                <ul className="list-disc list-inside text-xs">
                                  {step.vValues.map((v, index) => (
                                    <li key={`v-val-${index}`}>
                                      V<sub>{index + 1}</sub>: {formatNumber(v)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                          {/* END: Display U and V values */

                          /* START: Display Opportunity Costs */
                          step.opportunityCosts && (
                            <div className="mb-4">
                              <h5 className="font-medium mb-2 text-sm">Opportunity Costs (C<sub>ij</sub> - U<sub>i</sub> - V<sub>j</sub>)</h5>
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-xs">
                                  <thead>
                                    <tr>
                                      <th className="p-1 border bg-gray-50"></th>
                                      {Array.from({ length: problem.demand.length }).map((_, destIndex) => (
                                        <th key={`opp-th-d-${destIndex}`} className={`p-1 border bg-gray-50 ${isDummyCell(0, destIndex) ? "font-normal text-gray-400" : ""}`}>
                                          D{destIndex + 1}
                                          {isDummyCell(0, destIndex) && <span className="text-xs"> (Dummy)</span>}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {step.opportunityCosts.map((row, sourceIndex) => (
                                      <tr key={`opp-tr-${sourceIndex}`}>
                                        <th className={`p-1 border bg-gray-50 ${isDummyCell(sourceIndex, 0) ? "font-normal text-gray-400" : ""}`}>
                                          S{sourceIndex + 1}
                                          {isDummyCell(sourceIndex, 0) && <span className="text-xs"> (Dummy)</span>}
                                        </th>
                                        {row.map((cost, destIndex) => {
                                          const isCurrentEnteringCell = step.enteringCell?.source === sourceIndex && step.enteringCell?.destination === destIndex;
                                          const isAllocated = (step.allAllocations || []).some(a => a.source === sourceIndex && a.destination === destIndex);
                                          
                                          return (
                                            <td
                                              key={`opp-td-${sourceIndex}-${destIndex}`}
                                              className={`p-1 border text-center ${
                                                isCurrentEnteringCell ? "bg-yellow-300 font-bold border-yellow-500 border-2" :
                                                isAllocated ? "bg-gray-100 text-gray-400" : 
                                                cost < -1e-9 ? "bg-red-100 text-red-700 font-semibold" : 
                                                ""
                                              }`}
                                            >
                                              {isAllocated ? "0*" : formatNumber(cost)}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <p className="text-xs text-gray-500 mt-1">* Basic (allocated) cells have an opportunity cost of 0 by definition.</p>
                              </div>
                            </div>
                          )}
                          {/* END: Display Opportunity Costs */}

                          {/* START: Display Cycle Info */
                          step.cycle && step.cycle.length > 0 && step.leavingValue !== undefined && (
                            <div className="mb-4 text-xs">
                              <h5 className="font-medium mb-1 text-sm">Cycle and Reallocation</h5>
                              <p>
                                Entering Cell: (S{step.enteringCell!.source + 1}, D{step.enteringCell!.destination + 1})
                              </p>
                              <p>
                                Leaving Value (θ): {formatNumber(step.leavingValue)}
                              </p>
                              <p>
                                Cycle Path: {step.cycle.map(c => `(S${c.source + 1},D${c.destination + 1})`).join(" → ")}
                              </p>
                            </div>
                          )}
                          {/* END: Display Cycle Info */}
                        </div>
                      )}
                      {step.type === "allocation" && step.remainingSupply && step.remainingDemand && ( // Degenerate fix step
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
                                    const allocationsForStep = (step as AllocationStep).allAllocations || [];
                                    const allocation = allocationsForStep.find(
                                      (a) => a.source === sourceIndex && a.destination === destIndex
                                    );
                                    const isEpsilon = (step as AllocationStep).epsilonGrid?.[sourceIndex]?.[destIndex]; // USE STEP'S GRID
                                    return (
                                      <td
                                        key={`step-cell-${sourceIndex}-${destIndex}`}
                                        className={`p-2 border text-center ${
                                          allocation ? "bg-blue-600/10" : ""
                                        }`}
                                      >
                                        {allocation ? (
                                          <div>
                                            <div className="font-bold">
                                              {isEpsilon ? "ε" : formatNumber(allocation.value)} {/* DISPLAY ε */}
                                            </div>
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
                                    );
                                  })}
                                  <td className="p-2 border text-center font-medium">
                                    {(() => {
                                      const stepEpsilonGrid = (step as AllocationStep).epsilonGrid;
                                      const rowHasEpsilonInThisStep = stepEpsilonGrid && stepEpsilonGrid[sourceIndex]?.some(isEps => isEps);
                                      // Use original problem's supply as the base for display
                                      const originalProblemSupply = problem.supply[sourceIndex];
                                      const baseValueString = formatNumber(originalProblemSupply);
                                      return <>{baseValueString}{rowHasEpsilonInThisStep && baseValueString !== "ε" ? <span> + ε</span> : ""}</>;
                                    })()}
                                  </td>
                                </tr>
                              ))}
                              <tr>
                                <th className="p-2 border">Demand</th>
                                {(step.remainingDemand!).map((d_step_remaining, index) => { // d_step_remaining is the remaining demand for the step
                                  const originalProblemDemand = problem.demand[index]; // Get original problem demand for display
                                  const baseValueString = formatNumber(originalProblemDemand);
                                  const stepEpsilonGrid = (step as AllocationStep).epsilonGrid;
                                  const colHasEpsilonInThisStep = stepEpsilonGrid && problem.supply.some((_, rIdx) => stepEpsilonGrid[rIdx]?.[index]);
                                  return (
                                    <td
                                      key={`step-demand-${index}`}
                                      className={`p-2 border text-center font-medium ${isDummyCell(0, index) ? "bg-gray-100" : ""}`}
                                    >
                                      <>{baseValueString}{colHasEpsilonInThisStep && baseValueString !== "ε" ? <span> + ε</span> : ""}</>
                                    </td>
                                  );
                                })}
                                <td className="p-2 border"></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
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
