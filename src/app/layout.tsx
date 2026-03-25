import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { RELAY_CONNECT_VERSION } from "@bitmacro/relay-connect";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Relay Connect | BitMacro",
  description: "NIP-46 (Nostr Connect) and relay-api /signer",
  other: {
    "relay-connect-sdk": RELAY_CONNECT_VERSION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh flex flex-col bg-zinc-950">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-zinc-800/80 px-4 py-2 text-center font-mono text-[10px] text-zinc-600">
          @bitmacro/relay-connect {RELAY_CONNECT_VERSION}
        </footer>
      </body>
    </html>
  );
}
