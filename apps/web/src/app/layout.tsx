import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { WalletProvider } from "@/components/WalletProvider";
import { WalletSessionManager } from "@/components/WalletSessionManager"; // 1. Import the new component

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SupChain - Supply Chain Management",
  description: "Transparent and secure supply chain management on the blockchain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <WalletProvider>
            {/* 2. Add the WalletSessionManager here */}
            {/* It will now monitor the session on all pages */}
            <WalletSessionManager />
            
            {children}
          </WalletProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
