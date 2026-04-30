import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Living Book OS",
  description: "A cinematic, spatial storytelling architecture for nonlinear creativity.",
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
