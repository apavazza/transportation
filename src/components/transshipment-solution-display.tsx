"use client"
import { useState } from "react"
import type { TransshipmentNode, TransshipmentLink } from "@/src/lib/types"

interface TransshipmentSolutionDisplayProps {
  solution: {
    nodes: TransshipmentNode[]
    links: TransshipmentLink[]
    totalCost: number
  }
}

export default function TransshipmentSolutionDisplay({ solution }: TransshipmentSolutionDisplayProps) {
  const { nodes, links, totalCost } = solution
  const [showDetails, setShowDetails] = useState(true)

  // Format numbers to avoid displaying infinity
  const formatNumber = (num: number): string => {
    if (!isFinite(num)) return "0"
    if (Math.abs(num) < 0.001) return "0"
    return num.toFixed(2)
  }

  // Group nodes by type
  const supplyNodes = nodes.filter((node) => node.type === "supply")
  const demandNodes = nodes.filter((node) => node.type === "demand")
  const transshipmentNodes = nodes.filter((node) => node.type === "transshipment")

  return (
    <div className="space-y-6">
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <h4 className="font-medium">Transshipment Solution</h4>
          <div className="mt-2 font-bold text-blue-700">Total Cost: {formatNumber(totalCost)}</div>
        </div>
        <div className="p-4">
          <div className="mb-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              {showDetails ? "Hide Details" : "Show Details"}
            </button>
          </div>

          {showDetails && (
            <div className="space-y-6">
              {/* Node Information */}
              <div>
                <h5 className="font-medium mb-2">Node Information</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-3">
                    <h6 className="font-medium text-sm mb-2">Supply Nodes</h6>
                    <ul className="space-y-1">
                      {supplyNodes.map((node) => (
                        <li key={`supply-${node.id}`} className="text-sm">
                          {node.name}: {formatNumber(node.value)} units
                        </li>
                      ))}
                    </ul>
                  </div>
                  {transshipmentNodes.length > 0 && (
                    <div className="border rounded-lg p-3">
                      <h6 className="font-medium text-sm mb-2">Transshipment Nodes</h6>
                      <ul className="space-y-1">
                        {transshipmentNodes.map((node) => (
                          <li key={`trans-${node.id}`} className="text-sm">
                            {node.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="border rounded-lg p-3">
                    <h6 className="font-medium text-sm mb-2">Demand Nodes</h6>
                    <ul className="space-y-1">
                      {demandNodes.map((node) => (
                        <li key={`demand-${node.id}`} className="text-sm">
                          {node.name}: {formatNumber(Math.abs(node.value))} units
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Flow Information */}
              <div>
                <h5 className="font-medium mb-2">Flow Information</h5>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2 border">From</th>
                        <th className="p-2 border">To</th>
                        <th className="p-2 border">Flow</th>
                        <th className="p-2 border">Cost per Unit</th>
                        <th className="p-2 border">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {links.map((link, index) => {
                        const fromNode = nodes.find((n) => n.id === link.from)
                        const toNode = nodes.find((n) => n.id === link.to)

                        if (!fromNode || !toNode) return null

                        return (
                          <tr key={`link-${index}`}>
                            <td className="p-2 border">{fromNode.name}</td>
                            <td className="p-2 border">{toNode.name}</td>
                            <td className="p-2 border text-right">{formatNumber(link.flow)}</td>
                            <td className="p-2 border text-right">{formatNumber(link.cost)}</td>
                            <td className="p-2 border text-right">{formatNumber(link.flow * link.cost)}</td>
                          </tr>
                        )
                      })}
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="p-2 border text-right font-medium">
                          Total Cost:
                        </td>
                        <td className="p-2 border text-right font-medium">{formatNumber(totalCost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
