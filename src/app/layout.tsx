import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import {
  RELAY_CONNECT_PACKAGE_NAME,
  RELAY_CONNECT_PRODUCT_NAME,
  RELAY_CONNECT_VERSION,
} from "@bitmacro/relay-connect";
import { RelayConnectLogBridge } from "@/components/RelayConnectLogBridge";
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
    "relay-connect-product": RELAY_CONNECT_PRODUCT_NAME,
    "relay-connect-sdk": RELAY_CONNECT_VERSION,
    "relay-connect-package": RELAY_CONNECT_PACKAGE_NAME,
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
        <RelayConnectLogBridge />
        <div className="flex-1">{children}</div>
        <footer
          className="mt-auto border-t border-zinc-900/90 px-4 py-2 text-center"
          aria-label={`${RELAY_CONNECT_PRODUCT_NAME} SDK version`}
        >
          <p className="font-mono text-[10px] leading-relaxed tracking-wide text-zinc-600">
            <span className="text-zinc-500">{RELAY_CONNECT_PRODUCT_NAME}</span>
            <span className="mx-1 text-zinc-700" aria-hidden>
              ·
            </span>
            <span className="text-zinc-600">v{RELAY_CONNECT_VERSION}</span>
            <span className="mx-1 text-zinc-800/80" aria-hidden>
              ·
            </span>
            <span className="text-zinc-600/75">{RELAY_CONNECT_PACKAGE_NAME}</span>
          </p>
        </footer>
      </body>
    </html>
  );
}
