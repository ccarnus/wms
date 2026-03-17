import type { Metadata } from "next";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";

export const metadata: Metadata = {
  title: "Security - Greenlights WMS | Enterprise-Grade Cloud Warehouse Security",
  description:
    "Learn how Greenlights WMS protects your warehouse data with enterprise-grade security: end-to-end encryption, role-based access control, SOC 2 aligned practices, and secure cloud infrastructure.",
  keywords:
    "WMS security, warehouse management security, cloud WMS data protection, secure warehouse software, RBAC warehouse, encrypted warehouse data",
};

const HERO_STATS = [
  { value: "256-bit", label: "AES encryption" },
  { value: "5", label: "Role-based access levels" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "24/7", label: "Monitoring" },
];

const SECURITY_SECTIONS = [
  {
    id: "authentication",
    icon: (
      <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: "Authentication & Identity",
    description:
      "Every request to Greenlights is authenticated using industry-standard JSON Web Tokens (JWT) with automatic expiry. Passwords are never stored in plain text \u2014 we use bcrypt hashing with 12 computational rounds, making brute-force attacks computationally infeasible.",
    features: [
      "JWT-based session tokens with 8-hour automatic expiry",
      "Bcrypt password hashing (12 rounds) \u2014 industry gold standard",
      "Forced password change on first login for new accounts",
      "Ambiguous error messages prevent username enumeration",
      "Last-login tracking for anomaly detection",
    ],
  },
  {
    id: "authorization",
    icon: (
      <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Role-Based Access Control (RBAC)",
    description:
      "Greenlights enforces the principle of least privilege with a five-tier role hierarchy. Each API endpoint and WebSocket channel is protected by middleware that verifies both authentication and authorization before any data is returned.",
    features: [
      "Five granular roles: Admin, Warehouse Manager, Supervisor, Operator, Viewer",
      "Endpoint-level permission enforcement on every API call",
      "Room-based WebSocket access \u2014 operators only see their own tasks",
      "Admin accounts protected from accidental deletion",
      "Account deactivation instantly revokes all access",
    ],
  },
  {
    id: "data-protection",
    icon: (
      <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
    title: "Data Protection & Encryption",
    description:
      "Your warehouse data is protected at every layer. All connections are encrypted in transit using TLS 1.2+, and sensitive fields are cryptographically secured at rest. Database access is strictly parameterized to eliminate injection vulnerabilities.",
    features: [
      "TLS 1.2+ encryption for all data in transit",
      "100% parameterized SQL queries \u2014 zero string concatenation",
      "Sensitive credentials stored as environment secrets, never in code",
      "Password hashes excluded from all API responses",
      "Foreign key constraints and CHECK rules enforce data integrity",
    ],
  },
  {
    id: "api-security",
    icon: (
      <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    title: "API & Integration Security",
    description:
      "Greenlights supports multiple secure integration methods for connecting your ERP, e-commerce, and logistics systems. Every inbound webhook is authenticated, and all integration events are logged for full traceability.",
    features: [
      "Four authentication methods: API Key, Basic Auth, OAuth 2.0, JWT",
      "OAuth 2.0 Client Credentials flow with short-lived access tokens",
      "Authenticated outbound webhooks with configurable headers",
      "Full event audit trail for every inbound and outbound message",
      "UUID and enum validation on all inputs prevents malformed data",
    ],
  },
  {
    id: "infrastructure",
    icon: (
      <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
      </svg>
    ),
    title: "Cloud Infrastructure & Network Isolation",
    description:
      "Greenlights runs on containerized infrastructure with strict network segmentation. Internal services like the database and message queue are never exposed to the public internet, and each microservice operates in its own isolated process.",
    features: [
      "Docker containerization with isolated internal network",
      "Database and Redis accessible only from internal services",
      "Reverse proxy (Nginx) as the single public entry point",
      "Health checks ensure service availability before routing traffic",
      "Graceful shutdown handlers prevent data loss during deployments",
    ],
  },
  {
    id: "audit",
    icon: (
      <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "Audit Logging & Traceability",
    description:
      "Every significant action in Greenlights is recorded. Task status changes, operator assignments, integration events, and user modifications all generate immutable audit records, giving you full visibility into warehouse operations.",
    features: [
      "Task status audit logs with operator attribution and timestamps",
      "Integration event logging with success/failure tracking",
      "Automatic updated_at timestamps via database triggers",
      "Optimistic locking (version field) prevents silent data overwrites",
      "User last-login tracking for security monitoring",
    ],
  },
  {
    id: "concurrency",
    icon: (
      <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
      </svg>
    ),
    title: "Concurrency & Data Integrity",
    description:
      "Warehouse environments involve many simultaneous users updating tasks and inventory. Greenlights uses optimistic locking and database-level constraints to ensure that concurrent operations never result in lost updates or corrupted data.",
    features: [
      "Version-based optimistic locking on task status transitions",
      "Database transactions with automatic rollback on failure",
      "Strict state machine for task lifecycle (no invalid transitions)",
      "CHECK constraints enforce non-negative inventory quantities",
      "Unique constraints prevent duplicate records",
    ],
  },
];

const CLOUD_BENEFITS = [
  {
    title: "Automatic Updates",
    description: "Security patches and feature updates are deployed without downtime, so your warehouse is always running the latest protected version.",
  },
  {
    title: "Geographic Redundancy",
    description: "Data is replicated across availability zones, ensuring your warehouse operations continue even if an entire data center goes offline.",
  },
  {
    title: "Scalable Performance",
    description: "Cloud infrastructure scales with your operations. Whether you run one warehouse or twenty, performance stays consistent under peak loads.",
  },
  {
    title: "Disaster Recovery",
    description: "Automated database backups and point-in-time recovery mean your data can be restored to any moment, minimizing risk from outages or errors.",
  },
  {
    title: "No On-Premise Maintenance",
    description: "Eliminate the cost and complexity of managing servers, firewalls, and VPNs. Your IT team can focus on operations instead of infrastructure.",
  },
  {
    title: "Compliance-Ready",
    description: "Cloud hosting on SOC 2-aligned infrastructure provides the foundation for meeting regulatory requirements in warehousing and logistics.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Where is my warehouse data stored?",
    answer: "Your data is stored in a PostgreSQL 16 database running on secure cloud infrastructure. All connections are encrypted, and the database is isolated from the public internet behind multiple network layers.",
  },
  {
    question: "How are passwords protected?",
    answer: "Passwords are hashed using bcrypt with 12 computational rounds before storage. We never store plain-text passwords. Even our own team cannot retrieve your password \u2014 only reset it.",
  },
  {
    question: "Can I control who sees what in the system?",
    answer: "Yes. Greenlights has five role levels (Admin, Warehouse Manager, Supervisor, Operator, Viewer), each with different permissions. Operators only see their assigned tasks, while managers get the full operational picture.",
  },
  {
    question: "How do you protect against SQL injection?",
    answer: "Every database query uses parameterized statements. We never construct SQL through string concatenation, eliminating the most common class of web application vulnerabilities.",
  },
  {
    question: "What happens if two people update the same task?",
    answer: "Greenlights uses optimistic locking with version numbers. If two users try to update the same task simultaneously, the second update is rejected and the user is prompted to refresh, preventing data conflicts.",
  },
  {
    question: "How are third-party integrations secured?",
    answer: "We support four authentication methods for integrations: API Key, Basic Auth, OAuth 2.0, and JWT. Every integration event is logged with full audit trails, and credentials are stored as encrypted environment secrets.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <Navbar />

      <main className="bg-white pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
          <div className="mx-auto max-w-7xl px-6 pb-20 pt-24 text-center sm:pt-32">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Security
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Enterprise-grade security{" "}
              <span className="text-brand-600">built in, not bolted on</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">
              Greenlights WMS is designed from the ground up to protect your
              warehouse data. From encrypted connections to role-based access
              control, every layer of the platform is built with security as a
              first-class requirement.
            </p>

            <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
              {HERO_STATS.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-brand-100 bg-white px-4 py-5 shadow-sm">
                  <p className="text-2xl font-bold text-brand-600">{stat.value}</p>
                  <p className="mt-1 text-xs font-medium text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security detail sections */}
        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              How Greenlights protects your warehouse
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
              A detailed look at the security controls embedded in every layer
              of the platform \u2014 from authentication to infrastructure.
            </p>
          </div>

          <div className="mt-16 space-y-20">
            {SECURITY_SECTIONS.map((section, index) => (
              <article
                key={section.id}
                id={section.id}
                className={`flex flex-col gap-10 lg:flex-row lg:items-start ${
                  index % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
              >
                <div className="lg:w-1/2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                      {section.icon}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {section.title}
                    </h3>
                  </div>
                  <p className="mt-4 text-base leading-relaxed text-gray-600">
                    {section.description}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 lg:w-1/2">
                  <ul className="space-y-3">
                    {section.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <svg
                          className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Cloud benefits */}
        <section className="bg-gray-50 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Why a cloud-based WMS is more secure
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
                On-premise servers require constant patching, monitoring, and
                physical security. A cloud WMS shifts that burden to specialized
                infrastructure \u2014 so your team can focus on running the warehouse.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {CLOUD_BENEFITS.map((benefit) => (
                <article
                  key={benefit.title}
                  className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
                >
                  <h3 className="text-base font-semibold text-gray-900">
                    {benefit.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {benefit.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ with schema.org structured data */}
        <section className="mx-auto max-w-3xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Security FAQ
            </h2>
            <p className="mt-4 text-base text-gray-600">
              Common questions about how Greenlights keeps your warehouse data safe.
            </p>
          </div>

          <dl className="mt-12 divide-y divide-gray-200">
            {FAQ_ITEMS.map((item) => (
              <div key={item.question} className="py-6">
                <dt className="text-base font-semibold text-gray-900">
                  {item.question}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-gray-600">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>

          {/* JSON-LD FAQ structured data for SEO */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: FAQ_ITEMS.map((item) => ({
                  "@type": "Question",
                  name: item.question,
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: item.answer,
                  },
                })),
              }),
            }}
          />
        </section>

        {/* CTA */}
        <section className="bg-brand-600 py-16">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to secure your warehouse operations?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-brand-100">
              See how Greenlights keeps your inventory, tasks, and team data
              protected \u2014 without slowing down your operations.
            </p>
            <a
              href="/#demo"
              className="mt-8 inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-brand-600 shadow-sm transition hover:bg-gray-50"
            >
              Request a Demo
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
