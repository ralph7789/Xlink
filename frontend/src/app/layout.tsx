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
  title: "xLink - Application Portals",
  description: "xLink: The central enterprise hub for API management and system operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-14 items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
                <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                xLink
              </Link>
              <nav className="flex items-center gap-6 text-sm font-medium">
                <Link href="/developer" className="transition-colors hover:text-foreground text-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-1">
                  Developer
                </Link>
                <Link href="/admin" className="transition-colors hover:text-foreground text-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-1">
                  Admin
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 flex flex-col">{children}</main>
        </div>
      </body>
    </html>
  );
}
