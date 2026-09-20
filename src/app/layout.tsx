import type { Metadata, Viewport } from "next";
import { Caveat, Hanken_Grotesk, Instrument_Serif } from "next/font/google";

import { ItemDetailProvider } from "@/components/commerce/ItemDetailModal";
import { ViewerSwitcher } from "@/components/demo/ViewerSwitcher";
import { AppProvider } from "@/state/store";
import "./globals.css";

/** Three voices: display, body/UI, and the friend's handwriting. */
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const hand = Caveat({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-hand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Unwrap",
  description:
    "A private monthly recap for a close friend group. Social first, commerce second.",
};

export const viewport: Viewport = {
  themeColor: "#0B0F2A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${hand.variable}`}
    >
      <body>
        <AppProvider>
          {/* Inside the store: the modal reads the wishlist, orders and privacy. */}
          <ItemDetailProvider>
            {children}
            <ViewerSwitcher />
          </ItemDetailProvider>
        </AppProvider>
      </body>
    </html>
  );
}
