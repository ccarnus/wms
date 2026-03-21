import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Greenlights - Modern Warehouse Management System",
  description:
    "Real-time task orchestration, intelligent operator assignment, live inventory tracking, and seamless third-party integrations. Built for modern warehouse operations.",
  metadataBase: new URL("https://greenlights.us"),
  openGraph: {
    title: "Greenlights - Modern Warehouse Management System",
    description:
      "Real-time task orchestration, intelligent operator assignment, live inventory tracking, and seamless integrations. Live in 1 week.",
    url: "https://greenlights.us",
    siteName: "Greenlights",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/images/hero-warehouse.jpg",
        width: 800,
        height: 400,
        alt: "Greenlights WMS - Modern Warehouse Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Greenlights - Modern Warehouse Management System",
    description:
      "Real-time task orchestration, intelligent operator assignment, live inventory tracking. Live in 1 week.",
    images: ["/images/hero-warehouse.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
