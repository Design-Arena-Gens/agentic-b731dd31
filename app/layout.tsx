import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Text to Image Generator",
  description: "Generate expressive visuals from text prompts directly in your browser."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
