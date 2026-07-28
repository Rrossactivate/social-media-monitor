import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://geoff-woods-social-tracker.robin-ross-6445.chatgpt.site"),
  title: "AIL Social Media Monitoring",
  description:
    "Daily social audience growth, content performance, and earned-media monitoring for Geoff Woods and AI Leadership.",
  openGraph: {
    title: "AIL Social Media Monitoring",
    description: "Daily social audience growth, content performance, and earned-media monitoring for Geoff Woods and AI Leadership.",
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
