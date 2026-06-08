const LAYERS = [
  {
    num: "01",
    label: "User Interface",
    desc: "Responsive dashboards for managers, supervisors, and operators — accessible from any device, with role-based views.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    num: "02",
    label: "API & Real-Time Engine",
    desc: "Secure REST API and WebSocket layer for instant task updates, live inventory changes, and operator status broadcasts.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    num: "03",
    label: "Business Logic & Workers",
    desc: "Automated task generation, intelligent operator assignment, and background analytics processing — always running, never blocking.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
      </svg>
    ),
  },
  {
    num: "04",
    label: "Data & Storage",
    desc: "Relational database for transactional integrity, plus an in-memory store for queues and real-time event propagation.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    num: "05",
    label: "External Integrations",
    desc: "Bidirectional webhook connectors to ERPs, e-commerce platforms, and third-party logistics systems — built during onboarding.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
];

const PERF_STATS = [
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
];

const ARROW_DOWN = (
  <div className="flex justify-center py-0.5">
    <svg className="h-4 w-4 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  </div>
);

export function Architecture() {
  return (
    <section id="architecture" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Architecture
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Simple, reliable, and ready to grow with you
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">
            A clean modern architecture that keeps things simple today and
            scales with your business — no over-engineering, no bloat.
          </p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <img
            src="/images/architecture-dashboard.jpg"
            alt="Greenlights analytics dashboard"
            className="h-52 w-full object-cover"
            loading="lazy"
            width={800}
            height={208}
          />
        </div>

        <div className="mx-auto mt-12 max-w-2xl">
          <div className="flex flex-col gap-0">
            {LAYERS.map((layer, idx) => (
              <div key={layer.label}>
                <div className="group flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 px-6 py-4 transition-colors duration-200 hover:border-brand-100 hover:bg-brand-50/40">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-slate-200 transition-colors duration-200 group-hover:ring-brand-200">
                    {layer.icon}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-widest text-brand-500">
                        {layer.num}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">{layer.label}</h3>
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{layer.desc}</p>
                  </div>
                </div>
                {idx < LAYERS.length - 1 && ARROW_DOWN}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-3">
          {PERF_STATS.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center"
            >
              <p className="text-2xl font-extrabold text-brand-600">{item.stat}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
