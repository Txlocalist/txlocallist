import { Bungee, Geist_Mono, Shrikhand, Space_Grotesk, Ultra } from "next/font/google";
import "./globals.css";
import "./results/globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const shrikhand = Shrikhand({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const bungee = Bungee({
  variable: "--font-accent",
  subsets: ["latin"],
  weight: "400",
});

const ultra = Ultra({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: "400",
});

export const metadata = {
  title: "TX Local List",
  description:
    "TX Local List with secure signup, login, and a protected admin dashboard.",
  icons: {
    icon: "/citryn-gold.png",
    shortcut: "/citryn-gold.png",
    apple: "/citryn-gold.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${geistMono.variable} ${shrikhand.variable} ${bungee.variable} ${ultra.variable}`}
    >
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
