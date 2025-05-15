import type {
  TransportationProblem,
  TransshipmentProblem,
  TransshipmentNode,
  TransshipmentLink,
} from "./types"

/**
 * Converts a transshipment problem to an equivalent transportation problem
 * that can be solved using the standard transportation algorithms.
 */
export function convertToTransportation(transshipment: TransshipmentProblem): TransportationProblem {
  const { nodes, links, balanceValue, transshipmentIndices, supplyNodesDemand, demandNodesSupply } = transshipment

  // Extract supply, demand, and transshipment nodes
  const supplyNodes = nodes.filter((node) => node.type === "supply")
  const demandNodes = nodes.filter((node) => node.type === "demand")
  const transshipmentNodes = nodes.filter((node) => node.type === "transshipment")

  // Validate that there's at least one supply and one demand node
  if (supplyNodes.length === 0 || demandNodes.length === 0) {
    throw new Error("Transshipment problem must have at least one supply and one demand node")
  }

  // Check if this is a mixed transshipment problem with balance values
  const isMixedTransshipment = balanceValue !== undefined && 
                              transshipmentIndices !== undefined && 
                              supplyNodesDemand !== undefined && 
                              demandNodesSupply !== undefined;

  // Check if this is a problem with dedicated transshipment nodes
  const isDedicatedTransshipment = !isMixedTransshipment && transshipmentNodes.length > 0;

  let supply: number[];
  let demand: number[];
  let costs: number[][];

  if (isMixedTransshipment) {
    // For mixed transshipment, handle the balance approach from the example
    
    // Extract the original supplies and demands
    const originalSupply = supplyNodes.map(node => node.value);
    const originalDemand = demandNodes.map(node => Math.abs(node.value));
    
    // Apply the balance value to all nodes
    // Supply nodes: original supply + 0 if not transshipment
    // Demand nodes: balanceValue if transshipment, 0 otherwise
    supply = [...originalSupply];
    
    // Add rows for demand nodes that act as sources in the mixed model
    for (let i = 0; i < demandNodesSupply.length; i++) {
      supply.push(demandNodesSupply[i]);
    }
    
    // Demand nodes: original demand + 0 if not transshipment
    // Supply nodes: balanceValue if transshipment, 0 otherwise
    demand = [...originalDemand];
    
    // Add columns for supply nodes that act as destinations in the mixed model
    for (let i = 0; i < supplyNodesDemand.length; i++) {
      demand.push(supplyNodesDemand[i]);
    }
    
    // Create costs matrix for the expanded problem
    costs = [];
    
    // Rows for original supply nodes
    for (let i = 0; i < originalSupply.length; i++) {
      costs[i] = [];
      
      // Costs to original demand nodes
      for (let j = 0; j < originalDemand.length; j++) {
        const directLink = links.find(
          link => link.from === supplyNodes[i].id && link.to === demandNodes[j].id
        );
        costs[i][j] = directLink ? directLink.cost : 999;
      }
      
      // Costs to supply nodes acting as destinations (self and other supply nodes)
      for (let j = 0; j < supplyNodesDemand.length; j++) {
        if (i === j && transshipmentIndices?.includes(i)) {
          // Self-loop for transshipment supply nodes (zero cost)
          costs[i][originalDemand.length + j] = 0;
        } else {
          // Not allowed
          costs[i][originalDemand.length + j] = 999;
        }
      }
    }
    
    // Rows for demand nodes acting as sources
    for (let i = 0; i < demandNodesSupply.length; i++) {
      costs[originalSupply.length + i] = [];
      
      // Costs to original demand nodes
      for (let j = 0; j < originalDemand.length; j++) {
        if (i === j && transshipmentIndices?.includes(originalSupply.length + i)) {
          // Self-loop for transshipment demand nodes (zero cost)
          costs[originalSupply.length + i][j] = 0;
        } else {
          // Check if there's a link from this demand node to another demand node
          if (i < demandNodes.length && j < demandNodes.length) {
            const fromId = demandNodes[i].id;
            const toId = demandNodes[j].id;
            const link = links.find(l => l.from === fromId && l.to === toId);
            costs[originalSupply.length + i][j] = link ? link.cost : 999;
          } else {
            costs[originalSupply.length + i][j] = 999;
          }
        }
      }
      
      // Costs to supply nodes acting as destinations
      for (let j = 0; j < Math.min(supplyNodesDemand.length, supplyNodes.length); j++) {
        // Check if there's a link from this demand node to a supply node
        if (i < demandNodes.length && j < supplyNodes.length) {
          const fromId = demandNodes[i].id;
          const toId = supplyNodes[j].id;
          const link = links.find(l => l.from === fromId && l.to === toId);
          costs[originalSupply.length + i][originalDemand.length + j] = link ? link.cost : 999;
        } else {
          costs[originalSupply.length + i][originalDemand.length + j] = 999;
        }
      }
      
      // If supplyNodesDemand is longer than supplyNodes, fill the rest with 999 (infinity)
      for (let j = supplyNodes.length; j < supplyNodesDemand.length; j++) {
        costs[originalSupply.length + i][originalDemand.length + j] = 999;
      }
    }
  } else if (isDedicatedTransshipment) {
    // For dedicated transshipment, we use the approach from the second example image
    // where each transshipment node has capacity equal to the total problem size
    
    // Use the modified supply and demand from the transshipment problem
    // These already include the additional capacities for transshipment nodes
    supply = transshipment.supply;
    demand = transshipment.demand;
    
    // Create costs matrix that maps directly from the links
    const numRows = supplyNodes.length + transshipmentNodes.length;
    const numCols = demandNodes.length + transshipmentNodes.length;
    costs = Array(numRows).fill(0).map(() => Array(numCols).fill(999));
    
    // Fill in the costs from the links
    for (const link of links) {
      const fromNode = nodes.find(n => n.id === link.from);
      const toNode = nodes.find(n => n.id === link.to);
      
      if (fromNode && toNode) {
        // Map the node positions to matrix indices
        let sourceIndex = -1;
        let destIndex = -1;
        
        if (fromNode.type === "supply") {
          // It's a supply node
          sourceIndex = supplyNodes.findIndex(n => n.id === fromNode.id);
        } else if (fromNode.type === "transshipment") {
          // It's a transshipment node
          sourceIndex = supplyNodes.length + transshipmentNodes.findIndex(n => n.id === fromNode.id);
        }
        
        if (toNode.type === "demand") {
          // It's a demand node
          destIndex = demandNodes.findIndex(n => n.id === toNode.id);
        } else if (toNode.type === "transshipment") {
          // It's a transshipment node
          destIndex = demandNodes.length + transshipmentNodes.findIndex(n => n.id === toNode.id);
        }
        
        if (sourceIndex >= 0 && destIndex >= 0) {
          costs[sourceIndex][destIndex] = link.cost;
        }
      }
    }
  } else {
    // Standard transshipment conversion (not mixed nodes)
    
    // Create supply array
    supply = supplyNodes.map((node) => node.value);

    // Create demand array
    demand = demandNodes.map((node) => Math.abs(node.value)); // Convert negative values to positive

    // Create costs matrix
    costs = [];

    // For each supply node
    for (let i = 0; i < supplyNodes.length; i++) {
      costs[i] = [];
      // For each demand node
      for (let j = 0; j < demandNodes.length; j++) {
        // Find direct link
        const directLink = links.find(
          (link) => link.from === supplyNodes[i].id && link.to === demandNodes[j].id,
        );

        if (directLink) {
          // If there's a direct link, use its cost
          costs[i][j] = directLink.cost;
        } else {
          // If there's no direct link, calculate cost through transshipment nodes
          // This is a simplified approach - in a real application, you would use a shortest path algorithm
          let minCost = Number.POSITIVE_INFINITY;

          for (const transNode of transshipmentNodes) {
            const supplyToTransLink = links.find(
              (link) => link.from === supplyNodes[i].id && link.to === transNode.id,
            );
            const transToDemandLink = links.find(
              (link) => link.from === transNode.id && link.to === demandNodes[j].id,
            );

            if (supplyToTransLink && transToDemandLink) {
              const totalCost = supplyToTransLink.cost + transToDemandLink.cost;
              minCost = Math.min(minCost, totalCost);
            }
          }

          costs[i][j] = minCost === Number.POSITIVE_INFINITY ? 999 : minCost; // Use a large cost if no path found
        }
      }
    }
  }

  return {
    supply,
    demand,
    costs,
    isTransshipment: true,
  }
}

/**
 * Converts a solution from the transportation problem back to the transshipment problem format
 */
export function convertSolutionToTransshipment(
  solution: { allocations: { source: number; destination: number; value: number }[]; totalCost: number },
  transshipment: TransshipmentProblem,
): { nodes: TransshipmentNode[]; links: TransshipmentLink[]; totalCost: number } {
  const { nodes } = transshipment

  // Identify supply, demand, and transshipment nodes
  const supplyNodes = nodes.filter((node) => node.type === "supply")
  const demandNodes = nodes.filter((node) => node.type === "demand")
  const transshipmentNodes = nodes.filter((node) => node.type === "transshipment")

  // Create a map of flows
  const flows: Map<string, number> = new Map()

  // Process allocations
  for (const allocation of solution.allocations) {
    const { source, destination, value } = allocation

    // Skip dummy allocations (transshipment node to itself)
    if (
      source >= supplyNodes.length &&
      source < supplyNodes.length + transshipmentNodes.length &&
      destination >= demandNodes.length &&
      destination < demandNodes.length + transshipmentNodes.length &&
      source - supplyNodes.length === destination - demandNodes.length
    ) {
      continue
    }

    // Map indices back to node IDs
    let fromNodeId: number
    let toNodeId: number

    if (source < supplyNodes.length) {
      // It's a supply node
      fromNodeId = supplyNodes[source].id
    } else {
      // It's a transshipment node (as supply)
      const transshipmentIndex = source - supplyNodes.length
      fromNodeId = transshipmentNodes[transshipmentIndex].id
    }

    if (destination < demandNodes.length) {
      // It's a demand node
      toNodeId = demandNodes[destination].id
    } else {
      // It's a transshipment node (as demand)
      const transshipmentIndex = destination - demandNodes.length
      toNodeId = transshipmentNodes[transshipmentIndex].id
    }

    // Add to flows
    const key = `${fromNodeId}-${toNodeId}`
    flows.set(key, (flows.get(key) || 0) + value)
  }

  // Create links from flows
  const links: TransshipmentLink[] = []

  for (const [key, flow] of flows.entries()) {
    const [fromId, toId] = key.split("-").map(Number)

    // Find the original link to get the cost
    const originalLink = transshipment.links.find((link) => link.from === fromId && link.to === toId)

    if (originalLink) {
      links.push({
        from: fromId,
        to: toId,
        cost: originalLink.cost,
        flow,
      })
    }
  }

  return {
    nodes: transshipment.nodes,
    links,
    totalCost: solution.totalCost,
  }
}

/**
 * Converts a transshipment problem where transient nodes are part of supply or demand nodes
 * to a standard transshipment problem format
 */
export function convertMixedTransshipment(
  supply: number[],
  demand: number[],
  costs: number[][],
  transshipmentIndices: number[],
): TransshipmentProblem {
  const nodes: TransshipmentNode[] = []
  const links: TransshipmentLink[] = []

  // Calculate total supply and demand
  const totalSupply = supply.reduce((sum, val) => sum + val, 0);
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const totalDemand = demand.reduce((sum, val) => sum + val, 0);
  
  // Make a copy of transshipmentIndices so we can modify it
  let modifiedTransshipmentIndices = [...transshipmentIndices];
  
  // Check if all nodes are marked as transshipment nodes
  const supplyIndices = Array.from({ length: supply.length }, (_, i) => i);
  const demandIndices = Array.from({ length: demand.length }, (_, i) => i + supply.length);
  
  const allSupplyAreTransshipment = supplyIndices.every(idx => modifiedTransshipmentIndices.includes(idx));
  const allDemandAreTransshipment = demandIndices.every(idx => modifiedTransshipmentIndices.includes(idx));
  
  // If all nodes are transshipment, we need at least one pure supply and one pure demand
  if (allSupplyAreTransshipment && allDemandAreTransshipment) {
    // Remove the first supply node from transshipment indices
    if (supply.length > 0) {
      modifiedTransshipmentIndices = modifiedTransshipmentIndices.filter(idx => idx !== 0);
    }
    
    // Remove the first demand node from transshipment indices
    if (demand.length > 0) {
      modifiedTransshipmentIndices = modifiedTransshipmentIndices.filter(idx => idx !== supply.length);
    }
  }
  
  // Determine the balance value to add to all nodes to ensure flow conservation
  // Based on the examples, a value equal to the sum of all supply (or demand) should work
  const balanceValue = totalSupply; // or totalDemand (they should be equal for a balanced problem)
  
  // Create nodes with original supply/demand values
  for (let i = 0; i < supply.length; i++) {
    const isTransshipment = modifiedTransshipmentIndices.includes(i);
    nodes.push({
      id: i,
      type: isTransshipment ? "transshipment" : "supply",
      value: supply[i], // Original supply value
      name: `S${i + 1}`,
    });
  }

  for (let i = 0; i < demand.length; i++) {
    const isTransshipment = modifiedTransshipmentIndices.includes(i + supply.length);
    nodes.push({
      id: i + supply.length,
      type: isTransshipment ? "transshipment" : "demand",
      value: -demand[i], // Negative for demand
      name: `D${i + 1}`,
    });
  }

  // Create direct links between all supply and demand nodes based on the cost matrix
  for (let i = 0; i < supply.length; i++) {
    for (let j = 0; j < demand.length; j++) {
      if (costs[i] && costs[i][j] !== undefined && costs[i][j] < Number.MAX_SAFE_INTEGER) {
        links.push({
          from: i,
          to: j + supply.length,
          cost: costs[i][j],
          flow: 0,
        });
      }
    }
  }

  // Add diagonal links (self-loops) for all transshipment nodes with zero cost
  for (const index of modifiedTransshipmentIndices) {
    links.push({
      from: index,
      to: index,
      cost: 0,
      flow: 0,
    });
  }

  // Create arrays to store the additional demand for supply nodes and vice versa
  // When a node is a transshipment node, we'll add balanceValue to its opposite flow
  // This follows the pattern in the examples: "20+120", "0+120", etc.
  const supplyNodesDemand = Array(supply.length).fill(0);
  const demandNodesSupply = Array(demand.length).fill(0);
  
  // For all nodes acting as transshipment points, add the balance value
  for (const index of modifiedTransshipmentIndices) {
    if (index < supply.length) {
      // Supply node acting as transshipment - give it demand equal to balanceValue
      supplyNodesDemand[index] = balanceValue;
    } else {
      // Demand node acting as transshipment - give it supply equal to balanceValue
      const demandIndex = index - supply.length;
      demandNodesSupply[demandIndex] = balanceValue;
    }
  }

  // Create modified supply and demand arrays that include the balance values
  // These will be used by the conversion algorithm
  const modifiedSupply = [...supply];
  for (let i = 0; i < modifiedSupply.length; i++) {
    if (modifiedTransshipmentIndices.includes(i)) {
      // If this supply node is a transshipment node, it needs both supply and demand
      // but the supply is already included, so no change needed here
    }
  }
  
  const modifiedDemand = [...demand];
  for (let i = 0; i < modifiedDemand.length; i++) {
    if (modifiedTransshipmentIndices.includes(i + supply.length)) {
      // If this demand node is a transshipment node, it needs both supply and demand
      // but the demand is already included, so no change needed here
    }
  }
  
  return {
    nodes,
    links,
    supply: modifiedSupply,
    demand: modifiedDemand,
    costs,
    isTransshipment: true,
    balanceValue,
    transshipmentIndices: modifiedTransshipmentIndices,
    supplyNodesDemand,
    demandNodesSupply
  };
}

/**
 * Creates a transshipment problem with dedicated transshipment nodes
 */
export function createTransshipmentProblem(
  supplyValues: number[],
  demandValues: number[],
  transshipmentCount: number,
  costs: number[][],
): TransshipmentProblem {
  const nodes: TransshipmentNode[] = []
  const links: TransshipmentLink[] = []

  // Calculate the total supply and demand (which should be equal in a balanced problem)
  const totalSupply = supplyValues.reduce((sum, val) => sum + val, 0);
  const totalDemand = demandValues.reduce((sum, val) => sum + val, 0);
  
  // Create supply nodes
  for (let i = 0; i < supplyValues.length; i++) {
    nodes.push({
      id: i,
      type: "supply",
      value: supplyValues[i],
      name: `S${i + 1}`,
    })
  }

  // Create transshipment nodes
  // Each transshipment node will have a capacity equal to the total supply/demand
  for (let i = 0; i < transshipmentCount; i++) {
    nodes.push({
      id: supplyValues.length + i,
      type: "transshipment",
      value: 0, // Value is 0 for transshipment nodes
      name: `T${i + 1}`,
    })
  }

  // Create demand nodes
  for (let i = 0; i < demandValues.length; i++) {
    nodes.push({
      id: supplyValues.length + transshipmentCount + i,
      type: "demand",
      value: -demandValues[i], // Negative for demand
      name: `D${i + 1}`,
    })
  }

  // Create links based on the cost matrix
  // The cost matrix has dimensions:
  // rows: (supplyCount + transshipmentCount), columns: (demandCount + transshipmentCount)
  // With columns ordered: Demand columns first, then Transshipment columns

  // Create links from supply nodes to demand nodes and transshipment nodes
  for (let i = 0; i < supplyValues.length; i++) {
    // Links to demand nodes (first demandValues.length columns)
    for (let j = 0; j < demandValues.length; j++) {
      if (costs[i] && costs[i][j] !== undefined && costs[i][j] < Number.MAX_SAFE_INTEGER) {
        links.push({
          from: i, // Supply node
          to: supplyValues.length + transshipmentCount + j, // Demand node
          cost: costs[i][j],
          flow: 0,
        });
      }
    }
    
    // Links to transshipment nodes (next transshipmentCount columns)
    for (let j = 0; j < transshipmentCount; j++) {
      if (costs[i] && costs[i][demandValues.length + j] !== undefined && costs[i][demandValues.length + j] < Number.MAX_SAFE_INTEGER) {
        links.push({
          from: i, // Supply node
          to: supplyValues.length + j, // Transshipment node
          cost: costs[i][demandValues.length + j],
          flow: 0,
        });
      }
    }
  }
  
  // Create links from transshipment nodes to demand nodes
  for (let i = 0; i < transshipmentCount; i++) {
    // Links to demand nodes
    for (let j = 0; j < demandValues.length; j++) {
      if (costs[supplyValues.length + i] && costs[supplyValues.length + i][j] !== undefined && costs[supplyValues.length + i][j] < Number.MAX_SAFE_INTEGER) {
        links.push({
          from: supplyValues.length + i, // Transshipment node
          to: supplyValues.length + transshipmentCount + j, // Demand node
          cost: costs[supplyValues.length + i][j],
          flow: 0,
        });
      }
    }
    
    // Self-loops for transshipment nodes with zero cost
    links.push({
      from: supplyValues.length + i, // Transshipment node
      to: supplyValues.length + i, // Same transshipment node
      cost: 0, // Zero cost for self-loops
      flow: 0,
    });
    
    // Links between transshipment nodes if there are multiple
    for (let j = 0; j < transshipmentCount; j++) {
      if (i !== j && costs[supplyValues.length + i] && costs[supplyValues.length + i][demandValues.length + j] !== undefined && costs[supplyValues.length + i][demandValues.length + j] < Number.MAX_SAFE_INTEGER) {
        links.push({
          from: supplyValues.length + i, // Transshipment node
          to: supplyValues.length + j, // Another transshipment node
          cost: costs[supplyValues.length + i][demandValues.length + j],
          flow: 0,
        });
      }
    }
  }

  // For dedicated transshipment, we need to:
  // 1. Keep the original supply/demand values for original nodes
  // 2. Add a full "copy" of the original problem's total supply/demand to each transshipment node
  
  // Each transshipment node will have the full capacity of the problem
  const modifiedSupply = [...supplyValues];
  const modifiedDemand = [...demandValues];
  
  // Add supply and demand for each transshipment node
  for (let i = 0; i < transshipmentCount; i++) {
    modifiedSupply.push(totalSupply); // Add supply equal to total original supply
    modifiedDemand.push(totalDemand); // Add demand equal to total original demand
  }

  return {
    nodes,
    links,
    supply: modifiedSupply,
    demand: modifiedDemand,
    costs,
    isTransshipment: true,
  }
}
