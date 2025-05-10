"use client"

import { useState } from "react"
import InputForm from "./input-form"
import SolutionDisplay from "./solution-display"
import { solveNWCM } from "@/src/lib/methods/nwcm"
import { solveLCM } from "@/src/lib/methods/lcm"
import { solveVAM } from "@/src/lib/methods/vam"
import type { TransportationProblem, Solution, Method } from "@/src/lib/types"

export default function TransportationSolver() {
  const [problem, setProblem] = useState<TransportationProblem | null>(null)
  const [solution, setSolution] = useState<Solution | null>(null)
  const [method, setMethod] = useState<Method>("nwcm")
  const [viewMode, setViewMode] = useState<"solution" | "steps">("solution")

  const handleSolve = (problem: TransportationProblem, method: Method) => {
    setProblem(problem)
    setMethod(method)

    let solution: Solution | null = null

    switch (method) {
      case "nwcm":
        solution = solveNWCM(problem)
        break
      case "lcm":
        solution = solveLCM(problem)
        break
      case "vam":
        solution = solveVAM(problem)
        break
    }

    setSolution(solution)
  }

  // Reset both input and solution sections
  const handleReset = () => {
    setProblem(null)
    setSolution(null)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <div className="bg-white rounded-lg shadow p-4 border">
        <h2 className="text-xl font-semibold mb-4">Input Data</h2>
        <InputForm onSolve={handleSolve} onReset={handleReset} />
      </div>

      <div className="bg-white rounded-lg shadow p-4 border">
        <h2 className="text-xl font-semibold mb-4">Solution</h2>

        {solution ? (
          <div>
            <div className="mb-4">
              <div className="flex border rounded-md overflow-hidden">
                <button
                  onClick={() => setViewMode("solution")}
                  className={`flex-1 px-4 py-2 ${viewMode === "solution" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
                >
                  Final Solution
                </button>
                <button
                  onClick={() => setViewMode("steps")}
                  className={`flex-1 px-4 py-2 ${viewMode === "steps" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
                >
                  Step by Step
                </button>
              </div>
            </div>

            <SolutionDisplay solution={solution} problem={problem!} method={method} viewMode={viewMode} />
          </div>
        ) : (
          <div className="text-center p-8 text-gray-500">Enter problem data and click solve to see the solution</div>
        )}
      </div>
    </div>
  )
}
