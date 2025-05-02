"use client"

import type { TransportationProblem, Solution, Method, Step, AllocationStep } from "@/src/lib/types"

function isAllocationStep(step: Step): step is AllocationStep {
  return step.type === "allocation";
}

interface SolutionDisplayProps {
  solution: Solution
  problem: TransportationProblem
  method: Method
  viewMode: "solution" | "steps"
}

export default function SolutionDisplay({ solution, problem, method, viewMode }: SolutionDisplayProps) {
  const methodNames = {
    nwcm: "North-West Corner Method",
    lcm: "Least Cost Method",
    vam: "Vogel's Approximation Method",
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">{methodNames[method]}</h3>
        </div>
        <div className="bg-blue-600/10 p-4 rounded-lg border border-blue-600/20 text-center">
          <h3 className="text-xl font-bold text-blue-700 dark:text-blue-400">
            Total Cost: {solution.totalCost}
          </h3>
        </div>
      </div>

      {viewMode === "solution" ? (
        <div className="space-y-4">
          <div className="border rounded-lg">
            <div className="p-4 border-b">
              <h4 className="font-medium">Final Allocation</h4>
            </div>
            <div className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 border"></th>
                      {Array.from({ length: problem.demand.length }).map((_, index) => (
                        <th key={`header-dest-${index}`} className="p-2 border">
                          D{index + 1}
                        </th>
                      ))}
                      <th className="p-2 border">Supply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: problem.supply.length }).map((_, sourceIndex) => (
                      <tr key={`row-${sourceIndex}`}>
                        <th className="p-2 border">S{sourceIndex + 1}</th>
                        {Array.from({ length: problem.demand.length }).map((_, destIndex) => {
                          const allocation = solution.allocations.find(
                            (a) => a.source === sourceIndex && a.destination === destIndex,
                          )

                          return (
                            <td
                              key={`cell-${sourceIndex}-${destIndex}`}
                              className={`p-2 border text-center ${allocation ? "bg-blue-600/10" : ""}`}
                            >
                              {allocation ? (
                                <div>
                                  <div className="font-bold">{allocation.value}</div>
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
                      {problem.demand.map((d, index) => (
                        <td key={`demand-${index}`} className="p-2 border text-center font-medium">
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

          <div className="border rounded-lg">
            <div className="p-4 border-b">
              <h4 className="font-medium">Allocation Details</h4>
            </div>
            <div className="p-4">
              <ul className="space-y-2">
                {solution.allocations.map((allocation, index) => (
                  <li key={`allocation-${index}`}>
                    Allocated {allocation.value} units from S{allocation.source + 1} to D{allocation.destination + 1}
                    (Cost: {problem.costs[allocation.source][allocation.destination]} per unit)
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {solution.steps.map((step, stepIndex) => (
            <div key={`step-${stepIndex}`} className="border rounded-lg">
              <div className="p-4 border-b">
                <h4 className="font-medium">Step {stepIndex + 1}</h4>
              </div>
              <div className="p-4">
                <p className="mb-2">{step.description}</p>

                {isAllocationStep(step) && (
                  (() => {
                    const allocStep = step;
                    return (
                      <div className="overflow-x-auto mt-2">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>
                              <th className="p-2 border"></th>
                              {Array.from({ length: problem.demand.length }).map((_, index) => (
                                <th key={`step-header-dest-${index}`} className="p-2 border">
                                  D{index + 1}
                                </th>
                              ))}
                              <th className="p-2 border">Supply</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: problem.supply.length }).map((_, sourceIndex) => (
                              <tr key={`step-row-${sourceIndex}`}>
                                <th className="p-2 border">S{sourceIndex + 1}</th>
                                {Array.from({ length: problem.demand.length }).map((_, destIndex) => {
                                  const isCurrentAllocation =
                                    allocStep.allocation?.source === sourceIndex &&
                                    allocStep.allocation?.destination === destIndex

                                  const previousAllocations = solution.steps
                                    .slice(0, stepIndex + 1)
                                    .filter(isAllocationStep)
                                    .filter((s) => s.allocation !== undefined)
                                    .map((s) => s.allocation!)

                                  const allocation = previousAllocations.find(
                                    (a) => a.source === sourceIndex && a.destination === destIndex,
                                  )

                                  const isCellUnavailable =
                                    (allocStep.remainingSupply?.[sourceIndex] ?? 0) <= 0 ||
                                    (allocStep.remainingDemand?.[destIndex] ?? 0) <= 0

                                  return (
                                    <td
                                      key={`step-cell-${sourceIndex}-${destIndex}`}
                                      className={`p-2 border text-center ${
                                        isCurrentAllocation
                                          ? "bg-blue-600/20"
                                          : allocation
                                          ? "bg-blue-600/10"
                                          : ""
                                      }`}
                                    >
                                      {allocation ? (
                                        <div>
                                          <div className="font-bold">{allocation.value}</div>
                                          <div className="text-xs text-gray-500">
                                            Cost: {problem.costs[sourceIndex][destIndex]}
                                          </div>
                                        </div>
                                      ) : (
                                        <div
                                          className={`text-xs text-gray-500 ${
                                            isCellUnavailable ? "line-through opacity-50" : ""
                                          }`}
                                        >
                                          Cost: {problem.costs[sourceIndex][destIndex]}
                                        </div>
                                      )}
                                    </td>
                                  )
                                })}
                                <td className="p-2 border text-center font-medium">
                                  {allocStep.remainingSupply?.[sourceIndex] ?? 0}
                                </td>
                              </tr>
                            ))}
                            <tr>
                              <th className="p-2 border">Demand</th>
                              {allocStep.remainingDemand?.map((d, index) => (
                                <td key={`step-demand-${index}`} className="p-2 border text-center font-medium">
                                  {d}
                                </td>
                              ))}
                              <td className="p-2 border"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )
                  })()
                )}

                {step.type === "penalty" && method === "vam" && (
                  <div className="mt-2">
                    <h5 className="font-medium mb-1">Penalties:</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h6 className="text-sm font-medium">Row Penalties:</h6>
                        <ul className="list-disc list-inside">
                          {step.rowPenalties?.map((penalty, idx) => (
                            <li key={`row-penalty-${idx}`}>
                              Row {idx + 1}: {penalty}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h6 className="text-sm font-medium">Column Penalties:</h6>
                        <ul className="list-disc list-inside">
                          {step.columnPenalties?.map((penalty, idx) => (
                            <li key={`col-penalty-${idx}`}>
                              Column {idx + 1}: {penalty}
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
      )}
    </div>
  )
}
