import type { Metadata } from "next"
import { Geist_Mono, Inter, Outfit } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { isE2ETestMode } from "@/lib/test-mode"
import { cn } from "@/lib/utils"

const outfitHeading = Outfit({ subsets: ["latin"], variable: "--font-heading" })

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "Deploy Grid",
    template: "%s • Deploy Grid",
  },
  description:
    "Deploy Grid is a full-stack deployment dashboard to manage projects, builds, logs, and artifact URLs.",
  applicationName: "Deploy Grid",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
    shortcut: "/logo.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const content = <ThemeProvider>{children}</ThemeProvider>

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable,
        outfitHeading.variable
      )}
    >
      <body>
        {isE2ETestMode() ? content : <ClerkProvider>{content}</ClerkProvider>}
      </body>
    </html>
  )
}
