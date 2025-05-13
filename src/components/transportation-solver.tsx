"use client"

import { useState, useEffect, useCallback } from "react"
import { Share2 } from "lucide-react"
import InputForm from "./input-form"
import SolutionDisplay from "./solution-display"
import { solveNWCM } from "@/src/lib/methods/nwcm"
import { solveLCM } from "@/src/lib/methods/lcm"
import { solveVAM } from "@/src/lib/methods/vam"
import { optimizeWithMODI } from "@/src/lib/methods/modi"
import { isBalanced, balanceProblem } from "@/src/lib/utils"
import type { TransportationProblem, Solution, Method, OptimizationResult } from "@/src/lib/types"

export default function TransportationSolver() {
  const [originalProblem, setOriginalProblem] = useState<TransportationProblem | null>(null)
  const [problem, setProblem] = useState<TransportationProblem | null>(null)
  const [solution, setSolution] = useState<Solution | OptimizationResult | null>(null)
  const [method, setMethod] = useState<Method>("nwcm")
  const [viewMode, setViewMode] = useState<"solution" | "steps">("solution")
  const [useUVOptimization, setUseUVOptimization] = useState<boolean>(false)
  const [autoSolve, setAutoSolve] = useState<boolean>(false)
  const [shareNotification, setShareNotification] = useState<boolean>(false)
  const [isBalancedProblem, setIsBalancedProblem] = useState<boolean>(true)

  // Define handleSolve with useCallback to prevent it from changing on every render
  const handleSolve = useCallback((originalProblem: TransportationProblem, method: Method, useUVOptimization: boolean) => {
    setOriginalProblem(originalProblem)
    setMethod(method)
    setUseUVOptimization(useUVOptimization)

    // Check if the problem is balanced
    const balanced = isBalanced(originalProblem)
    setIsBalancedProblem(balanced)

    // Balance the problem if needed, but only for solving
    const problemToSolve = balanced ? originalProblem : balanceProblem(originalProblem)
    setProblem(problemToSolve)

    // Use the selected method
    let initialSolution: Solution | null = null

    switch (method) {
      case "nwcm":
        initialSolution = solveNWCM(problemToSolve)
        break
      case "lcm":
        initialSolution = solveLCM(problemToSolve)
        break
      case "vam":
        initialSolution = solveVAM(problemToSolve)
        break
    }

    if (useUVOptimization && initialSolution) {
      const optimizedSolution = optimizeWithMODI(problemToSolve, initialSolution)
      setSolution({
        initialSolution,
        optimizedSolution,
      })
    } else {
      setSolution(initialSolution)
    }

    // Update URL with query parameters - use the original problem for the URL
    updateQueryParams(originalProblem, method, useUVOptimization)
  }, []);

  // Automatically solve the problem when loaded from URL
  useEffect(() => {
    if (autoSolve && originalProblem && method) {
      handleSolve(originalProblem, method, useUVOptimization)
      setAutoSolve(false)
    }
  }, [autoSolve, originalProblem, method, useUVOptimization, handleSolve])

  // Add a handleReset function to reset the solution
  const handleReset = () => {
    setSolution(null)
    setProblem(null)
    setOriginalProblem(null)
  }

  // Load state from query params on mount
  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    let isValid = true

    // 1. Method type
    const methodParam = params.get("method")
    if (methodParam === "nwcm" || methodParam === "lcm" || methodParam === "vam") {
      setMethod(methodParam)
    } else if (params.has("method")) {
      isValid = false
    }

    // 2. UV Optimization
    const uvParam = params.get("uv")
    if (uvParam === "true" || uvParam === "false") {
      setUseUVOptimization(uvParam === "true")
    } else if (params.has("uv")) {
      isValid = false
    }

    // 3. Number of sources and destinations
    const sourcesParam = params.get("sources")
    const destsParam = params.get("dests")

    let sources = 3
    let destinations = 3

    if (sourcesParam) {
      const parsedSources = Number.parseInt(sourcesParam, 10)
      if (!isNaN(parsedSources) && parsedSources >= 2 && parsedSources <= 10) {
        sources = parsedSources
      } else {
        isValid = false
      }
    }

    if (destsParam) {
      const parsedDests = Number.parseInt(destsParam, 10)
      if (!isNaN(parsedDests) && parsedDests >= 2 && parsedDests <= 10) {
        destinations = parsedDests
      } else {
        isValid = false
      }
    }

    // 4. Supply values
    const supplyParam = params.get("supply")
    let supply: number[] = []

    if (supplyParam) {
      const supplyValues = supplyParam.split(",").map((v) => Number.parseFloat(v))
      if (supplyValues.length === sources && supplyValues.every((v) => !isNaN(v) && v > 0)) {
        supply = supplyValues
      } else {
        isValid = false
      }
    }

    // 5. Demand values
    const demandParam = params.get("demand")
    let demand: number[] = []

    if (demandParam) {
      const demandValues = demandParam.split(",").map((v) => Number.parseFloat(v))
      if (demandValues.length === destinations && demandValues.every((v) => !isNaN(v) && v > 0)) {
        demand = demandValues
      } else {
        isValid = false
      }
    }

    // 6. Cost matrix
    const costsParam = params.get("costs")
    let costs: number[][] = []

    if (costsParam) {
      const costValues = costsParam.split(";").map((row) => row.split(",").map((v) => Number.parseFloat(v)))
      if (
        costValues.length === sources &&
        costValues.every((row) => row.length === destinations && row.every((v) => !isNaN(v) && v >= 0))
      ) {
        costs = costValues
      } else {
        isValid = false
      }
    }

    // If all parameters are valid and we have all required data, create the problem and auto-solve
    if (isValid && supply.length > 0 && demand.length > 0 && costs.length > 0) {
      const loadedProblem: TransportationProblem = {
        supply,
        demand,
        costs,
      }

      setOriginalProblem(loadedProblem)
      setAutoSolve(true)
    } else if (!isValid) {
      // If any parameter is invalid, clear the query string
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])

  const updateQueryParams = (problem: TransportationProblem, method: Method, useUVOptimization: boolean) => {
    const params = new URLSearchParams()

    // Method
    params.set("method", method)

    // UV Optimization
    params.set("uv", useUVOptimization.toString())

    // Sources and destinations
    params.set("sources", problem.supply.length.toString())
    params.set("dests", problem.demand.length.toString())

    // Supply values
    params.set("supply", problem.supply.join(","))

    // Demand values
    params.set("demand", problem.demand.join(","))

    // Cost matrix
    params.set("costs", problem.costs.map((row) => row.join(",")).join(";"))

    // Update URL
    const newUrl = window.location.pathname + "?" + params.toString()
    window.history.replaceState(null, "", newUrl)
  }

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          setShareNotification(true)
          setTimeout(() => setShareNotification(false), 2000)
        })
        .catch((err) => {
          console.error("Failed to copy URL: ", err)
        })
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <div className="bg-white rounded-lg shadow p-4 border relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Input Data</h2>
          <button
            onClick={handleShare}
            className="text-gray-500 hover:text-blue-600 flex items-center gap-1"
            title="Share this problem"
          >
            <Share2 className="h-4 w-4" />
            <span className="text-sm">Share</span>
          </button>
        </div>

        {shareNotification && (
          <div className="absolute top-0 right-0 mt-4 mr-20 bg-green-100 text-green-800 px-3 py-1 rounded-md text-sm z-10">
            URL copied!
          </div>
        )}

        <InputForm
          onSolve={handleSolve}
          onReset={handleReset}
          initialMethod={method}
          initialUseUVOptimization={useUVOptimization}
          initialProblem={originalProblem}
        />
      </div>

      <div className="bg-white rounded-lg shadow p-4 border">
        <h2 className="text-xl font-semibold mb-4">Solution</h2>

        {solution && problem ? (
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

            {!isBalancedProblem && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> The problem is unbalanced. A dummy{" "}
                  {originalProblem!.supply.reduce((a, b) => a + b, 0) <
                  originalProblem!.demand.reduce((a, b) => a + b, 0)
                    ? "source"
                    : "destination"}{" "}
                  has been added for solving.
                </p>
              </div>
            )}

            {problem.isTransshipment && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This is a transshipment problem that has been converted to a transportation
                  problem for solving.
                </p>
              </div>
            )}

            <SolutionDisplay
              solution={solution}
              problem={problem}
              originalProblem={originalProblem!}
              method={method}
              viewMode={viewMode}
              useUVOptimization={useUVOptimization}
              isBalanced={isBalancedProblem}
            />
          </div>
        ) : (
          <div className="text-center p-8 text-gray-500">Enter problem data and click solve to see the solution</div>
        )}
      </div>
    </div>
  )
}
