// Problem-first descriptions — SEO and GEO best practice: lead with the pain,
// then state the solution. Each description is 2–3 sentences for AI scannability.

const FEATURES = [
  {
    title: "Automated Task Generation & Dispatch",
    description:
      "The moment a sales order or purchase receipt arrives, Greenlights creates the corresponding pick or putaway tasks automatically — no manual entry. Tasks are queued by priority, scored against ship dates, and dispatched to the right operator in under 100 milliseconds via WebSocket.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    details: [
      "Pick, putaway, replenishment, and cycle-count tasks",
      "Priority queue with zone-aware scheduling",
      "Full lifecycle tracking with version-controlled status",
      "Audit trail for every state transition",
    ],
  },
  {
    title: "Intelligent Operator Assignment",
    description:
      "A background worker runs every 10 seconds, matching open tasks to available operators based on zone qualification, shift status, and current workload. Managers stop dispatching by radio and start managing by exception.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    details: [
      "Zone-qualified, shift-aware matching",
      "Performance score weighting for throughput",
      "Real-time operator status: available, busy, offline",
      "Configurable assignment interval (default 10 s)",
    ],
  },
  {
    title: "Real-Time Inventory Tracking",
    description:
      "Every stock movement — inbound receipt, pick completion, transfer, or adjustment — is written as a database transaction with rollback protection. Managers see accurate, bin-level inventory counts the moment anything moves.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <path d="M12 12v4M8 12v4M16 12v4" />
      </svg>
    ),
    details: [
      "Multi-warehouse, multi-location inventory model",
      "Transactional movements with rollback protection",
      "SKU-level visibility across all locations",
      "Movement types: inbound, outbound, transfer, adjustment",
    ],
  },
  {
    title: "Labor Performance Analytics",
    description:
      "Greenlights aggregates operator KPIs every night: tasks completed, units processed, average cycle time, and utilization percentage. Managers get the data they need to coach underperformers and recognize top operators — without building reports in Excel.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
    details: [
      "Automated nightly KPI aggregation via cron worker",
      "Per-operator: tasks, units, cycle time, utilization %",
      "Zone workload distribution and bottleneck detection",
      "Manager dashboard with date-range filtering",
    ],
  },
  {
    title: "ERP & E-Commerce Integrations",
    description:
      "Greenlights sends and receives events from SAP, Oracle, Shopify, QuickBooks, WooCommerce, and any REST/SOAP/EDI endpoint via its webhook engine. Setting up a new integration takes minutes — not months and not a systems integrator.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="5" r="3" />
        <circle cx="19" cy="17" r="3" />
        <circle cx="5" cy="17" r="3" />
        <path d="M12 8v4l3.5 6M6.27 15.25L12 12M16 17H8" />
      </svg>
    ),
    details: [
      "Outbound events: task, inventory, order, operator",
      "Inbound: sales orders, products, cancellations",
      "Auth: none, API key, JWT HS256, OAuth 2.0",
      "Full event log with payload audit trail and retry",
    ],
  },
  {
    title: "Live Push Updates on Every Device",
    description:
      "Operators see new task assignments the second they're created. Managers watch the task board update live — no refresh button, no polling delay. WebSocket connections are JWT-authenticated and organized into role-based rooms.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    details: [
      "WebSocket with JWT authentication",
      "Manager room and per-operator feeds",
      "Events: assigned, updated, status changed, inventory alert",
      "Redis pub/sub for multi-instance deployments",
    ],
  },
];

const CHECK_ICON = (
  <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

export function Features() {
  return (
    <section id="features" aria-label="Product features" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            What Greenlights Does
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Core WMS capabilities — without the enterprise price tag
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">
            Every feature you need to replace manual dispatching, spreadsheet
            inventory, and end-of-month reports. Nothing you don&apos;t.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="group relative cursor-default overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-600/5"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-brand-500 to-brand-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden="true" />

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors duration-200 group-hover:bg-brand-100">
                {feature.icon}
              </div>

              <h3 className="mt-4 text-base font-bold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {feature.description}
              </p>

              <ul className="mt-4 space-y-2" aria-label={`${feature.title} details`}>
                {feature.details.map((detail) => (
                  <li key={detail} className="flex items-start gap-2 text-sm text-slate-500">
                    {CHECK_ICON}
                    {detail}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
