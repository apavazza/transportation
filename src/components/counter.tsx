"use client"

import { Minus, Plus } from "lucide-react"

interface CounterProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label?: string
}

export default function Counter({ value, onChange, min = 1, max = 10, label }: CounterProps) {
  const increment = () => {
    if (value < max) {
      onChange(value + 1)
    }
  }

  const decrement = () => {
    if (value > min) {
      onChange(value - 1)
    }
  }

  return (
    <div className="flex flex-col space-y-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      <div className="inline-flex items-center border rounded-md">
        <button
          type="button"
          className={`h-8 w-8 rounded-none rounded-l-md flex items-center justify-center ${
            value <= min ? "text-gray-300" : "hover:bg-gray-100"
          }`}
          onClick={decrement}
          disabled={value <= min}
        >
          <Minus className="h-3 w-3" />
          <span className="sr-only">Decrease</span>
        </button>
        <div className="flex-1 px-2 text-center min-w-[40px]">
          <span className="text-sm font-medium">{value}</span>
        </div>
        <button
          type="button"
          className={`h-8 w-8 rounded-none rounded-r-md flex items-center justify-center ${
            value >= max ? "text-gray-300" : "hover:bg-gray-100"
          }`}
          onClick={increment}
          disabled={value >= max}
        >
          <Plus className="h-3 w-3" />
          <span className="sr-only">Increase</span>
        </button>
      </div>
    </div>
  )
}
