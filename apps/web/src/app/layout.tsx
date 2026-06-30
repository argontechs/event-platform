import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Exposed as CSS variables only (not the app default) — used by the branded
// quotation/invoice document to match the company's print template: titles in
// Roxborough CF (client-licensed, self-hosted) and body text in Inter.
const roxborough = localFont({
  src: "./fonts/RoxboroughCF-Regular.ttf",
  variable: "--font-roxborough",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Event & Decoration Platform",
  description:
    "Multi-company event & decoration management platform (Malaysia) — websites, orders, AI quoting, invoicing & event planning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${roxborough.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
