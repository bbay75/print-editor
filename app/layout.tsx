import "./globals.css";
import type { Metadata } from "next";
import {
  Inter,
  Noto_Sans,
  Oswald,
  Marck_Script,
  Caveat,
} from "next/font/google";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const notoSans = Noto_Sans({
  subsets: ["latin", "cyrillic"],
  variable: "--font-noto-sans",
});

const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  variable: "--font-oswald",
});

const marckScript = Marck_Script({
  subsets: ["latin", "cyrillic"],
  weight: "400",
  variable: "--font-marck-script",
});

const caveat = Caveat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "Print Editor",
  description: "Mobile-friendly print editor built with Next.js and Tailwind",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${notoSans.variable} ${oswald.variable} ${marckScript.variable} ${caveat.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
