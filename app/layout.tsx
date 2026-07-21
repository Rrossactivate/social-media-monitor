import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Geoff Woods — Social Audience Tracker",
  description:
    "A daily view of audience growth and content performance across Geoff Woods and AI Leadership channels.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
