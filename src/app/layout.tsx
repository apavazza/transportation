import type { Metadata } from 'next'
import './globals.css'
import Footer from '@/src/components/footer'

export const metadata: Metadata = {
  title: 'Transportation Problem Solver',
  description: "Open-source web app for solving transportation and transshipment problems using North-West Corner, Least Cost, Vogel's Approximation, and MODI (UV) optimization methods. Provides step-by-step allocation and final optimized solutions.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}