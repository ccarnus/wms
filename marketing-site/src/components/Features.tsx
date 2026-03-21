const FEATURES = [
  {
    title: "Real-Time Task Orchestration",
    description:
      "Pick, putaway, replenish, and cycle-count tasks are automatically generated from order events and assigned to available operators. Optimistic locking ensures no conflicts in concurrent operations.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    details: [
      "Automatic task generation from sales orders and purchase receipts",
      "Priority-based queue with zone-aware scheduling",
      "Full lifecycle tracking: created, assigned, in-progress, paused, completed",
      "Audit trail for every status transition",
    ],
  },
  {
    title: "Intelligent Operator Assignment",
    description:
      "A background worker continuously matches available operators to pending tasks based on zone qualifications, shift schedules, and performance scores.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    details: [
      "Zone-qualified operator matching",
      "Shift-aware scheduling prevents off-hours assignments",
      "Performance score weighting for optimal throughput",
      "Real-time operator status: available, busy, offline",
    ],
  },
  {
    title: "Live Inventory Tracking",
    description:
      "Track every product across every location in real time. Inbound, outbound, transfer, and adjustment movements are processed transactionally with full referential integrity.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <path d="M12 12v4" />
        <path d="M8 12v4" />
        <path d="M16 12v4" />
      </svg>
    ),
    details: [
      "Multi-warehouse, multi-location inventory model",
      "Transactional stock movements with rollback protection",
      "SKU-level visibility across all warehouse locations",
      "Movement types: inbound, outbound, transfer, adjustment",
    ],
  },
  {
    title: "Labor Performance Analytics",
    description:
      "Daily KPI aggregation tracks tasks completed, units processed, average task time, and utilization percentage per operator. Manager dashboards surface trends and bottlenecks.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
    details: [
      "Automated nightly KPI aggregation via cron worker",
      "Operator-level tasks completed, units processed, utilization %",
      "Zone workload distribution analysis",
      "Manager dashboard with date-range filtering",
    ],
  },
  {
    title: "Webhook Integrations",
    description:
      "Connect to any ERP, OMS, or third-party system using bidirectional webhooks. One integration per connector, with configurable authentication: none, API key credentials, or JWT bearer tokens.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <circle cx="12" cy="5" r="3" />
        <circle cx="19" cy="17" r="3" />
        <circle cx="5" cy="17" r="3" />
        <path d="M12 8v4l3.5 6" />
        <path d="M6.27 15.25L12 12" />
        <path d="M16 17H8" />
      </svg>
    ),
    details: [
      "Outbound: push events on task, inventory, and order changes",
      "Inbound: receive orders, products, and cancellations via webhook",
      "Auth options: none, secret header, JWT (HS256, 12h expiry)",
      "Event log with full payload audit trail",
    ],
  },
  {
    title: "Real-Time Push Updates",
    description:
      "Socket.IO delivers instant updates to every connected client. Operators see new assignments immediately; managers watch task boards update live without refreshing.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    details: [
      "WebSocket connections with JWT authentication",
      "Role-based rooms: manager view, per-operator feeds",
      "Events: task assigned, task updated, operator status changed",
      "Redis pub/sub for horizontal scalability",
    ],
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Capabilities
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Everything you need to run a modern warehouse
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Built for growing businesses that need simple, reliable warehouse
            visibility without enterprise complexity.
          </p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="overflow-hidden rounded-xl">
            <img
              src="/images/feature-fulfillment.jpg"
              alt="Small fulfillment workspace with parcels ready to ship"
              className="h-48 w-full object-cover"
              loading="lazy"
              width={600}
              height={192}
            />
          </div>
          <div className="overflow-hidden rounded-xl">
            <img
              src="/images/feature-stockroom.jpg"
              alt="Neatly organized shelves in a small stockroom"
              className="h-48 w-full object-cover"
              loading="lazy"
              width={600}
              height={192}
            />
          </div>
          <div className="overflow-hidden rounded-xl">
            <img
              src="/images/feature-team.jpg"
              alt="Small team coordinating daily warehouse operations"
              className="h-48 w-full object-cover"
              loading="lazy"
              width={600}
              height={192}
            />
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
                {feature.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {feature.description}
              </p>
              <ul className="mt-4 space-y-2">
                {feature.details.map((detail) => (
                  <li
                    key={detail}
                    className="flex items-start gap-2 text-sm text-gray-500"
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
