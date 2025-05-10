"use client"

import { useState } from "react"
import Counter from "./counter"
import type { TransportationProblem, Method } from "@/src/lib/types"
import { isBalanced, balanceProblem } from "@/src/lib/utils"

interface InputFormProps {
  onSolve: (problem: TransportationProblem, method: Method) => void
  onReset: () => void
}

export default function InputForm({ onSolve, onReset }: InputFormProps) {
  const [sources, setSources] = useState<number>(3)
  const [destinations, setDestinations] = useState<number>(3)
  const [supply, setSupply] = useState<(number | string)[]>(Array(3).fill(""))
  const [demand, setDemand] = useState<(number | string)[]>(Array(3).fill(""))
  const [costs, setCosts] = useState<(number | string)[][]>(
    Array(3)
      .fill(0)
      .map(() => Array(3).fill("")),
  )
  const [method, setMethod] = useState<Method>("nwcm")
  const [error, setError] = useState<string | null>(null)

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
    const newCosts = costs.slice(0, newValue).map((row) => row.slice(0, destinations))
    while (newCosts.length < newValue) {
      newCosts.push(Array(destinations).fill(""))
    }
    setCosts(newCosts)
  }

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
    const newCosts = costs.map((row) => {
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
    setError(null)
    onReset()
  }

  const handleSolve = () => {
    try {
      // Check for empty fields
      if (supply.some((s) => s === "")) {
        setError("All supply values must be filled")
        return
      }

      if (demand.some((d) => d === "")) {
        setError("All demand values must be filled")
        return
      }

      if (costs.some((row) => row.some((cost) => cost === ""))) {
        setError("All cost cells must be filled")
        return
      }

      // Convert all values to numbers
      const numericSupply = supply.map((s) => (typeof s === "string" ? Number(s) : s))
      const numericDemand = demand.map((d) => (typeof d === "string" ? Number(d) : d))
      const numericCosts = costs.map((row) => row.map((cost) => (typeof cost === "string" ? Number(cost) : cost)))

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

      const problem: TransportationProblem = {
        supply: numericSupply as number[],
        demand: numericDemand as number[],
        costs: numericCosts as number[][],
      }

      // Check if the problem is balanced
      if (!isBalanced(problem)) {
        // Balance the problem
        const balancedProblem = balanceProblem(problem)
        onSolve(balancedProblem, method)
      } else {
        onSolve(problem, method)
      }

      setError(null)
    } catch (err) {
      setError("Error solving the problem. Please check your inputs.")
      console.error(err)
    }
  }

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
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">Supply</h3>
        <div className="grid grid-cols-5 gap-2">
          {supply.map((value, index) => (
            <div key={`supply-${index}`}>
              <label htmlFor={`supply-${index}`} className="block text-sm font-medium mb-1">
                S{index + 1}
              </label>
              <input
                id={`supply-${index}`}
                type="number"
                min={1}
                value={value}
                onChange={(e) => handleSupplyChange(index, e.target.value)}
                className="w-full px-2 py-1 border rounded-md"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">Demand</h3>
        <div className="grid grid-cols-5 gap-2">
          {demand.map((value, index) => (
            <div key={`demand-${index}`}>
              <label htmlFor={`demand-${index}`} className="block text-sm font-medium mb-1">
                D{index + 1}
              </label>
              <input
                id={`demand-${index}`}
                type="number"
                min={1}
                value={value}
                onChange={(e) => handleDemandChange(index, e.target.value)}
                className="w-full px-2 py-1 border rounded-md"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">Cost Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 border text-center"></th>
                {Array.from({ length: destinations }).map((_, index) => (
                  <th key={`header-dest-${index}`} className="p-2 border text-center">
                    D{index + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: sources }).map((_, sourceIndex) => (
                <tr key={`row-${sourceIndex}`}>
                  <th className="p-2 border text-center">S{sourceIndex + 1}</th>
                  {Array.from({ length: destinations }).map((_, destIndex) => (
                    <td key={`cell-${sourceIndex}-${destIndex}`} className="p-1 border text-center">
                      <input
                        type="number"
                        min={0}
                        value={costs[sourceIndex]?.[destIndex] ?? ""}
                        onChange={(e) => handleCostChange(sourceIndex, destIndex, e.target.value)}
                        className="h-8  border rounded-md"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
