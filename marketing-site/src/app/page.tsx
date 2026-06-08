import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Industries } from "@/components/Industries";
import { Connectors } from "@/components/Connectors";
import { Architecture } from "@/components/Architecture";
import { Benefits } from "@/components/Benefits";
import { Pricing } from "@/components/Pricing";
import { FAQ } from "@/components/FAQ";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

// ── Structured Data ──────────────────────────────────────────────────────────
// Five JSON-LD schemas for maximum SEO and GEO (generative engine) visibility.

const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://greenlights.us/#organization",
  name: "Greenlights",
  url: "https://greenlights.us",
  logo: {
    "@type": "ImageObject",
    url: "https://greenlights.us/Greenlights_full_logo.png",
    width: 300,
    height: 60,
  },
  description:
    "Greenlights is a cloud-based warehouse management system (WMS) that helps small and mid-size operations automate task dispatch, track inventory in real time, and monitor operator performance — going live in 7 days with no IT consultant required.",
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "sales",
      url: "https://greenlights.us/#demo",
      availableLanguage: "English",
    },
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: "https://greenlights.us/#demo",
      availableLanguage: "English",
    },
  ],
  sameAs: [],
};

const SOFTWARE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://greenlights.us/#software",
  name: "Greenlights WMS",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Warehouse Management System",
  operatingSystem: "Web browser (Chrome, Firefox, Safari, Edge)",
  softwareVersion: "2.0",
  url: "https://greenlights.us",
  screenshot: "https://greenlights.us/images/hero-warehouse.jpg",
  description:
    "Greenlights WMS is a cloud-based warehouse management system featuring real-time task orchestration, intelligent operator assignment, live inventory tracking across multiple warehouses and locations, daily labor performance analytics, and bidirectional webhook integrations with ERPs and e-commerce platforms. The system goes live in 7 days and requires no on-premise infrastructure or IT consultant.",
  featureList: [
    "Real-time task orchestration and automated task generation",
    "Intelligent operator assignment based on zone, skill, and workload",
    "Live inventory tracking with transactional stock movements",
    "Multi-warehouse and multi-location inventory model",
    "Labor performance analytics and daily KPI dashboards",
    "Bidirectional webhook integrations (SAP, Oracle, Shopify, WooCommerce, QuickBooks)",
    "WebSocket real-time push updates to all connected devices",
    "Role-based access control (admin, warehouse manager, supervisor, operator, viewer)",
    "Sales order management with automatic pick location resolution",
    "Purchase order management with configurable putaway strategies",
    "Mobile-first operator interface for warehouse floor use",
    "Audit trail for every inventory movement and task status change",
    "OAuth 2.0, JWT, and API key authentication for integrations",
  ],
  softwareRequirements: "Modern web browser with JavaScript enabled",
  offers: [
    {
      "@type": "Offer",
      name: "Standard",
      price: "150",
      priceCurrency: "USD",
      priceValidUntil: "2027-12-31",
      billingIncrement: "P1M",
      availability: "https://schema.org/InStock",
      description:
        "Up to 20 users (managers and operators), all features included, cloud-hosted, email and chat support, dedicated onboarding in 7 days. Billed monthly.",
    },
    {
      "@type": "Offer",
      name: "Enterprise",
      availability: "https://schema.org/InStock",
      priceSpecification: {
        "@type": "PriceSpecification",
        description:
          "Custom pricing — includes unlimited users and warehouses, custom ERP and carrier integrations (SAP, Oracle, NetSuite, Dynamics 365, FedEx, UPS, DHL), EDI support (X12 and EDIFACT), SSO via SAML 2.0/OIDC, 99.9% uptime SLA, dedicated implementation engineer, and priority support.",
      },
    },
  ],
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://greenlights.us/#website",
  name: "Greenlights WMS",
  url: "https://greenlights.us",
  description:
    "Official website of Greenlights — cloud-based warehouse management system for small and mid-size warehouses.",
  publisher: { "@id": "https://greenlights.us/#organization" },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://greenlights.us/?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://greenlights.us/#faq",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Greenlights WMS?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Greenlights WMS is a cloud-based warehouse management system designed for small and mid-size operations. It automates task dispatch, tracks inventory in real time, and provides operator performance analytics — all accessible from any web browser. It goes live in 7 days and requires no on-premise infrastructure.",
      },
    },
    {
      "@type": "Question",
      name: "How long does it take to implement Greenlights?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Greenlights goes live in 7 days. Unlike traditional WMS implementations that take 6 to 18 months, Greenlights is cloud-hosted and pre-configured. Our team handles onboarding, integration setup, and operator training within the first week as part of every plan.",
      },
    },
    {
      "@type": "Question",
      name: "How much does Greenlights WMS cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Greenlights Standard costs $150 per month and includes up to 20 users (managers and operators), all features, cloud hosting, and dedicated onboarding. Enterprise pricing is custom and includes unlimited users, custom integrations (SAP, Oracle, NetSuite, FedEx, DHL), EDI support, SSO, and a 99.9% uptime SLA.",
      },
    },
    {
      "@type": "Question",
      name: "What integrations does Greenlights support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Greenlights supports bidirectional webhook integrations with SAP, Shopify, Oracle, QuickBooks, and WooCommerce out of the box. It also connects to any system that supports REST, SOAP, or EDI endpoints via its generic webhook connector, with flexible authentication options including API keys, JWT bearer tokens, and OAuth 2.0.",
      },
    },
    {
      "@type": "Question",
      name: "Is Greenlights suitable for small warehouses?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Greenlights is specifically built for small and mid-size warehouses that need modern WMS functionality without the cost and complexity of enterprise systems. The Standard plan supports up to 20 users at $150/month, and there is no minimum warehouse size or order volume requirement.",
      },
    },
    {
      "@type": "Question",
      name: "Does Greenlights work for 3PL operations?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Greenlights supports multi-client warehouse operations through its multi-warehouse and multi-location inventory model, role-based access control, and bidirectional webhook integrations. 3PL operators can manage separate inventory pools, track movements per client, and connect to client order management systems via webhooks.",
      },
    },
    {
      "@type": "Question",
      name: "How does Greenlights improve inventory accuracy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Greenlights targets 99.9% inventory accuracy by processing every stock movement as a database transaction with rollback protection. Inbound receipts, pick completions, transfers, and manual adjustments are all recorded in real time with a full audit trail. The system also schedules cycle-count tasks automatically to maintain accuracy without disrupting daily operations.",
      },
    },
    {
      "@type": "Question",
      name: "What is real-time task orchestration in a warehouse management system?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Real-time task orchestration means the WMS automatically creates and assigns warehouse tasks — picks, putaways, replenishments — the moment an order event arrives, without manual intervention. In Greenlights, a background worker matches each task to the best available operator based on zone, skill, and current workload, and pushes the assignment to the operator's device via WebSocket in under 100 milliseconds.",
      },
    },
    {
      "@type": "Question",
      name: "Does Greenlights require special hardware or devices?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Greenlights runs entirely in a web browser and is optimized for tablets and smartphones used on the warehouse floor. Managers access dashboards on desktop; operators use a mobile-first interface on any iOS or Android device. No proprietary scanners, terminals, or on-premise servers are required.",
      },
    },
    {
      "@type": "Question",
      name: "How does Greenlights compare to SAP EWM or Oracle WMS?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SAP EWM and Oracle WMS are enterprise-grade systems designed for large, complex operations with multi-year implementation timelines (typically 12–24 months) and six-figure annual costs. Greenlights is designed for small and mid-size warehouses that need core WMS functionality — task automation, real-time inventory, operator analytics — without the implementation cost or complexity. Greenlights goes live in 7 days and starts at $150/month.",
      },
    },
  ],
};

const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://greenlights.us",
    },
  ],
};

export default function Home() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_SCHEMA) }}
      />
      <Navbar />
      <Hero />
      <Features />
      <Industries />
      <Connectors />
      <Architecture />
      <Benefits />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
