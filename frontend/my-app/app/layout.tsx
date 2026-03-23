import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "./components/Navbar";
import AnalyticsProvider from "./components/AnalyticsProvider";
import "./globals.css";

const WriterDock = dynamic(() => import("./components/WriterDock"), {
  loading: () => null,
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TcbProject",
  description: "Editorial publishing platform.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "100x100" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AnalyticsProvider>
          <Navbar />
          <WriterDock />
          <div className="app-content">
            {children}
          </div>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
