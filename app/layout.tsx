import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dropwatch.jeromtom.com"),
  title: "DropWatch — agentic observability on Splunk",
  description:
    "DropWatch ships every flash-drop event to Splunk over HEC, then an LLM agent reads it back through the MCP Server, scores drop health, flags oversell-bot subnets (OWASP OAT-005), and monitors its own reasoning.",
  applicationName: "DropWatch",
  keywords: [
    "Splunk",
    "Splunk MCP Server",
    "agentic observability",
    "DropWatch",
    "bot detection",
    "HEC",
    "oversell-proof",
  ],
  authors: [{ name: "Jerom Tom", url: "https://jeromtom.com" }],
  openGraph: {
    type: "website",
    url: "https://dropwatch.jeromtom.com",
    siteName: "DropWatch",
    title: "DropWatch — agentic observability on Splunk",
    description: "Provable correctness creates clean signals. The agent reads them.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "DropWatch — agentic observability on Splunk",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DropWatch — agentic observability on Splunk",
    description: "Provable correctness creates clean signals. The agent reads them.",
    images: ["/og.png"],
  },
  // Icons auto-detected from app/favicon.ico, app/icon.svg, app/apple-icon.png.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
