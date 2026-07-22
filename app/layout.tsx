import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://geoff-woods-social-tracker.robin-ross-6445.chatgpt.site"),
  title: "Geoff Woods — Social Audience Tracker",
  description:
    "A daily view of audience growth and content performance across Geoff Woods and AI Leadership channels.",
  openGraph: {
    title: "Geoff Woods — Social Audience Tracker",
    description: "Daily audience growth and content performance across Geoff Woods and AI Leadership channels.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
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
