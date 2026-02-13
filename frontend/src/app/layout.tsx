import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Live Avatar Lip Sync",
  description: "Real-time mouth animation for streaming and OBS overlays",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
