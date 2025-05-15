"use client"

import { useState, useEffect, useCallback } from "react"
import Counter from "./counter"
import { convertMixedTransshipment, createTransshipmentProblem, convertToTransportation } from "@/src/lib/transshipment"
import type { TransportationProblem, Method } from "@/src/lib/types"

interface InputFormProps {
  onSolve: (problem: TransportationProblem, method: Method, useUVOptimization: boolean) => void
  onReset?: () => void
  initialMethod?: Method
  initialUseUVOptimization?: boolean
  initialProblem?: TransportationProblem | null
}

export default function InputForm({
  onSolve,
  onReset,
  initialMethod = "nwcm",
  initialUseUVOptimization = false,
  initialProblem = null,
}: InputFormProps) {
  const [sources, setSources] = useState<number>(initialProblem?.supply.length || 3)
  const [destinations, setDestinations] = useState<number>(initialProblem?.demand.length || 3)
  const [supply, setSupply] = useState<(number | string)[]>(initialProblem?.supply || Array(3).fill(""))
  const [demand, setDemand] = useState<(number | string)[]>(initialProblem?.demand || Array(3).fill(""))
  const [costs, setCosts] = useState<(number | string)[][]>(
    initialProblem?.costs ||
      Array(3)
        .fill(0)
        .map(() => Array(3).fill("")),
  )
  const [method, setMethod] = useState<Method>(initialMethod)
  const [useUVOptimization, setUseUVOptimization] = useState<boolean>(initialUseUVOptimization)
  const [error, setError] = useState<string | null>(null)

  // Add transshipment state
  const [useTransshipment, setUseTransshipment] = useState<boolean>(false)
  const [transshipmentType, setTransshipmentType] = useState<"mixed" | "dedicated">("mixed")
  const [transshipmentCount, setTransshipmentCount] = useState<number>(1)
  const [transshipmentIndices, setTransshipmentIndices] = useState<number[]>([])

  // Update state when initialProblem changes
  useEffect(() => {
    if (initialProblem) {
      setSources(initialProblem.supply.length)
      setDestinations(initialProblem.demand.length)
      setSupply(initialProblem.supply)
      setDemand(initialProblem.demand)
      setCosts(initialProblem.costs)

      // Set transshipment state if the problem is a transshipment problem
      if (initialProblem.isTransshipment) {
        setUseTransshipment(true)
        // Determine if it's mixed or dedicated based on nodeTypes
        // This is a simplified approach - you might need more logic based on your data structure
        if (initialProblem.nodeTypes) {
          const hasTransshipmentNodes = initialProblem.nodeTypes.includes("transshipment")
          setTransshipmentType(hasTransshipmentNodes ? "dedicated" : "mixed")
        }
      }
    }
  }, [initialProblem])

  // Update method and UV optimization when initialMethod or initialUseUVOptimization changes
  useEffect(() => {
    setMethod(initialMethod)
  }, [initialMethod])

  useEffect(() => {
    setUseUVOptimization(initialUseUVOptimization)
  }, [initialUseUVOptimization])

  // Update the handleSourcesChange function to ensure type safety
  const handleSourcesChange = (value: number) => {
    const newValue = Math.max(2, Math.min(10, value))
    setSources(newValue)

    // Update supply array
    const newSupply = [...supply]
    if (newValue > supply.length) {
      for (let i = supply.length; i < newValue; i++) {
        newSupply.push("")
      }
    } else {
      newSupply.splice(newValue)
    }
    setSupply(newSupply)

    // Update costs matrix
    const newCosts: (number | string)[][] = costs.slice(0, newValue).map((row) => row.slice(0, destinations))
    while (newCosts.length < newValue) {
      newCosts.push(Array(destinations).fill(""))
    }
    setCosts(newCosts)

    // Update transshipment indices if using mixed transshipment
    if (useTransshipment && transshipmentType === "mixed") {
      setTransshipmentIndices((prev) => prev.filter((idx) => idx < newValue || idx >= newValue + destinations))
    }
  }

  // Update the handleDestinationsChange function to ensure type safety
  const handleDestinationsChange = (value: number) => {
    const newValue = Math.max(2, Math.min(10, value))
    setDestinations(newValue)

    // Update demand array
    const newDemand = [...demand]
    if (newValue > demand.length) {
      for (let i = demand.length; i < newValue; i++) {
        newDemand.push("")
      }
    } else {
      newDemand.splice(newValue)
    }
    setDemand(newDemand)

    // Update costs matrix
    const newCosts: (number | string)[][] = costs.map((row) => {
      const newRow = [...row]
      if (newValue > row.length) {
        for (let i = row.length; i < newValue; i++) {
          newRow.push("")
        }
      } else {
        newRow.splice(newValue)
      }
      return newRow
    })
    setCosts(newCosts)

    // Update transshipment indices if using mixed transshipment
    if (useTransshipment && transshipmentType === "mixed") {
      setTransshipmentIndices((prev) =>
        prev.filter((idx) => idx < sources || (idx >= sources && idx < sources + newValue)),
      )
    }
  }

  // Add handler for transshipment count change
  const handleTransshipmentCountChange = (value: number) => {
    const newValue = Math.max(1, Math.min(5, value))
    setTransshipmentCount(newValue)

    // If using dedicated transshipment, update the costs matrix
    if (useTransshipment && transshipmentType === "dedicated") {
      updateDedicatedTransshipmentCosts(sources, destinations, newValue)
    }
  }

  // Function to update costs matrix for dedicated transshipment
  const updateDedicatedTransshipmentCosts = (supplyCount: number, demandCount: number, transCount: number) => {
    // For dedicated transshipment, we need a cost matrix that includes:
    // 1. Costs from supply nodes to demand nodes (direct paths will not be used but matrix needs the space)
    // 2. Costs from supply nodes to transshipment nodes
    // 3. Costs from transshipment nodes to demand nodes
    // 4. Costs from transshipment nodes to transshipment nodes (optional paths)

    // Create a new costs matrix with the right dimensions
    const totalRows = supplyCount + transCount
    const totalCols = demandCount + transCount

    const newCosts: (number | string)[][] = Array(totalRows)
      .fill(0)
      .map(() => Array(totalCols).fill(""))

    // Preserve existing values where possible
    for (let i = 0; i < Math.min(costs.length, totalRows); i++) {
      for (let j = 0; j < Math.min(costs[i]?.length || 0, totalCols); j++) {
        // Copy the existing costs over to the new matrix
        // Note: We now have D columns first, then T columns, so we need to map accordingly
        if (i < supplyCount) {
          // Supply row
          if (j < demandCount) {
            // Supply to Demand costs
            newCosts[i][j] = costs[i]?.[j] ?? ""
          } else {
            // Supply to Transshipment costs
            newCosts[i][j] = costs[i]?.[j] ?? ""
          }
        } else {
          // Transshipment row
          if (j < demandCount) {
            // Transshipment to Demand costs
            newCosts[i][j] = costs[i]?.[j] ?? ""
          } else {
            // Transshipment to Transshipment costs
            newCosts[i][j] = costs[i]?.[j] ?? ""
          }
        }
      }
    }

    setCosts(newCosts)
  }

  const handleSupplyChange = (index: number, value: string) => {
    const newSupply = [...supply]
    newSupply[index] = value
    setSupply(newSupply)
  }

  const handleDemandChange = (index: number, value: string) => {
    const newDemand = [...demand]
    newDemand[index] = value
    setDemand(newDemand)
  }

  const handleCostChange = (sourceIndex: number, destIndex: number, value: string) => {
    const newCosts = [...costs]
    if (!newCosts[sourceIndex]) {
      newCosts[sourceIndex] = []
    }
    newCosts[sourceIndex][destIndex] = value
    setCosts(newCosts)
  }

  // Add handler for toggling transshipment nodes
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const toggleTransshipmentNode = (index: number) => {
    const newIndices = [...transshipmentIndices]
    const position = newIndices.indexOf(index)

    if (position === -1) {
      newIndices.push(index)
    } else {
      newIndices.splice(position, 1)
    }

    setTransshipmentIndices(newIndices)
  }

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const toggleAllTransshipmentNodes = () => {
    if (transshipmentIndices.length > 0) {
      // If any nodes are selected, deselect all
      setTransshipmentIndices([])
    } else {
      // Otherwise, select all nodes
      const allIndices: number[] = []
      for (let i = 0; i < sources; i++) {
        allIndices.push(i)
      }
      for (let i = 0; i < destinations; i++) {
        allIndices.push(sources + i)
      }
      setTransshipmentIndices(allIndices)
    }
  }

  // Add effect to automatically set all nodes as transient when using mixed transshipment
  useEffect(() => {
    if (useTransshipment && transshipmentType === "mixed") {
      const allIndices: number[] = []
      for (let i = 0; i < sources; i++) {
        allIndices.push(i)
      }
      for (let i = 0; i < destinations; i++) {
        allIndices.push(sources + i)
      }
      setTransshipmentIndices(allIndices)
    }
  }, [sources, destinations, useTransshipment, transshipmentType])

  const handleReset = () => {
    setSources(3)
    setDestinations(3)
    setSupply(Array(3).fill(""))
    setDemand(Array(3).fill(""))
    setCosts(
      Array(3)
        .fill(0)
        .map(() => Array(3).fill("")),
    )
    setUseUVOptimization(false)
    setError(null)

    // Reset transshipment state
    setUseTransshipment(false)
    setTransshipmentType("mixed")
    setTransshipmentCount(1)
    setTransshipmentIndices([])

    // Call onReset if provided
    if (onReset) {
      onReset()
    }

    // Clear URL parameters
    window.history.replaceState(null, "", window.location.pathname)
  }

  // Update the handleSolve function to handle transshipment problems
  const handleSolve = () => {
    try {
      // Declare the problem variable at the beginning
      let problem: TransportationProblem | undefined;
      
      // Check for empty fields
      if (supply.some((s) => s === "")) {
        setError("All supply values must be filled")
        return
      }

      if (demand.some((d) => d === "")) {
        setError("All demand values must be filled")
        return
      }

      // Check if costs are filled based on problem type
      if (!useTransshipment) {
        // Regular transportation problem
        if (costs.some((row) => row.some((cost) => cost === ""))) {
          setError("All cost cells must be filled")
          return
        }
      } else if (transshipmentType === "mixed") {
        // Mixed transshipment problem
        try {
          // For mixed transshipment, make sure all nodes are in transshipmentIndices
          const allIndices: number[] = []
          for (let i = 0; i < sources; i++) {
            allIndices.push(i)
          }
          for (let i = 0; i < destinations; i++) {
            allIndices.push(sources + i)
          }
          
          // Mixed transshipment
          const totalNodes = sources + destinations
          
          // Check that all costs except diagonals are filled
          for (let i = 0; i < totalNodes; i++) {
            for (let j = 0; j < totalNodes; j++) {
              // Skip diagonal elements (which are set to 0)
              if (i === j) continue
              
              // Check if this cell is empty
              if (!costs[i] || costs[i][j] === "") {
                setError("All cost cells must be filled")
                return
              }
            }
          }

          // Convert values to numbers for the solver
          const numericSupply = supply.map(s => typeof s === "string" ? parseFloat(s) : s);
          const numericDemand = demand.map(d => typeof d === "string" ? parseFloat(d) : d);
          const numericCosts = costs.map(row => 
            row.map(cell => typeof cell === "string" ? parseFloat(cell) : (cell as number))
          );
          
          // Use the library function to create the transshipment problem
          const transshipmentProblem = convertMixedTransshipment(
            numericSupply as number[],
            numericDemand as number[],
            numericCosts as number[][],
            allIndices
          );
          
          // Convert to transportation problem
          problem = convertToTransportation(transshipmentProblem);
        } catch (err) {
          console.error("Error in mixed transshipment conversion:", err);
          setError(`Error in transshipment conversion: ${err instanceof Error ? err.message : String(err)}`);
          return;
        }
      } else {
        // Dedicated transshipment problem
        // Conversion will happen later
      }

      // Convert all values to numbers
      const numericSupply: number[] = supply.map((s) => (typeof s === "string" ? Number(s) : s))
      const numericDemand: number[] = demand.map((d) => (typeof d === "string" ? Number(d) : d))
      const numericCosts: number[][] = costs.map((row) =>
        row.map((cost) => (typeof cost === "string" ? Number(cost) : cost)),
      )

      // Validate inputs
      if (numericSupply.some((s) => s <= 0)) {
        setError("Supply values must be positive")
        return
      }

      if (numericDemand.some((d) => d <= 0)) {
        setError("Demand values must be positive")
        return
      }

      if (numericCosts.some((row) => row.some((cost) => cost < 0))) {
        setError("Costs cannot be negative")
        return
      }

      // For transshipment problems, check if total supply equals total demand
      if (useTransshipment) {
        const totalSupply = numericSupply.reduce((sum, s) => sum + s, 0)
        const totalDemand = numericDemand.reduce((sum, d) => sum + d, 0)

        if (totalSupply !== totalDemand) {
          setError("Total supply must equal total demand for transshipment problems")
          return
        }
      }

      if (!useTransshipment) {
        // Regular transportation problem
        problem = {
          supply: numericSupply,
          demand: numericDemand,
          costs: numericCosts,
        }
      } else if (transshipmentType === "mixed") {
        // Skip this section as we already created the problem above
      } else {
        // Dedicated transshipment problem
        const transshipmentProblem = createTransshipmentProblem(
          numericSupply,
          numericDemand,
          transshipmentCount,
          numericCosts,
        )

        // Convert to transportation problem
        problem = convertToTransportation(transshipmentProblem)
      }

      // Pass the problem to onSolve only if it's defined
      if (problem) {
        onSolve(problem, method, useUVOptimization)
        setError(null)
      } else {
        setError("Error creating transportation problem")
      }
    } catch (err) {
      setError("Error solving the problem. Please check your inputs.")
      console.error(err)
    }
  }

  // Determine if we should show the transshipment UI
  const showTransshipmentUI = useTransshipment

  // Determine if we should show the mixed transshipment UI
  const showMixedTransshipmentUI = showTransshipmentUI && transshipmentType === "mixed"

  // Determine if we should show the dedicated transshipment UI
  const showDedicatedTransshipmentUI = showTransshipmentUI && transshipmentType === "dedicated"

  // Add a function to reset diagonal elements to zero for mixed transshipment
  const resetDiagonalToZero = useCallback(() => {
    if (useTransshipment && transshipmentType === "mixed") {
      const totalNodes = sources + destinations;
      const newCosts = [...costs];

      while (newCosts.length < totalNodes) {
        newCosts.push(Array(totalNodes).fill(""));
      }

      for (let i = 0; i < totalNodes; i++) {
        if (!newCosts[i]) {
          newCosts[i] = Array(totalNodes).fill("");
        }
        while (newCosts[i].length < totalNodes) {
          newCosts[i].push("");
        }
        newCosts[i][i] = 0;
      }

      setCosts(newCosts);
    }
  }, [useTransshipment, transshipmentType, sources, destinations, costs, setCosts]);

  // Update effect to reset diagonal elements when dimensions change
  useEffect(() => {
    resetDiagonalToZero();
  }, [resetDiagonalToZero]);

  // Add a helper function to generate links for mixed transshipment
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const generateLinks = (sources: number, destinations: number, costs: (number | string)[][]) => {
    const links = [];
    const totalNodes = sources + destinations;
    
    // Create links between all nodes based on cost matrix
    for (let i = 0; i < totalNodes; i++) {
      for (let j = 0; j < totalNodes; j++) {
        // Skip self-loops for non-transshipment indices
        if (i === j) continue;
        
        const cost = typeof costs[i]?.[j] === 'string' 
          ? parseFloat(costs[i][j] as string) 
          : (costs[i]?.[j] as number) || 0;
          
        if (!isNaN(cost) && cost < 999) {
          links.push({
            from: i,
            to: j,
            cost: cost,
            flow: 0
          });
        }
      }
    }
    
    // Add self-loops for transshipment nodes with zero cost
    for (let i = 0; i < totalNodes; i++) {
      links.push({
        from: i,
        to: i,
        cost: 0,
        flow: 0
      });
    }
    
    return links;
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <div className="flex border rounded-md overflow-hidden">
          <button
            onClick={() => setMethod("nwcm")}
            className={`flex-1 px-4 py-2 ${method === "nwcm" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          >
            NWCM
          </button>
          <button
            onClick={() => setMethod("lcm")}
            className={`flex-1 px-4 py-2 ${method === "lcm" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          >
            LCM
          </button>
          <button
            onClick={() => setMethod("vam")}
            className={`flex-1 px-4 py-2 ${method === "vam" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          >
            VAM
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {method === "nwcm" &&
            "North-West Corner Method starts from the top-left cell and allocates as much as possible."}
          {method === "lcm" && "Least Cost Method allocates to the cell with the lowest cost first."}
          {method === "vam" && "Vogel's Approximation Method uses penalty costs to make allocations."}
        </p>
      </div>

      {/* Add transshipment checkbox */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="use-transshipment"
          checked={useTransshipment}
          onChange={(e) => setUseTransshipment(e.target.checked)}
          className="h-4 w-4 text-blue-600 rounded border-gray-300"
          disabled
        />
        <label htmlFor="use-transshipment" className="ml-2 text-sm font-medium text-gray-500">
          Enable Transshipment
        </label>
      </div>

      {/* UV optimization checkbox - directly under transshipment with no extra margin */}
      <div className="flex items-center mt-1">
        <input
          type="checkbox"
          id="uv-optimization"
          checked={useUVOptimization}
          onChange={(e) => setUseUVOptimization(e.target.checked)}
          className="h-4 w-4 text-blue-600 rounded border-gray-300"
        />
        <label htmlFor="uv-optimization" className="ml-2 text-sm font-medium">
          UV Optimization (MODI Method)
        </label>
      </div>

      {/* Transshipment type selection */}
      {showTransshipmentUI && (
        <div className="border-b pb-4">
          <h3 className="text-sm font-medium mb-2">Transshipment Type</h3>
          <div className="flex border rounded-md overflow-hidden">
            <button
              onClick={() => setTransshipmentType("mixed")}
              className={`flex-1 px-4 py-2 ${transshipmentType === "mixed" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
            >
              Mixed Nodes
            </button>
            <button
              onClick={() => setTransshipmentType("dedicated")}
              className={`flex-1 px-4 py-2 ${
                transshipmentType === "dedicated" ? "bg-blue-600 text-white" : "bg-gray-100"
              }`}
            >
              Dedicated Nodes
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {transshipmentType === "mixed"
              ? "Supply or demand nodes can also serve as transshipment points."
              : "Dedicated transshipment nodes that are neither supply nor demand nodes."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Counter label="Number of Sources" value={sources} onChange={handleSourcesChange} min={2} max={10} />
        </div>
        <div>
          <Counter
            label="Number of Destinations"
            value={destinations}
            onChange={handleDestinationsChange}
            min={2}
            max={10}
          />
        </div>
        {/* Dedicated transshipment UI */}
        {showDedicatedTransshipmentUI && (
          <div className="col-span-2">
            <div className="flex items-center justify-between">
              <Counter
                label="Number of Transshipment Nodes"
                value={transshipmentCount}
                onChange={handleTransshipmentCountChange}
                min={1}
                max={5}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">Transportation Problem</h3>

        <div className="overflow-auto border rounded">
          {!showDedicatedTransshipmentUI ? (
            !useTransshipment || transshipmentType !== "mixed" ? (
              // Regular transportation problem
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-3 border"></th>
                    {Array.from({ length: destinations }).map((_, index) => (
                      <th key={`header-dest-${index}`} className="p-3 border">
                        D{index + 1}
                        {showMixedTransshipmentUI && transshipmentIndices.includes(sources + index) && (
                          <span className="text-xs text-blue-600"> (T)</span>
                        )}
                      </th>
                    ))}
                    <th className="p-3 border bg-blue-50">Supply</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: sources }).map((_, sourceIndex) => (
                    <tr key={`row-${sourceIndex}`}>
                      <th className="p-3 border">
                        S{sourceIndex + 1}
                        {showMixedTransshipmentUI && transshipmentIndices.includes(sourceIndex) && (
                          <span className="text-xs text-blue-600"> (T)</span>
                        )}
                      </th>
                      {Array.from({ length: destinations }).map((_, destIndex) => (
                        <td key={`cell-${sourceIndex}-${destIndex}`} className="p-2 border">
                          <input
                            type="number"
                            min={0}
                            value={costs[sourceIndex]?.[destIndex] ?? ""}
                            onChange={(e) => handleCostChange(sourceIndex, destIndex, e.target.value)}
                            className="w-24 h-8 text-center border rounded-md"
                            placeholder="Cost"
                          />
                        </td>
                      ))}
                      <td className="p-2 border bg-blue-50">
                        <input
                          type="number"
                          min={1}
                          value={supply[sourceIndex] ?? ""}
                          onChange={(e) => handleSupplyChange(sourceIndex, e.target.value)}
                          className="w-24 h-8 text-center border rounded-md bg-blue-50"
                          placeholder="Supply"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th className="p-3 border bg-blue-50">Demand</th>
                    {Array.from({ length: destinations }).map((_, index) => (
                      <td key={`demand-${index}`} className="p-2 border bg-blue-50">
                        <input
                          type="number"
                          min={1}
                          value={demand[index] ?? ""}
                          onChange={(e) => handleDemandChange(index, e.target.value)}
                          className="w-24 h-8 text-center border rounded-md bg-blue-50"
                          placeholder="Demand"
                        />
                      </td>
                    ))}
                    <td className="p-2 border"></td>
                  </tr>
                </tbody>
              </table>
            ) : (
              // Mixed transshipment problem - Full matrix layout
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-3 border"></th>
                    {/* Source columns */}
                    {Array.from({ length: sources }).map((_, index) => (
                      <th key={`header-source-${index}`} className="p-3 border">
                        S{index + 1}
                        {transshipmentIndices.includes(index) && (
                          <span className="text-xs text-blue-600"> (T)</span>
                        )}
                      </th>
                    ))}
                    {/* Destination columns */}
                    {Array.from({ length: destinations }).map((_, index) => (
                      <th key={`header-dest-${index}`} className="p-3 border">
                        D{index + 1}
                        {transshipmentIndices.includes(sources + index) && (
                          <span className="text-xs text-blue-600"> (T)</span>
                        )}
                      </th>
                    ))}
                    <th className="p-3 border bg-blue-50">Capacity</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Source rows */}
                  {Array.from({ length: sources }).map((_, sourceIndex) => (
                    <tr key={`row-source-${sourceIndex}`}>
                      <th className="p-3 border">
                        S{sourceIndex + 1}
                        {transshipmentIndices.includes(sourceIndex) && (
                          <span className="text-xs text-blue-600"> (T)</span>
                        )}
                      </th>
                      {/* Source to Source costs */}
                      {Array.from({ length: sources }).map((_, toSourceIndex) => (
                        <td key={`cell-s-s-${sourceIndex}-${toSourceIndex}`} className="p-2 border">
                          {sourceIndex === toSourceIndex ? (
                            // Diagonal cells - fixed at 0
                            <input
                              type="number"
                              value="0"
                              readOnly
                              disabled
                              className="w-24 h-8 text-center border rounded-md bg-gray-100"
                            />
                          ) : (
                            <input
                              type="number"
                              min={0}
                              value={costs[sourceIndex]?.[toSourceIndex] ?? ""}
                              onChange={(e) => handleCostChange(sourceIndex, toSourceIndex, e.target.value)}
                              className="w-24 h-8 text-center border rounded-md"
                              placeholder="Cost"
                            />
                          )}
                        </td>
                      ))}
                      {/* Source to Destination costs */}
                      {Array.from({ length: destinations }).map((_, destIndex) => (
                        <td key={`cell-s-d-${sourceIndex}-${destIndex}`} className="p-2 border">
                          <input
                            type="number"
                            min={0}
                            value={costs[sourceIndex]?.[sources + destIndex] ?? ""}
                            onChange={(e) => handleCostChange(sourceIndex, sources + destIndex, e.target.value)}
                            className="w-24 h-8 text-center border rounded-md"
                            placeholder="Cost"
                          />
                        </td>
                      ))}
                      {/* Source capacity in the last column */}
                      <td className="p-2 border bg-blue-50">
                        <input
                          type="number"
                          min={1}
                          value={supply[sourceIndex] ?? ""}
                          onChange={(e) => handleSupplyChange(sourceIndex, e.target.value)}
                          className="w-24 h-8 text-center border rounded-md bg-blue-50"
                          placeholder="Supply"
                        />
                      </td>
                    </tr>
                  ))}
                  {/* Destination rows */}
                  {Array.from({ length: destinations }).map((_, destIndex) => (
                    <tr key={`row-dest-${destIndex}`}>
                      <th className="p-3 border">
                        D{destIndex + 1}
                        {transshipmentIndices.includes(sources + destIndex) && (
                          <span className="text-xs text-blue-600"> (T)</span>
                        )}
                      </th>
                      {/* Destination to Source costs */}
                      {Array.from({ length: sources }).map((_, sourceIndex) => (
                        <td key={`cell-d-s-${destIndex}-${sourceIndex}`} className="p-2 border">
                          <input
                            type="number"
                            min={0}
                            value={costs[sources + destIndex]?.[sourceIndex] ?? ""}
                            onChange={(e) => handleCostChange(sources + destIndex, sourceIndex, e.target.value)}
                            className="w-24 h-8 text-center border rounded-md"
                            placeholder="Cost"
                          />
                        </td>
                      ))}
                      {/* Destination to Destination costs */}
                      {Array.from({ length: destinations }).map((_, toDestIndex) => (
                        <td key={`cell-d-d-${destIndex}-${toDestIndex}`} className="p-2 border">
                          {destIndex === toDestIndex ? (
                            // Diagonal cells - fixed at 0
                            <input
                              type="number"
                              value="0"
                              readOnly
                              disabled
                              className="w-24 h-8 text-center border rounded-md bg-gray-100"
                            />
                          ) : (
                            <input
                              type="number"
                              min={0}
                              value={costs[sources + destIndex]?.[sources + toDestIndex] ?? ""}
                              onChange={(e) => handleCostChange(sources + destIndex, sources + toDestIndex, e.target.value)}
                              className="w-24 h-8 text-center border rounded-md"
                              placeholder="Cost"
                            />
                          )}
                        </td>
                      ))}
                      {/* Empty cell in last column for destinations */}
                      <td className="p-2 border bg-blue-50">
                        <div className="w-24 h-8 bg-gray-50 rounded-md"></div>
                      </td>
                    </tr>
                  ))}
                  {/* Bottom row for demand values */}
                  <tr>
                    <th className="p-3 border bg-blue-50">Capacity</th>
                    {/* Empty cells under Source columns */}
                    {Array.from({ length: sources }).map((_, index) => (
                      <td key={`cap-source-${index}`} className="p-2 border bg-blue-50">
                        <div className="w-24 h-8 bg-gray-50 rounded-md"></div>
                      </td>
                    ))}
                    {/* Demand input cells under Destination columns */}
                    {Array.from({ length: destinations }).map((_, index) => (
                      <td key={`cap-dest-${index}`} className="p-2 border bg-blue-50">
                        <input
                          type="number"
                          min={1}
                          value={demand[index] ?? ""}
                          onChange={(e) => handleDemandChange(index, e.target.value)}
                          className="w-24 h-8 text-center border rounded-md bg-blue-50"
                          placeholder="Demand"
                        />
                      </td>
                    ))}
                    {/* Empty cell in the bottom-right corner */}
                    <td className="p-2 border"></td>
                  </tr>
                </tbody>
              </table>
            )
          ) : (
            // Dedicated transshipment as a matrix
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-3 border"></th>
                  {/* Demand nodes in column headers (now first) */}
                  {Array.from({ length: destinations }).map((_, index) => (
                    <th key={`header-dest-${index}`} className="p-3 border">
                      D{index + 1}
                    </th>
                  ))}
                  {/* Transshipment nodes in column headers (now after demand) */}
                  {Array.from({ length: transshipmentCount }).map((_, index) => (
                    <th key={`header-trans-${index}`} className="p-3 border">
                      T{index + 1}
                    </th>
                  ))}
                  <th className="p-3 border bg-blue-50">Supply</th>
                </tr>
              </thead>
              <tbody>
                {/* Supply rows */}
                {Array.from({ length: sources }).map((_, sourceIndex) => (
                  <tr key={`row-${sourceIndex}`}>
                    <th className="p-3 border">S{sourceIndex + 1}</th>
                    {/* Supply to Demand costs */}
                    {Array.from({ length: destinations }).map((_, destIndex) => (
                      <td key={`cell-s-d-${sourceIndex}-${destIndex}`} className="p-2 border">
                        <input
                          type="number"
                          min={0}
                          value={costs[sourceIndex]?.[destIndex] ?? ""}
                          onChange={(e) => handleCostChange(sourceIndex, destIndex, e.target.value)}
                          className="w-24 h-8 text-center border rounded-md"
                          placeholder="Cost"
                        />
                      </td>
                    ))}
                    {/* Supply to Transshipment costs */}
                    {Array.from({ length: transshipmentCount }).map((_, transIndex) => (
                      <td key={`cell-s-t-${sourceIndex}-${transIndex}`} className="p-2 border">
                        <input
                          type="number"
                          min={0}
                          value={costs[sourceIndex]?.[destinations + transIndex] ?? ""}
                          onChange={(e) => handleCostChange(sourceIndex, destinations + transIndex, e.target.value)}
                          className="w-24 h-8 text-center border rounded-md"
                          placeholder="Cost"
                        />
                      </td>
                    ))}
                    <td className="p-2 border bg-blue-50">
                      <input
                        type="number"
                        min={1}
                        value={supply[sourceIndex] ?? ""}
                        onChange={(e) => handleSupplyChange(sourceIndex, e.target.value)}
                        className="w-24 h-8 text-center border rounded-md bg-blue-50"
                        placeholder="Supply"
                      />
                    </td>
                  </tr>
                ))}
                {/* Transshipment rows */}
                {Array.from({ length: transshipmentCount }).map((_, transIndex) => (
                  <tr key={`row-trans-${transIndex}`}>
                    <th className="p-3 border">T{transIndex + 1}</th>
                    {/* Transshipment to Demand costs */}
                    {Array.from({ length: destinations }).map((_, destIndex) => (
                      <td key={`cell-t-d-${transIndex}-${destIndex}`} className="p-2 border">
                        <input
                          type="number"
                          min={0}
                          value={costs[sources + transIndex]?.[destIndex] ?? ""}
                          onChange={(e) =>
                            handleCostChange(sources + transIndex, destIndex, e.target.value)
                          }
                          className="w-24 h-8 text-center border rounded-md"
                          placeholder="Cost"
                        />
                      </td>
                    ))}
                    {/* Transshipment to Transshipment costs */}
                    {Array.from({ length: transshipmentCount }).map((_, toTransIndex) => (
                      <td key={`cell-t-t-${transIndex}-${toTransIndex}`} className="p-2 border">
                        <input
                          type="number"
                          min={0}
                          value={costs[sources + transIndex]?.[destinations + toTransIndex] ?? ""}
                          onChange={(e) =>
                            handleCostChange(sources + transIndex, destinations + toTransIndex, e.target.value)
                          }
                          className="w-24 h-8 text-center border rounded-md"
                          placeholder="Cost"
                        />
                      </td>
                    ))}
                    <td className="p-2 border bg-blue-50">
                      <input
                        type="number"
                        min={0}
                        value="0"
                        readOnly
                        className="w-24 h-8 text-center border rounded-md bg-blue-50"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
                {/* Demand row */}
                <tr>
                  <th className="p-3 border bg-blue-50">Demand</th>
                  {/* Actual demand */}
                  {Array.from({ length: destinations }).map((_, index) => (
                    <td key={`demand-${index}`} className="p-2 border bg-blue-50">
                      <input
                        type="number"
                        min={1}
                        value={demand[index] ?? ""}
                        onChange={(e) => handleDemandChange(index, e.target.value)}
                        className="w-24 h-8 text-center border rounded-md bg-blue-50"
                        placeholder="Demand"
                      />
                    </td>
                  ))}
                  {/* Transshipment demand (should be zero) */}
                  {Array.from({ length: transshipmentCount }).map((_, index) => (
                    <td key={`trans-demand-${index}`} className="p-2 border bg-blue-50">
                      <input
                        type="number"
                        min={0}
                        value="0"
                        readOnly
                        className="w-24 h-8 text-center border rounded-md bg-blue-50"
                        placeholder="0"
                      />
                    </td>
                  ))}
                  <td className="p-2 border"></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      <div className="flex gap-2">
        <button onClick={handleSolve} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md">
          Solve
        </button>
        <button onClick={handleReset} className="w-20 px-4 py-2 border hover:bg-gray-100 rounded-md text-sm">
          Reset
        </button>
      </div>
    </div>
  )
}