import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/brand";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE.replace(/\.$/, "")}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: `${SITE_DESCRIPTION} Discover high-quality products from trusted US retailers.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-US" className={`${inter.variable} ${manrope.variable} h-full antialiased`}>
      <body className={`${inter.className} min-h-full flex flex-col`}>
        <TooltipProvider delay={150}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
