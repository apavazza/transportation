"use client"

import { useState, useEffect, useCallback } from "react"
import Counter from "./counter"
import type { TransportationProblem, Method } from "@/src/lib/types"

interface InputFormProps {
  onSolve: (
    problem: TransportationProblem,
    method: Method,
    useUVOptimization: boolean,
    originalProblemForDisplay?: TransportationProblem,
  ) => void
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

    // Update costs matrix based on transshipment type
    if (useTransshipment && transshipmentType === "mixed") {
      // For mixed transshipment, create square matrix
      const totalNodes = newValue + destinations;
      const newCosts: (number | string)[][] = Array(totalNodes)
        .fill(0)
        .map((_, i) => Array(totalNodes).fill(0).map((_, j) => {
          if (i === j) return 0; // Diagonal is zero
          // Preserve existing values if they exist
          return costs[i]?.[j] ?? "";
        }));
      setCosts(newCosts);
    } else if (useTransshipment && transshipmentType === "dedicated") {
      // For dedicated transshipment, update the matrix structure
      updateDedicatedTransshipmentCosts(newValue, destinations, transshipmentCount)
    } else {
      // For regular transportation, rectangular matrix
      const newCosts: (number | string)[][] = costs.slice(0, newValue).map((row) => row.slice(0, destinations))
      while (newCosts.length < newValue) {
        newCosts.push(Array(destinations).fill(""))
      }
      setCosts(newCosts)
    }

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

    // Update costs matrix based on transshipment type
    if (useTransshipment && transshipmentType === "mixed") {
      // For mixed transshipment, create square matrix
      const totalNodes = sources + newValue;
      const newCosts: (number | string)[][] = Array(totalNodes)
        .fill(0)
        .map((_, i) => Array(totalNodes).fill(0).map((_, j) => {
          if (i === j) return 0; // Diagonal is zero
          // Preserve existing values if they exist
          return costs[i]?.[j] ?? "";
        }));
      setCosts(newCosts);
    } else if (useTransshipment && transshipmentType === "dedicated") {
      // For dedicated transshipment, update the matrix structure
      updateDedicatedTransshipmentCosts(sources, newValue, transshipmentCount)
    } else {
      // For regular transportation, rectangular matrix
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
    }

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
            const transshipmentRowIndex = i - supplyCount
            const transshipmentColIndex = j - demandCount
            if (transshipmentRowIndex === transshipmentColIndex) {
              // Diagonal T-T cells should always be 0
              newCosts[i][j] = 0
            } else {
              newCosts[i][j] = costs[i]?.[j] ?? ""
            }
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
    // For dedicated transshipment, prevent changing diagonal T-T costs (they should stay 0)
    if (useTransshipment && transshipmentType === "dedicated") {
      const isTransshipmentRow = sourceIndex >= sources
      const isTransshipmentCol = destIndex >= destinations
      if (isTransshipmentRow && isTransshipmentCol) {
        const transshipmentRowIndex = sourceIndex - sources
        const transshipmentColIndex = destIndex - destinations
        if (transshipmentRowIndex === transshipmentColIndex) {
          // Don't allow changing diagonal T-T costs
          return
        }
      }
    }

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

  // Set transshipment indices when enabling mixed transshipment
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
    } else {
      setTransshipmentIndices([])
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

  // Function to update URL with current parameters
  const updateURL = useCallback(() => {
    const params = new URLSearchParams()
    
    params.set('method', method)
    params.set('uv', useUVOptimization.toString())
    
    if (useTransshipment) {
      params.set('transshipment', 'true')
      params.set('transshipmentType', transshipmentType)
      
      if (transshipmentType === 'dedicated') {
        params.set('transshipmentCount', transshipmentCount.toString())
      }
    }
    
    params.set('sources', sources.toString())
    params.set('destinations', destinations.toString())
    
    // Only add supply/demand/costs if they're filled
    const hasValidSupply = supply.every(s => s !== '' && !isNaN(Number(s)))
    const hasValidDemand = demand.every(d => d !== '' && !isNaN(Number(d)))
    const hasValidCosts = costs.every(row => row.every(cost => cost !== '' && !isNaN(Number(cost))))
    
    if (hasValidSupply) {
      params.set('supply', supply.map(s => s.toString()).join(','))
    }
    
    if (hasValidDemand) {
      params.set('demand', demand.map(d => d.toString()).join(','))
    }
    
    if (hasValidCosts) {
      params.set('costs', costs.map(row => row.map(cost => cost.toString()).join(',')).join(';'))
    }
    
    // Update URL without triggering page reload
    const newURL = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, '', newURL)
  }, [method, useUVOptimization, useTransshipment, transshipmentType, transshipmentCount, sources, destinations, supply, demand, costs])

  // Update the handleSolve function to handle transshipment problems
  const handleSolve = useCallback(() => {
    try {
      // For transshipment problems, we need to validate the square matrix differently
      if (useTransshipment && transshipmentType === "mixed") {
        const totalNodes = sources + destinations;
        
        // Check supply and demand arrays
        if (supply.some((s) => s === "")) {
          setError("All supply values must be filled")
          return
        }
        if (demand.some((d) => d === "")) {
          setError("All demand values must be filled")
          return
        }
        
        // Check costs matrix (skip diagonal elements which should be 0)
        for (let i = 0; i < totalNodes; i++) {
          for (let j = 0; j < totalNodes; j++) {
            if (i === j) continue; // Skip diagonal
            if (!costs[i] || costs[i][j] === "") {
              setError("All cost cells must be filled")
              return
            }
          }
        }
      } else if (useTransshipment && transshipmentType === "dedicated") {
        // Dedicated transshipment validation
        if (supply.some((s) => s === "")) {
          setError("All supply values must be filled")
          return
        }
        if (demand.some((d) => d === "")) {
          setError("All demand values must be filled")
          return
        }
        
        // For dedicated transshipment, validate costs more specifically
        // Matrix structure: [S1, S2, ..., T1, T2, ...] x [D1, D2, ..., T1, T2, ...]
        const totalRows = sources + transshipmentCount
        const totalCols = destinations + transshipmentCount
        
        for (let i = 0; i < totalRows; i++) {
          for (let j = 0; j < totalCols; j++) {
            // Check if this cell should be validated
            const isSupplyRow = i < sources
            const isTransshipmentRow = i >= sources
            const isDemandCol = j < destinations
            const isTransshipmentCol = j >= destinations
            
            // All supply-to-demand, supply-to-transshipment, and transshipment-to-demand costs must be filled
            // Transshipment-to-transshipment costs are optional (can be empty)
            const shouldValidate = (isSupplyRow && isDemandCol) || 
                                   (isSupplyRow && isTransshipmentCol) || 
                                   (isTransshipmentRow && isDemandCol)
            
            if (shouldValidate && (!costs[i] || costs[i][j] === "")) {
              setError("All required cost cells must be filled")
              return
            }
          }
        }
      } else {
        // Regular validation for non-transshipment problems
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
      }

      // Convert all values to numbers
      const originalSupply: number[] = supply.map((s) => (typeof s === "string" ? Number(s) : s))
      const originalDemand: number[] = demand.map((d) => (typeof d === "string" ? Number(d) : d))
      const numericCosts: number[][] = costs.map((row) =>
        row.map((cost) => (typeof cost === "string" ? Number(cost) : cost)),
      )

      // For mixed transshipment, extend supply and demand arrays to match the square matrix
      // But don't modify the state - only create new arrays for the problem
      let problemSupply: number[] = originalSupply
      let problemDemand: number[] = originalDemand
      let bufferAmount: number | undefined = undefined

      if (useTransshipment && transshipmentType === "mixed") {
        const totalSupply = originalSupply.reduce((sum, s) => sum + s, 0)
        const totalDemand = originalDemand.reduce((sum, d) => sum + d, 0)

        if (totalSupply === totalDemand) {
          // If balanced, add a buffer to prevent incorrect paths
          bufferAmount = totalSupply
          const extendedSupply = [...originalSupply, ...Array(destinations).fill(0)]
          const extendedDemand = [...Array(sources).fill(0), ...originalDemand]

          problemSupply = extendedSupply.map((s) => s + bufferAmount!)
          problemDemand = extendedDemand.map((d) => d + bufferAmount!)
        } else {
          // If unbalanced, let the solver handle it by adding a dummy node.
          // First, extend the arrays with zeros.
          problemSupply = [...originalSupply, ...Array(destinations).fill(0)]
          problemDemand = [...Array(sources).fill(0), ...originalDemand]
        }
      } else if (useTransshipment && transshipmentType === "dedicated") {
        // For dedicated transshipment, extend arrays with transshipment nodes
        // Transshipment supply = sum of all actual supplies
        // Transshipment demand = sum of all actual demands
        const totalActualSupply = originalSupply.reduce((sum, s) => sum + s, 0)
        const totalActualDemand = originalDemand.reduce((sum, d) => sum + d, 0)
        
        // Extend supply array: [S1, S2, ..., T1, T2, ...]
        const transshipmentSupplies = Array(transshipmentCount).fill(totalActualSupply)
        problemSupply = [...originalSupply, ...transshipmentSupplies]
        
        // Extend demand array: [D1, D2, ..., T1, T2, ...]
        const transshipmentDemands = Array(transshipmentCount).fill(totalActualDemand)
        problemDemand = [...originalDemand, ...transshipmentDemands]
      }

      // Validate inputs
      if (problemSupply.some((s) => s < 0)) {
        setError("Supply values cannot be negative")
        return
      }
      if (problemDemand.some((d) => d < 0)) {
        setError("Demand values cannot be negative")
        return
      }
      if (numericCosts.some((row) => row.some((cost) => cost < 0))) {
        setError("Costs cannot be negative")
        return
      }

      // For transshipment problems, check if total supply equals total demand
      if (useTransshipment) {
        const totalSupply = problemSupply.reduce((sum, s) => sum + s, 0)
        const totalDemand = problemDemand.reduce((sum, d) => sum + d, 0)

        if (totalSupply !== totalDemand) {
          setError("Total supply must equal total demand for transshipment problems")
          return
        }
      }

      // Create the transportation problem
      const problem: TransportationProblem = {
        supply: problemSupply,
        demand: problemDemand,
        costs: numericCosts,
        isTransshipment: useTransshipment,
        // Add metadata to help with solution display
        originalSupply: originalSupply,
        originalDemand: originalDemand,
        transshipmentType: useTransshipment ? transshipmentType : undefined,
        sourcesCount: sources,
        destinationsCount: destinations,
        bufferAmount: bufferAmount,
        ...(useTransshipment && transshipmentType === "dedicated" && { transshipmentCount }),
      }

      // For display purposes, the original problem should not have the extended supply/demand
      const originalProblemForDisplay: TransportationProblem = {
        supply: originalSupply,
        demand: originalDemand,
        costs: numericCosts,
        isTransshipment: useTransshipment,
        originalSupply: originalSupply,
        originalDemand: originalDemand,
        transshipmentType: useTransshipment ? transshipmentType : undefined,
        sourcesCount: sources,
        destinationsCount: destinations,
        bufferAmount: bufferAmount,
        ...(useTransshipment && transshipmentType === "dedicated" && { transshipmentCount }),
      }

      // Pass the problem to onSolve - it will handle it like a regular transportation problem
      onSolve(problem, method, useUVOptimization, originalProblemForDisplay)
      setError(null)
      
      // Update URL with current parameters after successful solve
      updateURL()
    } catch (err) {
      setError("Error solving the problem. Please check your inputs.")
      console.error(err)
    }
  }, [supply, demand, costs, useTransshipment, transshipmentType, transshipmentCount, sources, destinations, method, useUVOptimization, onSolve, updateURL])

  // Load from query parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    
    // Load basic parameters
    const methodParam = urlParams.get('method') as Method | null
    const uvParam = urlParams.get('uv')
    const transshipmentParam = urlParams.get('transshipment')
    const transshipmentTypeParam = urlParams.get('transshipmentType') as "mixed" | "dedicated" | null
    const sourcesParam = urlParams.get('sources') || urlParams.get('sourcesCount')
    const destinationsParam = urlParams.get('destinations') || urlParams.get('destinationsCount') || urlParams.get('dests')
    const transshipmentCountParam = urlParams.get('transshipmentCount')
    const supplyParam = urlParams.get('supply')
    const demandParam = urlParams.get('demand')
    const costsParam = urlParams.get('costs')

    let shouldSolve = false

    if (methodParam && ['nwcm', 'lcm', 'vam'].includes(methodParam)) {
      setMethod(methodParam)
      shouldSolve = true
    }

    if (uvParam) {
      setUseUVOptimization(uvParam === 'true')
    }

    if (transshipmentParam) {
      setUseTransshipment(transshipmentParam === 'true')
      shouldSolve = true
    }

    if (transshipmentTypeParam && ['mixed', 'dedicated'].includes(transshipmentTypeParam)) {
      setTransshipmentType(transshipmentTypeParam)
    }

    if (sourcesParam) {
      const sourcesCount = parseInt(sourcesParam)
      if (!isNaN(sourcesCount) && sourcesCount >= 2 && sourcesCount <= 10) {
        setSources(sourcesCount)
        shouldSolve = true
      }
    }

    if (destinationsParam) {
      const destinationsCount = parseInt(destinationsParam)
      if (!isNaN(destinationsCount) && destinationsCount >= 2 && destinationsCount <= 10) {
        setDestinations(destinationsCount)
        shouldSolve = true
      }
    }

    if (transshipmentCountParam) {
      const transCount = parseInt(transshipmentCountParam)
      if (!isNaN(transCount) && transCount >= 1 && transCount <= 5) {
        setTransshipmentCount(transCount)
      }
    }

    if (supplyParam) {
      try {
        const supplyValues = supplyParam.split(',').map(s => parseFloat(s.trim()))
        if (supplyValues.every(v => !isNaN(v))) {
          setSupply(supplyValues)
          shouldSolve = true
        }
      } catch (e) {
        console.error('Error parsing supply parameter:', e)
      }
    }

    if (demandParam) {
      try {
        const demandValues = demandParam.split(',').map(d => parseFloat(d.trim()))
        if (demandValues.every(v => !isNaN(v))) {
          setDemand(demandValues)
          shouldSolve = true
        }
      } catch (e) {
        console.error('Error parsing demand parameter:', e)
      }
    }

    if (costsParam) {
      try {
        const costRows = costsParam.split(';')
        const costMatrix = costRows.map(row => 
          row.split(',').map(cost => parseFloat(cost.trim()))
        )
        if (costMatrix.every(row => row.every(cost => !isNaN(cost)))) {
          setCosts(costMatrix)
          shouldSolve = true
        }
      } catch (e) {
        console.error('Error parsing costs parameter:', e)
      }
    }

    // Auto-solve if we have all parameters
    if (shouldSolve && supplyParam && demandParam && costsParam) {
      // Set a flag to auto-solve after all state updates
      setTimeout(() => {
        try {
          // Trigger solve by creating a custom event or using a state flag
          const autoSolveEvent = new CustomEvent('autoSolve')
          window.dispatchEvent(autoSolveEvent)
        } catch (error) {
          console.error('Error setting up auto-solve:', error)
        }
      }, 200)
    }
  }, [])

  // Auto-solve when URL parameters are loaded
  useEffect(() => {
    const handleAutoSolve = () => {
      try {
        handleSolve()
      } catch (error) {
        console.error('Error auto-solving from URL parameters:', error)
      }
    }

    window.addEventListener('autoSolve', handleAutoSolve)
    return () => window.removeEventListener('autoSolve', handleAutoSolve)
  }, [handleSolve])

  // Determine if we should show the transshipment UI
  const showTransshipmentUI = useTransshipment

  // Determine if we should show the mixed transshipment UI
  const showMixedTransshipmentUI = showTransshipmentUI && transshipmentType === "mixed"

  // Determine if we should show the dedicated transshipment UI
  const showDedicatedTransshipmentUI = showTransshipmentUI && transshipmentType === "dedicated"

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
        />
        <label htmlFor="use-transshipment" className="ml-2 text-sm font-medium">
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
                        {transIndex === toTransIndex ? (
                          // Diagonal T-T cells (same node) are hardcoded to 0
                          <input
                            type="number"
                            value="0"
                            readOnly
                            className="w-24 h-8 text-center border rounded-md bg-gray-100"
                            placeholder="0"
                          />
                        ) : (
                          // Off-diagonal T-T cells are editable
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
                        )}
                      </td>
                    ))}
                    <td className="p-2 border bg-blue-50">
                      <input
                        type="number"
                        min={0}
                        value={supply.slice(0, sources).reduce((sum: number, s) => {
                          const value = typeof s === 'number' ? s : parseFloat(s) || 0;
                          return sum + value;
                        }, 0)}
                        readOnly
                        className="w-24 h-8 text-center border rounded-md bg-blue-50"
                        placeholder="Auto"
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
                  {/* Transshipment demand (should equal sum of actual demands) */}
                  {Array.from({ length: transshipmentCount }).map((_, index) => (
                    <td key={`trans-demand-${index}`} className="p-2 border bg-blue-50">
                      <input
                        type="number"
                        min={0}
                        value={demand.slice(0, destinations).reduce((sum: number, d) => {
                          const value = typeof d === 'number' ? d : parseFloat(d) || 0;
                          return sum + value;
                        }, 0)}
                        readOnly
                        className="w-24 h-8 text-center border rounded-md bg-blue-50"
                        placeholder="Auto"
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