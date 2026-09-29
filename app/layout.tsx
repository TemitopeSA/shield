import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ShieldProvider } from "@/lib/client/store";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-jb", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shield — EU Wrapper Engine",
  description: "Launch tax-advantaged investing across Europe. PEA, ISK and PIR accounts through one rules engine and one API. Prototype — not tax advice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ShieldProvider>{children}</ShieldProvider>
      </body>
    </html>
  );
}
