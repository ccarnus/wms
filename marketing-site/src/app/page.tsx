import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Connectors } from "@/components/Connectors";
import { Architecture } from "@/components/Architecture";
import { Benefits } from "@/components/Benefits";
import { Pricing } from "@/components/Pricing";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Greenlights",
      url: "https://greenlights.us",
      logo: "https://greenlights.us/Greenlights.png",
      description:
        "Modern warehouse management system with real-time task orchestration, intelligent operator assignment, and live inventory tracking.",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        url: "https://greenlights.us/#demo",
      },
    },
    {
      "@type": "SoftwareApplication",
      name: "Greenlights WMS",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://greenlights.us",
      description:
        "Cloud-based warehouse management system featuring real-time task orchestration, intelligent operator assignment, live inventory tracking, labor analytics, and webhook integrations.",
      offers: {
        "@type": "Offer",
        price: "150",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        availability: "https://schema.org/InStock",
        description: "Up to 20 users, all features included, billed monthly",
      },
      featureList:
        "Real-time task orchestration, Intelligent operator assignment, Live inventory tracking, Labor performance analytics, Webhook integrations, WebSocket push updates, Role-based access control",
    },
  ],
};

export default function Home() {
  return (
    <main className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <Navbar />
      <Hero />
      <Features />
      <Connectors />
      <Architecture />
      <Benefits />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}
