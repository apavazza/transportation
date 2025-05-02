"use client"
import TransportationSolver from "@/src/components/transportation-solver"

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Transportation Problem Solver</h1>
      <TransportationSolver />
    </main>
  )
}
