import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WMS FAQ — Warehouse Management System Questions Answered",
  description:
    "Straight answers to the most common questions about Greenlights WMS: implementation time, pricing, integrations, inventory accuracy, and how it compares to SAP EWM and Oracle WMS.",
  alternates: {
    canonical: "https://greenlights.us/faq",
  },
  openGraph: {
    title: "WMS FAQ — Warehouse Management System Questions Answered | Greenlights",
    description:
      "How long does WMS implementation take? How much does warehouse management software cost? Greenlights answers every buyer question honestly.",
    url: "https://greenlights.us/faq",
  },
};

const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://greenlights.us" },
    { "@type": "ListItem", position: 2, name: "FAQ", item: "https://greenlights.us/faq" },
  ],
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://greenlights.us/faq#faqpage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is a warehouse management system (WMS)?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A warehouse management system (WMS) is software that automates and optimizes warehouse operations including receiving, putaway, picking, packing, and shipping. A modern cloud WMS like Greenlights also provides real-time inventory tracking, automated task dispatch, operator performance analytics, and integrations with ERPs and e-commerce platforms.",
      },
    },
    {
      "@type": "Question",
      name: "What is Greenlights WMS?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Greenlights WMS is a cloud-based warehouse management system designed for small and mid-size operations (10–200 employees). It automates task dispatch, tracks inventory in real time, and provides daily operator performance dashboards — going live in 7 days at $150/month with no IT consultant required.",
      },
    },
    {
      "@type": "Question",
      name: "How long does it take to implement a WMS?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Traditional enterprise WMS implementations (SAP EWM, Oracle WMS) take 12 to 24 months. Mid-market systems typically take 3 to 6 months. Greenlights goes live in 7 days because it is cloud-hosted, pre-configured, and includes onboarding within the first week at no extra cost.",
      },
    },
    {
      "@type": "Question",
      name: "How much does a warehouse management system cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "WMS pricing varies widely. Enterprise systems like SAP EWM can cost $200,000–$1,000,000+ to implement. Mid-market systems run $2,000–$10,000/month. Greenlights Standard costs $150/month for up to 20 users — all features, cloud hosting, and onboarding included. Enterprise pricing is custom.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need a WMS if I already have an ERP?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, for most warehouses. ERP systems manage financial records, procurement, and customer orders — but they are not designed for real-time warehouse execution. A WMS provides task-level automation (pick routing, operator assignment, bin-level tracking) that ERP systems can't replicate. Greenlights connects to your ERP via webhook so both systems stay in sync.",
      },
    },
    {
      "@type": "Question",
      name: "What integrations does Greenlights support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Greenlights integrates with SAP, Oracle, Shopify, QuickBooks, and WooCommerce out of the box. Its generic webhook connector supports any REST, SOAP, or EDI endpoint with configurable authentication: API key, JWT bearer token, or OAuth 2.0 client credentials.",
      },
    },
    {
      "@type": "Question",
      name: "How does Greenlights improve inventory accuracy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Greenlights targets 99.9% inventory accuracy by recording every stock movement as a database transaction with rollback protection. Partial updates are impossible. The system also auto-schedules cycle-count tasks to catch discrepancies before they compound, without halting daily operations.",
      },
    },
    {
      "@type": "Question",
      name: "Does Greenlights work on mobile devices?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Greenlights includes a mobile-first operator interface optimized for iOS and Android tablets and smartphones. No proprietary RF scanners or hardware are required. Managers use a desktop dashboard; operators use any web browser on the warehouse floor.",
      },
    },
    {
      "@type": "Question",
      name: "What is real-time task orchestration?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Real-time task orchestration means the WMS automatically creates and assigns warehouse tasks the moment an order event arrives — without manual intervention. In Greenlights, a background worker matches each task to the best available operator every 10 seconds and pushes the assignment to the operator's device via WebSocket in under 100 milliseconds.",
      },
    },
    {
      "@type": "Question",
      name: "Does Greenlights support 3PL operations?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Greenlights' multi-warehouse and multi-location inventory model supports separate inventory pools for multiple clients. Each client's order management system connects via a separate webhook integration. Role-based access control (5 roles) ensures operators only see the inventory they're responsible for.",
      },
    },
    {
      "@type": "Question",
      name: "How does Greenlights compare to SAP EWM?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SAP EWM is built for large enterprises with complex, multi-site warehouse networks. Implementation typically takes 12–24 months and costs $200,000–$1M+ in services. Greenlights is built for small and mid-size warehouses that need core WMS functionality without the cost and complexity. It goes live in 7 days at $150/month.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a free trial for Greenlights?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Greenlights offers a free personalized demo — a 30-minute live walkthrough configured for your warehouse layout and operations. There is no self-serve free trial, as the onboarding setup makes a guided demo more useful than a blank sandbox. Request a demo at greenlights.us/#demo.",
      },
    },
  ],
};

const ALL_FAQS = [
  {
    category: "About Greenlights",
    questions: [
      {
        q: "What is a warehouse management system (WMS)?",
        a: "A warehouse management system (WMS) is software that automates and optimizes warehouse operations — receiving, putaway, picking, packing, and shipping. A modern cloud WMS like Greenlights also provides real-time inventory tracking, automated task dispatch, operator performance analytics, and integrations with ERPs and e-commerce platforms.",
      },
      {
        q: "What is Greenlights WMS?",
        a: "Greenlights is a cloud-based warehouse management system built for small and mid-size operations (10–200 employees). It automates task dispatch, tracks every SKU in real time, and gives managers daily performance dashboards — going live in 7 days at $150/month with no IT consultant required.",
      },
      {
        q: "Who is Greenlights built for?",
        a: "Greenlights is built for small and mid-size warehouses — e-commerce, 3PL, B2B distribution, retail, manufacturing, and food & beverage — that need real WMS functionality without enterprise price tags or 12-month implementation timelines.",
      },
    ],
  },
  {
    category: "Implementation & Setup",
    questions: [
      {
        q: "How long does it take to implement Greenlights?",
        a: "7 days. Greenlights is cloud-hosted and pre-configured. Your onboarding specialist handles warehouse setup, integration configuration, and operator training in the first week — included in every plan at no extra cost.",
      },
      {
        q: "How long do traditional WMS implementations take?",
        a: "Enterprise systems like SAP EWM and Oracle WMS typically take 12 to 24 months. Mid-market systems average 3 to 6 months. Greenlights is the fastest WMS on the market at 7 days — because it's cloud-native and ships preconfigured.",
      },
      {
        q: "Do I need a developer or IT consultant?",
        a: "No. Your operations team handles the onboarding with support from Greenlights specialists. No coding required. We configure your warehouses, zones, locations, SKUs, and integrations together in the first week.",
      },
      {
        q: "Does Greenlights require special hardware?",
        a: "No. Greenlights runs in any modern web browser. Operators use iOS or Android tablets and smartphones. No proprietary scanners, RF terminals, or on-premise servers are required.",
      },
    ],
  },
  {
    category: "Pricing",
    questions: [
      {
        q: "How much does Greenlights cost?",
        a: "Standard is $150/month for up to 20 users — every feature, cloud hosting, and onboarding included. Enterprise pricing is custom and adds unlimited users, custom integrations, EDI, SSO, a 99.9% uptime SLA, and a dedicated engineer.",
      },
      {
        q: "How much does a WMS typically cost?",
        a: "Enterprise WMS (SAP, Oracle) starts at $200,000 for implementation services plus annual licensing. Mid-market systems run $2,000–$10,000/month. Greenlights Standard is $150/month — transparent, flat pricing with no per-order fees.",
      },
      {
        q: "Are there any hidden fees?",
        a: "No. The monthly price covers all features, cloud hosting, updates, and support. Onboarding is included in every plan. There are no setup fees, per-order fees, or feature-tier upgrades.",
      },
      {
        q: "Can I cancel at any time?",
        a: "Yes. There is no minimum contract on the Standard plan. Cancel any time and your data is available for 30 days for export.",
      },
    ],
  },
  {
    category: "Features & Integrations",
    questions: [
      {
        q: "What ERP and e-commerce systems does Greenlights integrate with?",
        a: "Out of the box: SAP, Oracle, Shopify, QuickBooks, and WooCommerce. Greenlights also connects to any system via its generic webhook connector — REST, SOAP, or EDI — with API key, JWT, or OAuth 2.0 authentication.",
      },
      {
        q: "Do I need a WMS if I already have an ERP?",
        a: "Yes, in most cases. ERPs manage financials and procurement but are not built for real-time warehouse execution. A WMS handles pick routing, operator assignment, and bin-level inventory in ways that ERP systems can't. Greenlights connects to your ERP so both stay in sync.",
      },
      {
        q: "How does Greenlights improve inventory accuracy?",
        a: "Every stock movement is a database transaction with rollback protection. Auto-scheduled cycle-count tasks catch discrepancies before they compound. Customers target 99.9% accuracy after going live.",
      },
      {
        q: "Does Greenlights work on mobile?",
        a: "Yes. The operator interface is built mobile-first for tablets and smartphones on the warehouse floor. No special apps to install — it runs in any modern browser.",
      },
      {
        q: "Does Greenlights support 3PL operations?",
        a: "Yes. Multi-warehouse inventory model, separate webhook connections per client OMS, and role-based access control support 3PL and fulfillment center use cases out of the box.",
      },
    ],
  },
  {
    category: "Comparison",
    questions: [
      {
        q: "How does Greenlights compare to SAP EWM?",
        a: "SAP EWM targets large enterprises with multi-site warehouse networks. Implementation: 12–24 months, $200K–$1M+ in services. Greenlights targets small and mid-size warehouses: 7-day implementation, $150/month. Different tools for different scales.",
      },
      {
        q: "How does Greenlights compare to Oracle WMS Cloud?",
        a: "Oracle WMS Cloud is enterprise-grade software priced and scoped for large operations. Implementation takes 6–18 months with a systems integrator. Greenlights is self-onboarded in 7 days and designed for teams without dedicated IT departments.",
      },
      {
        q: "How does Greenlights compare to Deposco?",
        a: "Deposco is an AI-driven supply chain platform serving mid-market and enterprise customers — typically a 90-day minimum implementation. Greenlights focuses on core WMS execution (task automation, inventory tracking, operator analytics) with a 7-day implementation and transparent $150/month pricing for smaller operations.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_SCHEMA) }}
      />

      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-16 text-center">
          <a
            href="/"
            className="mb-8 inline-flex cursor-pointer items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Greenlights
          </a>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
            Straight answers to the questions warehouse operations teams ask most —
            about WMS software in general and Greenlights specifically.
          </p>
        </div>

        {/* FAQ content */}
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="space-y-16">
            {ALL_FAQS.map((section) => (
              <section key={section.category} aria-labelledby={`section-${section.category}`}>
                <h2
                  id={`section-${section.category}`}
                  className="mb-6 text-lg font-bold text-slate-900"
                >
                  {section.category}
                </h2>
                <dl className="space-y-6">
                  {section.questions.map((item) => (
                    <div key={item.q} className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5">
                      <dt className="text-sm font-semibold text-slate-900">{item.q}</dt>
                      <dd className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-16 rounded-2xl bg-slate-900 px-8 py-10 text-center">
            <h2 className="text-xl font-bold text-white">
              Have a question that&apos;s not here?
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Book a free 30-minute demo — we answer every question live, no slides.
            </p>
            <a
              href="/#demo"
              className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-all duration-200 hover:bg-brand-500"
            >
              Book a Free Demo
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
