import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Xlink Unified Enterprise Entity Engine",
  description: "Enterprise Cleanroom Entity Gateway, Interactive Explorer & Admin Center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans bg-[#090d16] text-slate-100 antialiased`}>
        <div className="min-h-screen flex flex-col">
          {/* Top Enterprise Header */}
          <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-[#0c1220]/90 backdrop-blur-md">
            <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight hover:opacity-90 transition-opacity">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-mono text-sm font-black">
                    XL
                  </div>
                  <div className="flex flex-col">
                    <span className="font-extrabold tracking-tight text-white flex items-center gap-1.5">
                      Xlink
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        Core Engine
                      </span>
                    </span>
                  </div>
                </Link>

                <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
                  <Link
                    href="/"
                    className="px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                  >
                    Overview
                  </Link>
                  <Link
                    href="/explorer"
                    className="px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Xlink Explorer
                  </Link>
                  <Link
                    href="/admin"
                    className="px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Admin Center
                  </Link>
                </nav>
              </div>

              {/* Status and Tenant Indicators */}
              <div className="flex items-center gap-3 text-xs">
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-slate-300 font-medium">Gateway Active</span>
                  <span className="text-slate-500">|</span>
                  <span className="font-mono text-emerald-400">12ms P99</span>
                </div>

                <div className="px-2.5 py-1 rounded-md bg-blue-950/60 border border-blue-800/40 text-blue-300 font-mono text-[11px]">
                  v1.0 &amp; beta
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 flex flex-col">{children}</main>
        </div>
      </body>
    </html>
  );
}
