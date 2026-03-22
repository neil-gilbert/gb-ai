import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Playfair_Display, Source_Sans_3 } from "next/font/google";
import AuthProviders from "@/app/providers";
import "./globals.css";

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
const versionedAsset = (path: string) => `${path}?v=${encodeURIComponent(appVersion)}`;

const headingFont = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const bodyFont = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "gb-ai",
  description: "GB-focused AI hub with chat, local weather, and local news widgets",
  manifest: versionedAsset("/manifest.webmanifest"),
  icons: {
    icon: [
      { url: versionedAsset("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: versionedAsset("/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: versionedAsset("/icons/apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
    shortcut: [versionedAsset("/icons/icon-192.png")],
  },
  appleWebApp: {
    capable: true,
    title: "GB-AI",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "only light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
        <AuthProviders>{children}</AuthProviders>
      </body>
    </html>
  );
}
