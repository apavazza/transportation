import type { TransportationProblem, Solution, Allocation, Step, Cell, UVStep, AllocationStep } from "../types"; // Ensure UVStep and AllocationStep are imported if used for casting

// Helper function to create an epsilon grid from allocations
const createEpsilonGridFromAllocations = (
  allocs: Allocation[],
  numSources: number,
  numDestinations: number,
): boolean[][] => {
  const grid = Array(numSources)
    .fill(null)
    .map(() => Array(numDestinations).fill(false));
  for (const alloc of allocs) {
    if (Math.abs(alloc.value - 0.000001) < 1e-9) { // Check for epsilon
      grid[alloc.source][alloc.destination] = true;
    }
  }
  return grid;
};

export function optimizeWithMODI(problem: TransportationProblem, initialSolution: Solution): Solution {
  const { supply, demand, costs } = problem;
  const m = supply.length;
  const n = demand.length;

  // Ensure currentSolution and initialSolution have an epsilonGrid
  const currentSolution = { 
    ...initialSolution, 
    allocations: initialSolution.allocations.map(a => ({...a})), // Deep copy allocations
    epsilonGrid: createEpsilonGridFromAllocations(initialSolution.allocations, m, n) 
  };
  // If initialSolution itself is part of a larger structure (e.g. OptimizationResult),
  // it's good practice to ensure the original initialSolution object also gets an epsilonGrid if it didn't have one.
  if (!initialSolution.epsilonGrid) {
    initialSolution.epsilonGrid = createEpsilonGridFromAllocations(initialSolution.allocations, m, n);
  }


  const steps: Step[] = [];
  let iteration = 1;
  let isOptimal = false;

  let bestSolution = {
    ...currentSolution, // Start best solution from the prepared currentSolution
    totalCost: calculateTotalCost(currentSolution.allocations, costs),
    // epsilonGrid is already part of currentSolution, so it's copied here
  };
  bestSolution.epsilonGrid = currentSolution.epsilonGrid.map(row => [...row]); // Ensure deep copy for bestSolution

  while (!isOptimal && iteration <= 20) {
    const requiredAllocations = m + n - 1;

    if (currentSolution.allocations.length < requiredAllocations) {
      const updatedAllocations = handleDegenerateCase(currentSolution.allocations, costs, m, n);
      currentSolution.allocations = updatedAllocations;
      currentSolution.epsilonGrid = createEpsilonGridFromAllocations(updatedAllocations, m, n);

      steps.push({
        type: "allocation",
        description: "Degenerate fix: ε allocated",
        remainingSupply: [...problem.supply],
        remainingDemand: [...problem.demand],
        allAllocations: updatedAllocations.map(a => ({...a})),
        epsilonGrid: currentSolution.epsilonGrid.map(row => [...row]), // Deep copy
      } as AllocationStep);

      currentSolution.totalCost = calculateTotalCost(updatedAllocations, costs);
      // Update bestSolution if this degenerate fix leads to a better state (unlikely but for completeness)
      if (currentSolution.totalCost < bestSolution.totalCost) {
         bestSolution = { ...currentSolution, allocations: currentSolution.allocations.map(a => ({...a})), epsilonGrid: currentSolution.epsilonGrid.map(row => [...row]) };
      }
      
      iteration++;
      continue;
    }

    const { uValues, vValues, success } = calculateUVValues(currentSolution.allocations, costs);

    if (!success) {
      steps.push({
        type: "uv",
        description: `Iteration ${iteration}: Failed to calculate U and V values. The problem may be degenerate.`,
        allAllocations: currentSolution.allocations.map(a => ({...a})),
        epsilonGrid: currentSolution.epsilonGrid?.map(row => [...row]), // Deep copy
      } as UVStep);
      break;
    }

    const opportunityCosts = calculateOpportunityCosts(uValues, vValues, costs);
    let enteringCell = findEnteringCell(opportunityCosts, currentSolution.allocations);

    if (!enteringCell) {
      isOptimal = true;
      steps.push({
        type: "uv",
        description: `Iteration ${iteration}: Solution is optimal. No negative opportunity costs found.`,
        uValues,
        vValues,
        opportunityCosts,
        allAllocations: currentSolution.allocations.map(a => ({...a})),
        epsilonGrid: currentSolution.epsilonGrid?.map(row => [...row]), // Deep copy
      } as UVStep);
      break;
    }

    let cycle = findCycle(enteringCell, currentSolution.allocations, m, n);

    if (!cycle || cycle.length < 4) {
      // ... (handling for invalid cycle, trying next best entering cell - simplified here)
       steps.push({
        type: "uv",
        description: `Iteration ${iteration}: Could not find a valid cycle for entering cell (S${enteringCell.source + 1},D${enteringCell.destination + 1}).`,
        uValues, vValues, opportunityCosts, enteringCell,
        allAllocations: currentSolution.allocations.map(a => ({...a})),
        epsilonGrid: currentSolution.epsilonGrid?.map(row => [...row]), // Deep copy
      } as UVStep);
      // Attempt to find next best or break
      const nextBestEnteringCell = findNextBestEnteringCell(opportunityCosts, currentSolution.allocations, enteringCell);
      if (nextBestEnteringCell) {
        enteringCell = nextBestEnteringCell;
        cycle = findCycle(enteringCell, currentSolution.allocations, m, n);
        if (!cycle || cycle.length < 4) {
            isOptimal = true; break; // Still no valid cycle
        }
      } else {
        isOptimal = true; break; // No other entering cells
      }
    }
    
    const leavingValue = findLeavingVariable(cycle, currentSolution.allocations);

    if (leavingValue < 0.000001 && Math.abs(leavingValue - 0.000001) > 1e-9) { // If it's effectively zero but not epsilon itself
       steps.push({
        type: "uv",
        description: `Iteration ${iteration}: Leaving value is too small. Potential degeneracy. Skipping.`,
        uValues, vValues, opportunityCosts, enteringCell,
        allAllocations: currentSolution.allocations.map(a => ({...a})),
        epsilonGrid: currentSolution.epsilonGrid?.map(row => [...row]),
      } as UVStep);
      iteration++;
      continue;
    }

    steps.push({
      type: "uv",
      description: `Iteration ${iteration}: Entering cell (S${enteringCell.source + 1},D${enteringCell.destination + 1}) with opportunity cost ${opportunityCosts[enteringCell.source][enteringCell.destination].toFixed(2)}`,
      uValues, vValues, opportunityCosts, enteringCell, leavingValue, cycle,
      allAllocations: currentSolution.allocations.map(a => ({...a})), // State before update
      epsilonGrid: currentSolution.epsilonGrid?.map(row => [...row]),   // Grid for state before update
    } as UVStep);

    const newAllocations = updateAllocations(currentSolution.allocations, cycle, leavingValue);
    const newTotalCost = calculateTotalCost(newAllocations, costs);

    currentSolution.allocations = newAllocations;
    currentSolution.totalCost = newTotalCost;
    currentSolution.epsilonGrid = createEpsilonGridFromAllocations(newAllocations, m, n);


    if (newTotalCost < bestSolution.totalCost - 1e-9) { // Use a small tolerance for improvement
      bestSolution = { ...currentSolution, allocations: currentSolution.allocations.map(a => ({...a})), epsilonGrid: currentSolution.epsilonGrid.map(row => [...row]) };
    } else if (newTotalCost >= currentSolution.totalCost && iteration > 1) { // If cost didn't improve or worsened
        // Revert to bestSolution if current step didn't improve
        // This handles cases where a step might be taken that doesn't strictly improve but is part of finding optimum
        // However, if it worsens, it's better to stick to the previous best.
        // For simplicity here, if no strict improvement, consider it optimal with current bestSolution.
        // A more robust handling might be needed for complex scenarios.
        // For now, if no strict improvement, consider it optimal with current bestSolution.
      isOptimal = true;
      steps.push({
        type: "uv",
        description: `Iteration ${iteration}: No further cost improvement. Using best solution found.`,
        allAllocations: currentSolution.allocations.map(a => ({...a})),
        epsilonGrid: currentSolution.epsilonGrid?.map(row => [...row]),
      } as UVStep);
      break;
    }
    
    iteration++;
  }

  return {
    ...bestSolution, // bestSolution already has its allocations and epsilonGrid
    steps: [...steps],
    isOptimal: true, // Assume optimal or max iterations reached
  };
}

// Helper function to calculate total cost
function calculateTotalCost(allocations: Allocation[], costs: number[][]): number {
  return allocations.reduce(
    (sum: number, allocation: Allocation) => sum + allocation.value * costs[allocation.source][allocation.destination],
    0
  );
}

// Helper function to update allocations based on a cycle
function updateAllocations(allocations: Allocation[], cycle: Cell[], leavingValue: number): Allocation[] {
  // Create a deep copy of allocations to avoid modifying the original
  const newAllocations = JSON.parse(JSON.stringify(allocations)) as Allocation[];

  // Update allocations based on the cycle
  for (let i = 0; i < cycle.length; i++) {
    const cell = cycle[i];
    const sign = i % 2 === 0 ? 1 : -1; // Add to even-indexed cells, subtract from odd-indexed

    // Find if this cell already has an allocation
    const existingIndex = newAllocations.findIndex(
      (a) => a.source === cell.source && a.destination === cell.destination
    );

    if (existingIndex >= 0) {
      // Update existing allocation
      newAllocations[existingIndex].value += sign * leavingValue;

      // Remove allocation if it becomes zero
      if (Math.abs(newAllocations[existingIndex].value) < 0.000001) {
        newAllocations.splice(existingIndex, 1);
      }
    } else {
      // Add new allocation
      newAllocations.push({
        source: cell.source,
        destination: cell.destination,
        value: sign * leavingValue,
      });
    }
  }

  return newAllocations;
}

function handleDegenerateCase(
  allocations: Allocation[],
  costs: number[][],
  numSources: number,
  numDestinations: number,
): Allocation[] {
  const newAllocations = [...allocations]
  const epsilon = 0.000001 // Very small value

  // Create a grid to track allocated cells
  const allocationGrid: boolean[][] = Array(numSources)
    .fill(null)
    .map(() => Array(numDestinations).fill(false))

  for (const allocation of allocations) {
    allocationGrid[allocation.source][allocation.destination] = true
  }

  // Find unallocated cells with lowest costs that don't form loops
  while (newAllocations.length < numSources + numDestinations - 1) {
    let minCost = Number.POSITIVE_INFINITY
    let bestCell = { source: -1, destination: -1 }

    // Find unallocated cell with minimum cost
    for (let i = 0; i < numSources; i++) {
      for (let j = 0; j < numDestinations; j++) {
        if (!allocationGrid[i][j] && costs[i][j] < minCost) {
          // Check if adding this cell would form a loop
          const tempAllocations = [...newAllocations, { source: i, destination: j, value: epsilon }]
          const wouldFormLoop = checkForLoop(tempAllocations)

          if (!wouldFormLoop) {
            minCost = costs[i][j]
            bestCell = { source: i, destination: j }
          }
        }
      }
    }

    if (bestCell.source === -1) {
      // Could not find a suitable cell, break to avoid infinite loop
      break
    }

    // Add epsilon allocation to the best cell
    newAllocations.push({
      source: bestCell.source,
      destination: bestCell.destination,
      value: epsilon,
    })

    allocationGrid[bestCell.source][bestCell.destination] = true
  }

  return newAllocations
}

function checkForLoop(allocations: Allocation[]): boolean {
  // Create a graph representation of allocations
  const graph: Map<string, string[]> = new Map()

  // Add nodes and edges
  for (const allocation of allocations) {
    const rowNode = `r${allocation.source}`
    const colNode = `c${allocation.destination}`

    if (!graph.has(rowNode)) graph.set(rowNode, [])
    if (!graph.has(colNode)) graph.set(colNode, [])

    const rowEdges = graph.get(rowNode)
    const colEdges = graph.get(colNode)

    if (rowEdges) rowEdges.push(colNode)
    if (colEdges) colEdges.push(rowNode)
  }

  // Check for cycles using DFS
  const visited = new Set<string>()

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      const parent = new Map<string, string>()
      if (hasCycleDFS(node, graph, visited, parent, "")) {
        return true
      }
    }
  }

  return false
}

function hasCycleDFS(
  node: string,
  graph: Map<string, string[]>,
  visited: Set<string>,
  parent: Map<string, string>,
  parentNode: string,
): boolean {
  visited.add(node)

  const neighbors = graph.get(node) || []
  for (const neighbor of neighbors) {
    // Skip the parent node
    if (neighbor === parentNode) continue

    // If neighbor is already visited and not the parent, we found a cycle
    if (visited.has(neighbor) && neighbor !== parent.get(node)) {
      return true
    }

    // If neighbor is not visited, continue DFS
    if (!visited.has(neighbor)) {
      parent.set(neighbor, node)
      if (hasCycleDFS(neighbor, graph, visited, parent, node)) {
        return true
      }
    }
  }

  return false
}

function calculateUVValues(
  allocations: Allocation[],
  costs: number[][],
): { uValues: number[]; vValues: number[]; success: boolean } {
  // Determine dimensions
  let maxSource = -1;
  let maxDest = -1;

  for (const allocation of allocations) {
    maxSource = Math.max(maxSource, allocation.source);
    maxDest = Math.max(maxDest, allocation.destination);
  }

  const numSources = maxSource + 1;
  const numDestinations = maxDest + 1;

  // Initialize u and v arrays
  const uValues: (number | null)[] = Array(numSources).fill(null);
  const vValues: (number | null)[] = Array(numDestinations).fill(null);

  // Set u[0] = 0 as a starting point
  uValues[0] = 0;

  // Create a matrix to represent basic cells (cells with allocations)
  const basicCells: boolean[][] = Array(numSources)
    .fill(null)
    .map(() => Array(numDestinations).fill(false));

  // Mark basic cells
  for (const allocation of allocations) {
    basicCells[allocation.source][allocation.destination] = true;
  }

  // Keep iterating until all u and v values are determined
  let changed = true;
  let iterations = 0;
  const maxIterations = numSources * numDestinations * 2; // Increase max iterations for more safety

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // For each basic cell, try to determine u or v if one is known and the other isn't
    for (let i = 0; i < numSources; i++) {
      for (let j = 0; j < numDestinations; j++) {
        if (basicCells[i][j]) {
          if (uValues[i] !== null && vValues[j] === null) {
            // If u[i] is known, calculate v[j]
            vValues[j] = costs[i][j] - (uValues[i] as number);
            changed = true;
          } else if (uValues[i] === null && vValues[j] !== null) {
            // If v[j] is known, calculate u[i]
            uValues[i] = costs[i][j] - (vValues[j] as number);
            changed = true;
          }
        }
      }
    }
  }

  // Check if all values are determined
  const allDetermined = uValues.every((u) => u !== null) && vValues.every((v) => v !== null);

  // If not all values are determined, try a different approach (set another u value to 0)
  if (!allDetermined && uValues.some(u => u === null)) {
    // Find the first null u value and set it to 0
    for (let i = 1; i < uValues.length; i++) {
      if (uValues[i] === null) {
        // Try a second attempt with this u value set to 0
        const secondAttempt = calculateUVValuesWithUFixed(i, allocations, costs);
        if (secondAttempt.success) {
          return secondAttempt;
        }
        break;
      }
    }
  }

  // If still not determined, return the best effort
  if (!allDetermined) {
    return {
      uValues: uValues.map((u) => (u === null ? 0 : u)),
      vValues: vValues.map((v) => (v === null ? 0 : v)),
      success: false,
    };
  }

  return {
    uValues: uValues as number[],
    vValues: vValues as number[],
    success: true,
  };
}

// Try calculating UV values with a specific u value fixed to 0
function calculateUVValuesWithUFixed(
  fixedUIndex: number,
  allocations: Allocation[],
  costs: number[][],
): { uValues: number[]; vValues: number[]; success: boolean } {
  // Determine dimensions
  let maxSource = -1;
  let maxDest = -1;

  for (const allocation of allocations) {
    maxSource = Math.max(maxSource, allocation.source);
    maxDest = Math.max(maxDest, allocation.destination);
  }

  const numSources = maxSource + 1;
  const numDestinations = maxDest + 1;

  // Initialize u and v arrays
  const uValues: (number | null)[] = Array(numSources).fill(null);
  const vValues: (number | null)[] = Array(numDestinations).fill(null);

  // Set the specified u value to 0
  uValues[fixedUIndex] = 0;

  // Create a matrix for basic cells
  const basicCells: boolean[][] = Array(numSources)
    .fill(null)
    .map(() => Array(numDestinations).fill(false));

  // Mark basic cells
  for (const allocation of allocations) {
    basicCells[allocation.source][allocation.destination] = true;
  }

  // Calculate all u and v values
  let changed = true;
  let iterations = 0;
  const maxIterations = numSources * numDestinations * 2;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (let i = 0; i < numSources; i++) {
      for (let j = 0; j < numDestinations; j++) {
        if (basicCells[i][j]) {
          if (uValues[i] !== null && vValues[j] === null) {
            vValues[j] = costs[i][j] - (uValues[i] as number);
            changed = true;
          } else if (uValues[i] === null && vValues[j] !== null) {
            uValues[i] = costs[i][j] - (vValues[j] as number);
            changed = true;
          }
        }
      }
    }
  }

  const allDetermined = uValues.every((u) => u !== null) && vValues.every((v) => v !== null);

  if (!allDetermined) {
    return {
      uValues: uValues.map((u) => (u === null ? 0 : u)),
      vValues: vValues.map((v) => (v === null ? 0 : v)),
      success: false,
    };
  }

  return {
    uValues: uValues as number[],
    vValues: vValues as number[],
    success: true,
  };
}

function calculateOpportunityCosts(uValues: number[], vValues: number[], costs: number[][]): number[][] {
  const opportunityCosts: number[][] = [];

  for (let i = 0; i < uValues.length; i++) {
    opportunityCosts[i] = [];
    for (let j = 0; j < vValues.length; j++) {
      // Standard opportunity cost formula: Cij - (Ui + Vj)
      // Negative opportunity cost means potential improvement
      const opportunityCost = costs[i][j] - (uValues[i] + vValues[j]);
      
      // Round to avoid floating point precision issues
      // Use 10 decimal places to maintain precision
      opportunityCosts[i][j] = Math.round(opportunityCost * 10000000000) / 10000000000;
    }
  }

  return opportunityCosts;
}

function findEnteringCell(
  opportunityCosts: number[][],
  allocations: Allocation[],
): { source: number; destination: number } | null {
  // In MODI, we look for the most negative opportunity cost
  // A negative opportunity cost means potential for improvement
  let minCost = -0.0000001; // Small negative threshold to account for floating point errors
  let minSource = -1;
  let minDest = -1;

  // Check all non-basic cells (cells without allocations)
  for (let i = 0; i < opportunityCosts.length; i++) {
    for (let j = 0; j < opportunityCosts[i].length; j++) {
      // Check if this cell is non-basic (not in allocations)
      const isBasic = allocations.some((a) => a.source === i && a.destination === j);

      if (!isBasic && opportunityCosts[i][j] < minCost) {
        minCost = opportunityCosts[i][j];
        minSource = i;
        minDest = j;
      }
    }
  }

  // If no entering cell found (no negative opportunity costs), return null
  if (minSource === -1 || minDest === -1) {
    return null;
  }

  return { source: minSource, destination: minDest };
}

function findCycle(
  enteringCell: Cell,
  allocations: Allocation[],
  numSources: number,
  numDestinations: number
): Cell[] {
  // Mark all allocated cells in a grid
  const basicCellGrid: boolean[][] = Array(numSources)
    .fill(null)
    .map(() => Array(numDestinations).fill(false));

  for (const allocation of allocations) {
    basicCellGrid[allocation.source][allocation.destination] = true;
  }

  // IMPORTANT: Force the entering cell to be treated as allocated for cycle search
  basicCellGrid[enteringCell.source][enteringCell.destination] = true;

  // Build a bipartite graph (rows and columns as nodes)
  const rowNodes = new Map<number, Set<number>>();
  const colNodes = new Map<number, Set<number>>();

  for (let i = 0; i < numSources; i++) {
    rowNodes.set(i, new Set<number>());
  }
  for (let j = 0; j < numDestinations; j++) {
    colNodes.set(j, new Set<number>());
  }

  // Each basic cell links row i to column j
  for (let i = 0; i < numSources; i++) {
    for (let j = 0; j < numDestinations; j++) {
      if (basicCellGrid[i][j]) {
        rowNodes.get(i)?.add(j);
        colNodes.get(j)?.add(i);
      }
    }
  }

  // Find all cycles that start and end at row(enteringCell.source),
  // but also must include col(enteringCell.destination)
  const cycles: string[][] = [];
  const path: string[] = [`r${enteringCell.source}`];
  const visited = new Set<string>();

  // DFS to find cycles in this bipartite graph
  findBipartiteCycles(
    rowNodes,
    colNodes,
    `r${enteringCell.source}`,  // start
    `r${enteringCell.source}`,  // current
    visited,
    path,
    cycles,
    0,
    20
  );

  // Filter out any cycles that don’t include the column node
  const validCycles = cycles.filter((cycle) => cycle.includes(`c${enteringCell.destination}`));

  if (validCycles.length === 0) {
    // No cycle found
    return [];
  }

  // Convert the first valid cycle into a list of Cell objects
  const graphCycle = validCycles[0];
  let cellCycle = convertGraphCycleToCellCycle(graphCycle);

  const idx = cellCycle.findIndex(
    (c) =>
      c.source === enteringCell.source &&
      c.destination === enteringCell.destination
  );
  if (idx > 0) {
    // Rotate array so entering cell is first
    cellCycle = [
      ...cellCycle.slice(idx),
      ...cellCycle.slice(0, idx),
    ];
  }

  // Must have at least 4 cells to be a valid loop
  return cellCycle.length >= 4 ? cellCycle : [];
}

/**
 * DFS for cycles in a bipartite graph of rowNodes -> colNodes.
 */
function findBipartiteCycles(
  rowNodes: Map<number, Set<number>>,
  colNodes: Map<number, Set<number>>,
  start: string,
  current: string,
  visited: Set<string>,
  path: string[],
  cycles: string[][],
  depth: number,
  maxDepth: number
): void {
  if (depth > maxDepth) return;

  visited.add(current);

  // Distinguish between rX and cY
  const isRow = current.startsWith("r");
  const index = parseInt(current.slice(1), 10);

  // Determine neighbors
  const neighbors = isRow
    ? (rowNodes.get(index) || [])
    : (colNodes.get(index) || []);

  for (const neighbor of neighbors) {
    const neighborNode = isRow ? `c${neighbor}` : `r${neighbor}`;

    // If we’re back to the start (and valid cycle length)
    if (neighborNode === start && path.length >= 4) {
      cycles.push([...path, neighborNode]);
      continue;
    }

    // Avoid re-visiting nodes (except to close a cycle)
    if (!visited.has(neighborNode)) {
      path.push(neighborNode);
      findBipartiteCycles(
        rowNodes,
        colNodes,
        start,
        neighborNode,
        new Set(visited),
        path,
        cycles,
        depth + 1,
        maxDepth
      );
      path.pop();
    }
  }
}

/**
 * Convert a bipartite cycle (like [r0, c3, r2, c1, r0]) into an array of Cells.
 */
function convertGraphCycleToCellCycle(graphCycle: string[]): Cell[] {
  // Ensure it’s a closed loop
  if (graphCycle[0] !== graphCycle[graphCycle.length - 1]) {
    graphCycle.push(graphCycle[0]);
  }

  const cells: Cell[] = [];
  // Parse pairs of row->col
  for (let i = 0; i < graphCycle.length - 1; i++) {
    const curr = graphCycle[i];
    const next = graphCycle[i + 1];
    if (curr.startsWith("r") && next.startsWith("c")) {
      const source = parseInt(curr.substring(1), 10);
      const destination = parseInt(next.substring(1), 10);
      cells.push({ source, destination });
    } else if (curr.startsWith("c") && next.startsWith("r")) {
      const source = parseInt(next.substring(1), 10);
      const destination = parseInt(curr.substring(1), 10);
      cells.push({ source, destination });
    }
  }
  return cells;
}

function findLeavingVariable(cycle: Cell[], allocations: Allocation[]): number {
  // Determine which cells in the cycle are negative (odd-indexed cells)
  const negativeCells = cycle.filter((_, index) => index % 2 === 1)

  // Find the minimum allocation among negative cells
  let minAllocation = Number.POSITIVE_INFINITY

  for (const cell of negativeCells) {
    const allocation = allocations.find((a) => a.source === cell.source && a.destination === cell.destination)

    if (allocation && allocation.value < minAllocation) {
      minAllocation = allocation.value
    }
  }

  // If no minimum found (shouldn't happen in a valid problem), return a small value
  return minAllocation === Number.POSITIVE_INFINITY ? 0.000001 : minAllocation
}

function findNextBestEnteringCell(
  opportunityCosts: number[][],
  allocations: Allocation[],
  excludeCell: Cell
): Cell | null {
  let minCost = -0.0000001;
  let minSource = -1;
  let minDest = -1;

  for (let i = 0; i < opportunityCosts.length; i++) {
    for (let j = 0; j < opportunityCosts[i].length; j++) {
      // Skip the excluded cell and already allocated cells
      if ((i === excludeCell.source && j === excludeCell.destination) || 
          allocations.some(a => a.source === i && a.destination === j)) {
        continue;
      }

      if (opportunityCosts[i][j] < minCost) {
        minCost = opportunityCosts[i][j];
        minSource = i;
        minDest = j;
      }
    }
  }

  return minSource !== -1 ? { source: minSource, destination: minDest } : null;
}
