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
  const handleSolve = useCallback(
    (
      problemToSolve: TransportationProblem,
      method: Method,
      useUVOptimization: boolean,
      originalProblemForDisplay?: TransportationProblem,
    ) => {
      setOriginalProblem(originalProblemForDisplay || problemToSolve)
      setMethod(method)
      setUseUVOptimization(useUVOptimization)

      // Check if the problem is balanced
      const balanced = isBalanced(problemToSolve)
      setIsBalancedProblem(balanced)

      // Balance the problem if needed, but only for solving
      const problemForSolver = balanced ? problemToSolve : balanceProblem(problemToSolve)
      setProblem(problemForSolver)

      // Use the selected method
      let initialSolution: Solution | null = null

      switch (method) {
        case "nwcm":
          initialSolution = solveNWCM(problemForSolver)
          break
        case "lcm":
          initialSolution = solveLCM(problemForSolver)
          break
        case "vam":
          initialSolution = solveVAM(problemForSolver)
          break
      }

      if (useUVOptimization && initialSolution) {
        const optimizedSolution = optimizeWithMODI(problemForSolver, initialSolution)
        setSolution({
          initialSolution,
          optimizedSolution,
        })
      } else {
        setSolution(initialSolution)
      }

      // Update URL with query parameters - use the problem that was actually solved, not the original
      updateQueryParams(problemToSolve, method, useUVOptimization)
    },
    [],
  )

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

    // 3. Transshipment parameters
    const transshipmentParam = params.get("transshipment")
    const transshipmentTypeParam = params.get("transshipmentType")
    const sourcesCountParam = params.get("sourcesCount")
    const destinationsCountParam = params.get("destinationsCount")

    let isTransshipment = false
    let transshipmentType: "mixed" | "dedicated" | undefined = undefined
    let originalSourcesCount: number | undefined = undefined
    let originalDestinationsCount: number | undefined = undefined

    if (transshipmentParam === "true") {
      isTransshipment = true
      if (transshipmentTypeParam === "mixed" || transshipmentTypeParam === "dedicated") {
        transshipmentType = transshipmentTypeParam
      }
      if (sourcesCountParam) {
        const parsedSourcesCount = Number.parseInt(sourcesCountParam, 10)
        if (!isNaN(parsedSourcesCount) && parsedSourcesCount >= 2) {
          originalSourcesCount = parsedSourcesCount
        }
      }
      if (destinationsCountParam) {
        const parsedDestinationsCount = Number.parseInt(destinationsCountParam, 10)
        if (!isNaN(parsedDestinationsCount) && parsedDestinationsCount >= 2) {
          originalDestinationsCount = parsedDestinationsCount
        }
      }
    }

    // 4. Number of sources and destinations
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

    // For mixed transshipment, determine actual array sizes
    // If we have sourcesCount/destinationsCount params, those are the original dimensions
    // and sources/dests params represent the original dimensions, but arrays are extended
    let actualArraySources = sources
    let actualArrayDestinations = destinations
    
    if (isTransshipment && transshipmentType === "mixed" && originalSourcesCount && originalDestinationsCount) {
      // For mixed transshipment with metadata, the arrays are extended to square matrix
      actualArraySources = originalSourcesCount + originalDestinationsCount
      actualArrayDestinations = originalSourcesCount + originalDestinationsCount
    } else if (isTransshipment && transshipmentType === "mixed") {
      // For mixed transshipment without metadata, arrays are still extended
      actualArraySources = sources + destinations
      actualArrayDestinations = sources + destinations
    }

    // 5. Supply values
    const supplyParam = params.get("supply")
    let supply: number[] = []

    if (supplyParam) {
      const supplyValues = supplyParam.split(",").map((v) => Number.parseFloat(v))
      
      if (supplyValues.length === actualArraySources && supplyValues.every((v) => !isNaN(v) && v >= 0)) {
        supply = supplyValues
      } else {
        isValid = false
      }
    }

    // 6. Demand values
    const demandParam = params.get("demand")
    let demand: number[] = []

    if (demandParam) {
      const demandValues = demandParam.split(",").map((v) => Number.parseFloat(v))
      
      if (demandValues.length === actualArrayDestinations && demandValues.every((v) => !isNaN(v) && v >= 0)) {
        demand = demandValues
      } else {
        isValid = false
      }
    }

    // 7. Cost matrix
    const costsParam = params.get("costs")
    let costs: number[][] = []

    if (costsParam) {
      const costValues = costsParam.split(";").map((row) => row.split(",").map((v) => Number.parseFloat(v)))
      
      if (
        costValues.length === actualArraySources &&
        costValues.every((row) => row.length === actualArrayDestinations && row.every((v) => !isNaN(v) && v >= 0))
      ) {
        costs = costValues
      } else {
        isValid = false
      }
    }

    // If all parameters are valid and we have all required data, create the problem and auto-solve
    if (isValid && supply.length > 0 && demand.length > 0 && costs.length > 0) {
      let originalSupplyForDisplay: number[] = supply
      let originalDemandForDisplay: number[] = demand
      let bufferAmount: number | undefined = undefined

      // For mixed transshipment, extract the original supply and demand from the extended arrays
      if (isTransshipment && transshipmentType === "mixed" && originalSourcesCount && originalDestinationsCount) {
        // Calculate buffer amount from the extended arrays
        // For mixed transshipment with buffer: all values in first N positions should be equal (original + buffer)
        // and all values in source positions of demand array should be 0 + buffer = buffer
        const sourceSupplyValues = supply.slice(0, originalSourcesCount)
        const sourceDemandValues = demand.slice(0, originalSourcesCount)
        
        // If source demand values are non-zero, we have a buffer
        if (sourceDemandValues.some(d => d > 0)) {
          bufferAmount = sourceDemandValues[0] // All should be the same buffer value
          // Original supply is first N elements minus buffer
          originalSupplyForDisplay = sourceSupplyValues.map(s => s - bufferAmount!)
          // Original demand is last M elements minus buffer  
          originalDemandForDisplay = demand.slice(-originalDestinationsCount).map(d => d - bufferAmount!)
        } else {
          // No buffer, just slice the arrays
          originalSupplyForDisplay = supply.slice(0, originalSourcesCount)
          originalDemandForDisplay = demand.slice(-originalDestinationsCount)
        }
      }

      const loadedProblem: TransportationProblem = {
        supply: originalSupplyForDisplay, // Use original dimensions for input form
        demand: originalDemandForDisplay, // Use original dimensions for input form
        costs,
        isTransshipment,
        transshipmentType,
        sourcesCount: originalSourcesCount || sources,
        destinationsCount: originalDestinationsCount || destinations,
        bufferAmount,
        originalSupply: originalSupplyForDisplay,
        originalDemand: originalDemandForDisplay,
      }

      setOriginalProblem(loadedProblem)
      setAutoSolve(true)
    } else if (!isValid) {
      // If any parameter is invalid, clear the query string
      console.log("Invalid URL parameters detected:", {
        isValid,
        supplyLength: supply.length,
        demandLength: demand.length,
        costsLength: costs.length,
        expectedSupplyLength: actualArraySources,
        expectedDemandLength: actualArrayDestinations,
        actualSupply: supply,
        actualDemand: demand
      })
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])

  const updateQueryParams = (problem: TransportationProblem, method: Method, useUVOptimization: boolean) => {
    const params = new URLSearchParams()

    // Method
    params.set("method", method)

    // UV Optimization
    params.set("uv", useUVOptimization.toString())

    // Transshipment indicator
    params.set("transshipment", problem.isTransshipment ? "true" : "false")

    // Transshipment type and related parameters
    if (problem.isTransshipment && problem.transshipmentType) {
      params.set("transshipmentType", problem.transshipmentType)
      if (problem.sourcesCount) {
        params.set("sourcesCount", problem.sourcesCount.toString())
      }
      if (problem.destinationsCount) {
        params.set("destinationsCount", problem.destinationsCount.toString())
      }
      // Don't store bufferAmount in URL - it will be calculated from original supply/demand
    }

    // For mixed transshipment, use original dimensions in URL but store full arrays
    if (problem.isTransshipment && problem.transshipmentType === "mixed" && problem.sourcesCount && problem.destinationsCount) {
      // Sources and destinations (original dimensions)
      params.set("sources", problem.sourcesCount.toString())
      params.set("dests", problem.destinationsCount.toString())
      
      // Supply and demand values (full extended arrays with buffer)
      params.set("supply", problem.supply.join(","))
      params.set("demand", problem.demand.join(","))
    } else {
      // Sources and destinations
      params.set("sources", problem.supply.length.toString())
      params.set("dests", problem.demand.length.toString())

      // Supply values
      params.set("supply", problem.supply.join(","))

      // Demand values
      params.set("demand", problem.demand.join(","))
    }

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
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 md:gap-10 w-full items-start">
      <div className="bg-white rounded-lg shadow p-6 border relative">
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

      <div className="bg-white rounded-lg shadow p-6 border">
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
