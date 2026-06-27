import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import AccountNav from "@/components/AccountNav";
import { LeagueThemeProvider } from "@/context/LeagueThemeContext";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["400", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "DraftHQ",
  description: "Draft Together. Win Forever.",
  icons: { icon: "/branding/favicon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <LeagueThemeProvider>
          <AccountNav />
          {children}
        </LeagueThemeProvider>
      </body>
    </html>
  );
}
