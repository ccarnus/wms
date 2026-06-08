"use client";

import { useState } from "react";

// FAQPage schema is already injected as JSON-LD in page.tsx.
// This component renders the visual FAQ for human readers and provides
// the semantic HTML that AI crawlers use to verify schema accuracy.

const FAQS = [
  {
    question: "How long does it take to implement Greenlights?",
    answer:
      "Greenlights goes live in 7 days. Unlike traditional WMS implementations that take 6 to 18 months, Greenlights is cloud-hosted and pre-configured. Our team handles onboarding, integration setup, and operator training within the first week as part of every plan — at no extra cost.",
  },
  {
    question: "How much does Greenlights WMS cost?",
    answer:
      "The Standard plan is $150/month and includes up to 20 users (managers and operators), every feature, cloud hosting, and dedicated onboarding. Enterprise pricing is custom and covers unlimited users, custom ERP/carrier integrations (SAP, Oracle, NetSuite, FedEx, DHL), EDI, SSO, and a 99.9% uptime SLA. No hidden fees on either plan.",
  },
  {
    question: "What integrations does Greenlights support?",
    answer:
      "Greenlights connects to SAP, Shopify, Oracle, QuickBooks, and WooCommerce out of the box. It also integrates with any system that supports REST, SOAP, or EDI endpoints via its generic webhook connector — with configurable authentication: API key, JWT bearer token, or OAuth 2.0 client credentials.",
  },
  {
    question: "Do I need an IT consultant or developer to get started?",
    answer:
      "No. Greenlights is designed to be set up by your operations team without coding. The onboarding team configures your warehouses, zones, locations, SKUs, and integrations in the first week. You describe your workflows; we configure the system.",
  },
  {
    question: "How does Greenlights improve inventory accuracy?",
    answer:
      "Every stock movement in Greenlights is processed as a database transaction with rollback protection — so partial updates are impossible. Inbound receipts, pick completions, transfers, and manual adjustments all create timestamped, auditable records in real time. The system also auto-schedules cycle-count tasks to keep accuracy above 99.9% without halting operations.",
  },
  {
    question: "Does Greenlights work for 3PL operations?",
    answer:
      "Yes. Greenlights supports multi-client warehouse operations through its multi-warehouse and multi-location inventory model. Each client's inventory can be tracked separately, and separate webhook integrations connect to each client's OMS or ERP. Role-based access control ensures operators and supervisors only see the inventory they're responsible for.",
  },
  {
    question: "Is Greenlights suitable for small warehouses?",
    answer:
      "Yes. The Standard plan was built specifically for small and mid-size operations — 10 to 200 employees — that need real WMS functionality without a six-figure implementation budget. There is no minimum order volume or warehouse size requirement.",
  },
  {
    question: "Does Greenlights require special hardware?",
    answer:
      "No. Greenlights runs in any modern web browser. Managers use it on desktop; operators use the mobile-first interface on any iOS or Android tablet or smartphone on the warehouse floor. No proprietary scanners, RF terminals, or on-premise servers are required.",
  },
  {
    question: "How does Greenlights compare to SAP EWM or Oracle WMS?",
    answer:
      "SAP EWM and Oracle WMS are enterprise-grade systems designed for large, complex operations — with implementation timelines of 12 to 24 months and annual costs starting in the six figures. Greenlights is built for teams that need core WMS capabilities (task automation, real-time inventory, operator analytics) without that level of cost and complexity. It goes live in 7 days and starts at $150/month.",
  },
  {
    question: "What happens to my data if I cancel?",
    answer:
      "Your data remains accessible for 30 days after cancellation so you can export it. We provide a full data export in CSV and JSON formats on request. After the retention period, all data is permanently deleted from our servers.",
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" aria-label="Frequently asked questions" className="bg-slate-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">FAQ</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Questions buyers actually ask
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">
            Straight answers to the questions we hear most often — no sales
            language, no deflection.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <dl className="space-y-2">
            {FAQS.map((faq, i) => (
              <div
                key={faq.question}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <dt>
                  <button
                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left transition-colors duration-200 hover:bg-slate-50"
                    aria-expanded={openIndex === i}
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {faq.question}
                    </span>
                    <ChevronIcon open={openIndex === i} />
                  </button>
                </dt>
                {openIndex === i && (
                  <dd className="border-t border-slate-100 px-6 py-5">
                    <p className="text-sm leading-relaxed text-slate-600">
                      {faq.answer}
                    </p>
                  </dd>
                )}
              </div>
            ))}
          </dl>

          <p className="mt-10 text-center text-sm text-slate-500">
            Have a question that&apos;s not listed?{" "}
            <a
              href="#demo"
              className="cursor-pointer font-semibold text-brand-600 transition-colors duration-200 hover:text-brand-700"
            >
              Ask us directly
            </a>
            {" "}— we respond within 24 hours.
          </p>
        </div>
      </div>
    </section>
  );
}
