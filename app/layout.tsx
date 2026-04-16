import type { Metadata } from "next";
import { Rethink_Sans } from "next/font/google";
import "./globals.css";

const rethinkSans = Rethink_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rethink",
});

export const metadata: Metadata = {
  title: "Lynq — Customer Support Dashboard",
  description: "Premium customer support dashboard for e-commerce brands",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={rethinkSans.variable}>
      <body>{children}</body>
    </html>
  );
}
