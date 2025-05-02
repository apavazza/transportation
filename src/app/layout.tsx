import type { Metadata } from 'next'
import './globals.css'
import Footer from '@/src/components/footer'

export const metadata: Metadata = {
  title: 'Transportation Problem Solver',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Footer />
        </body>
    </html>
  )
}
