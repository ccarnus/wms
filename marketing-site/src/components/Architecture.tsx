const LAYERS = [
  {
    label: "User Interface",
    color: "border-blue-200 bg-blue-50",
    textColor: "text-blue-800",
    desc: "Responsive web dashboards for managers, supervisors, and operators — accessible from any device.",
  },
  {
    label: "API & Real-Time Engine",
    color: "border-brand-200 bg-brand-50",
    textColor: "text-brand-800",
    desc: "Secure REST API and WebSocket layer for instant task updates and live inventory changes.",
  },
  {
    label: "Business Logic & Workers",
    color: "border-emerald-200 bg-emerald-50",
    textColor: "text-emerald-800",
    desc: "Automated task generation, intelligent operator assignment, and background analytics processing.",
  },
  {
    label: "Data & Storage",
    color: "border-purple-200 bg-purple-50",
    textColor: "text-purple-800",
    desc: "Relational database for transactional integrity, plus an in-memory store for queues and real-time events.",
  },
  {
    label: "External Integrations",
    color: "border-amber-200 bg-amber-50",
    textColor: "text-amber-800",
    desc: "Bidirectional webhook connectors to ERPs, e-commerce platforms, and third-party logistics systems.",
  },
];

export function Architecture() {
  return (
    <section id="architecture" className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Architecture
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Simple, reliable, and ready to grow with you
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            A clean, modern architecture that keeps things simple today and
            grows with your business. No over-engineering, no bloat.
          </p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-2xl">
          <img
            src="/images/architecture-dashboard.jpg"
            alt="Clean analytics dashboard showing business metrics"
            className="h-52 w-full object-cover"
            loading="lazy"
            width={800}
            height={208}
          />
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <div className="flex flex-col gap-3">
            {LAYERS.map((layer, idx) => (
              <div key={layer.label}>
                <div className={`rounded-xl border ${layer.color} p-6`}>
                  <h3
                    className={`text-sm font-bold uppercase tracking-wide ${layer.textColor}`}
                  >
                    {layer.label}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {layer.desc}
                  </p>
                </div>
                {idx < LAYERS.length - 1 && (
                  <div className="flex justify-center py-1">
                    <svg
                      className="h-5 w-5 text-gray-300"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            {
              stat: "< 50ms",
              label: "API response time",
              desc: "Optimized queries for sub-50ms responses",
            },
            {
              stat: "Real-time",
              label: "Event propagation",
              desc: "Instant push updates across all connected clients",
            },
            {
              stat: "Zero-downtime",
              label: "Deployments",
              desc: "Rolling updates with automated health checks",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm"
            >
              <p className="text-2xl font-extrabold text-brand-600">
                {item.stat}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {item.label}
              </p>
              <p className="mt-1 text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
