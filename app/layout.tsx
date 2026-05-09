import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aurum — Agentic AI Medical Assistant',
  description: 'AI-grounded SOAP note generation with self-critique, retrieval, and audit.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}