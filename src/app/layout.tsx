import type { Metadata } from "next";
import { Cormorant_Garamond, IM_Fell_English, IM_Fell_English_SC, La_Belle_Aurore } from "next/font/google";
import "./globals.css";

const display = IM_Fell_English({
  variable: "--font-fell",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const smallCaps = IM_Fell_English_SC({
  variable: "--font-fell-sc",
  weight: "400",
  subsets: ["latin"],
});

const body = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const script = La_Belle_Aurore({
  variable: "--font-aurore",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Codex of Machines",
  description: "Five inventions from the notebooks of Leonardo da Vinci, and the body he studied as one more machine, drawn in ink and set in motion by your scroll.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${smallCaps.variable} ${body.variable} ${script.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
