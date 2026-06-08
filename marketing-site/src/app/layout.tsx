import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Greenlights WMS — Cloud Warehouse Management System | Live in 7 Days",
    template: "%s | Greenlights WMS",
  },
  description:
    "Greenlights is a cloud-based warehouse management system that goes live in 7 days. Automate task dispatch, track every SKU in real time, and monitor operator performance — starting at $150/month. No IT consultant required.",
  metadataBase: new URL("https://greenlights.us"),
  keywords: [
    "warehouse management system",
    "WMS software",
    "cloud WMS",
    "warehouse management software",
    "real-time inventory tracking",
    "warehouse task automation",
    "operator management software",
    "small business WMS",
    "SaaS WMS",
    "affordable warehouse management system",
    "WMS for ecommerce",
    "3PL warehouse software",
    "inventory management software",
    "warehouse automation software",
  ],
  authors: [{ name: "Greenlights", url: "https://greenlights.us" }],
  category: "Business Software",
  openGraph: {
    title: "Greenlights WMS — Cloud Warehouse Management | Live in 7 Days",
    description:
      "Cloud-based WMS that goes live in 7 days. Real-time task automation, inventory tracking, and operator analytics from $150/month. No IT consultant required.",
    url: "https://greenlights.us",
    siteName: "Greenlights",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/images/hero-warehouse.jpg",
        width: 1200,
        height: 630,
        alt: "Greenlights WMS — Cloud Warehouse Management System Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Greenlights WMS — Cloud Warehouse Management | Live in 7 Days",
    description:
      "Cloud-based WMS that goes live in 7 days. Real-time task automation, inventory tracking, operator analytics — from $150/month.",
    images: ["/images/hero-warehouse.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "https://greenlights.us",
  },
  verification: {
    google: "",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
