import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

// Exposed as CSS variables only (not the app default) — used by the branded
// quotation/invoice document to match the company's print template, whose body
// text is Inter (titles are the commercial Roxborough CF; Playfair is the
// closest free stand-in).
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
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
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
