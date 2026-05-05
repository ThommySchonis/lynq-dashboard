import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "./components/ThemeProvider";
import PageTransition from "./components/PageTransition";
import BlockedStateGuard from "./components/BlockedStateGuard";

export const metadata: Metadata = {
  title: "Lynq — Customer Support Dashboard",
  description: "Premium customer support dashboard for e-commerce brands",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('lynq-theme')||'light';document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800&display=swap"
        />
      </head>
      <body>
        <ThemeProvider>
          <BlockedStateGuard>
            <PageTransition>{children}</PageTransition>
          </BlockedStateGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}
