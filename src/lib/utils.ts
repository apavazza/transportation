import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import type { TransportationProblem } from "./types"

export function isBalanced(problem: TransportationProblem): boolean {
  const totalSupply = problem.supply.reduce((sum, s) => sum + s, 0)
  const totalDemand = problem.demand.reduce((sum, d) => sum + d, 0)
  return totalSupply === totalDemand
}

export function balanceProblem(problem: TransportationProblem): TransportationProblem {
  const totalSupply = problem.supply.reduce((sum, s) => sum + s, 0)
  const totalDemand = problem.demand.reduce((sum, d) => sum + d, 0)

  const balancedProblem: TransportationProblem = {
    supply: [...problem.supply],
    demand: [...problem.demand],
    costs: problem.costs.map((row) => [...row]),
  }

  if (totalSupply < totalDemand) {
    // Add dummy source
    balancedProblem.supply.push(totalDemand - totalSupply)
    const dummyRow = Array(problem.demand.length).fill(0)
    balancedProblem.costs.push(dummyRow)
  } else if (totalSupply > totalDemand) {
    // Add dummy destination
    balancedProblem.demand.push(totalSupply - totalDemand)
    balancedProblem.costs = balancedProblem.costs.map((row) => [...row, 0])
  }

  return balancedProblem
}

export function findMinCostCell(
  costs: number[][],
  remainingSupply: number[],
  remainingDemand: number[],
): { source: number; destination: number } {
  let minCost = Number.POSITIVE_INFINITY
  let minSource = -1
  let minDest = -1

  for (let i = 0; i < remainingSupply.length; i++) {
    if (remainingSupply[i] <= 0) continue

    for (let j = 0; j < remainingDemand.length; j++) {
      if (remainingDemand[j] <= 0) continue

      if (costs[i][j] < minCost) {
        minCost = costs[i][j]
        minSource = i
        minDest = j
      }
    }
  }

  return { source: minSource, destination: minDest }
}

export function calculatePenalties(
  costs: number[][],
  remainingSupply: number[],
  remainingDemand: number[],
): { rowPenalties: number[]; columnPenalties: number[] } {
  const rowPenalties: number[] = []
  const columnPenalties: number[] = []

  // Calculate row penalties
  for (let i = 0; i < remainingSupply.length; i++) {
    if (remainingSupply[i] <= 0) {
      rowPenalties.push(0)
      continue
    }

    let min1 = Number.POSITIVE_INFINITY
    let min2 = Number.POSITIVE_INFINITY

    for (let j = 0; j < remainingDemand.length; j++) {
      if (remainingDemand[j] <= 0) continue

      if (costs[i][j] < min1) {
        min2 = min1
        min1 = costs[i][j]
      } else if (costs[i][j] < min2) {
        min2 = costs[i][j]
      }
    }

    rowPenalties.push(min2 === Number.POSITIVE_INFINITY ? 0 : min2 - min1)
  }

  // Calculate column penalties
  for (let j = 0; j < remainingDemand.length; j++) {
    if (remainingDemand[j] <= 0) {
      columnPenalties.push(0)
      continue
    }

    let min1 = Number.POSITIVE_INFINITY
    let min2 = Number.POSITIVE_INFINITY

    for (let i = 0; i < remainingSupply.length; i++) {
      if (remainingSupply[i] <= 0) continue

      if (costs[i][j] < min1) {
        min2 = min1
        min1 = costs[i][j]
      } else if (costs[i][j] < min2) {
        min2 = costs[i][j]
      }
    }

    columnPenalties.push(min2 === Number.POSITIVE_INFINITY ? 0 : min2 - min1)
  }

  return { rowPenalties, columnPenalties }
}

export function findMaxPenaltyCell(
  costs: number[][],
  remainingSupply: number[],
  remainingDemand: number[],
  rowPenalties: number[],
  columnPenalties: number[],
): { source: number; destination: number } {
  let maxSource = -1
  let maxDest = -1

  // Find max row penalty
  let maxRowPenalty = -1
  let maxRowIndex = -1

  for (let i = 0; i < rowPenalties.length; i++) {
    if (remainingSupply[i] <= 0) continue

    if (rowPenalties[i] > maxRowPenalty) {
      maxRowPenalty = rowPenalties[i]
      maxRowIndex = i
    }
  }

  // Find max column penalty
  let maxColPenalty = -1
  let maxColIndex = -1

  for (let j = 0; j < columnPenalties.length; j++) {
    if (remainingDemand[j] <= 0) continue

    if (columnPenalties[j] > maxColPenalty) {
      maxColPenalty = columnPenalties[j]
      maxColIndex = j
    }
  }

  // Compare max row penalty and max column penalty
  if (maxRowPenalty >= maxColPenalty) {
    maxSource = maxRowIndex

    // Find min cost cell in the selected row
    let minCost = Number.POSITIVE_INFINITY
    let minCostIndex = -1

    for (let j = 0; j < remainingDemand.length; j++) {
      if (remainingDemand[j] <= 0) continue

      if (costs[maxRowIndex][j] < minCost) {
        minCost = costs[maxRowIndex][j]
        minCostIndex = j
      }
    }

    maxDest = minCostIndex
  } else {
    maxDest = maxColIndex

    // Find min cost cell in the selected column
    let minCost = Number.POSITIVE_INFINITY
    let minCostIndex = -1

    for (let i = 0; i < remainingSupply.length; i++) {
      if (remainingSupply[i] <= 0) continue

      if (costs[i][maxColIndex] < minCost) {
        minCost = costs[i][maxColIndex]
        minCostIndex = i
      }
    }

    maxSource = minCostIndex
  }

  return { source: maxSource, destination: maxDest }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
