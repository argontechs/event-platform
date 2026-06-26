import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
