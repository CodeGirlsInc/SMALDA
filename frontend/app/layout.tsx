import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DarkModeScript } from "@/components/layout/DarkModeScript";
import { SystemThemeProvider } from "@/components/layout/DarkModeActivation";
import { MAIN_CONTENT_ID } from "@/lib/main-content";
import { SkipToContentLink } from "@/components/layout/SkipToContentLink";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toast";
import { SessionSync } from "@/components/SessionSync";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SMALDA",
  description: "Secure land document verification and analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <head>
        <DarkModeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SystemThemeProvider>
          <SkipToContentLink />
          <ToastProvider>
            <SessionSync />
            <div id={MAIN_CONTENT_ID} tabIndex={-1}>
              {children}
            </div>
            <Toaster />
          </ToastProvider>
        </SystemThemeProvider>
      </body>
    </html>
  );
}
