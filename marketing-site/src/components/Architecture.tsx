const LAYERS = [
  {
    label: "Client Layer",
    color: "border-blue-200 bg-blue-50",
    textColor: "text-blue-800",
    items: [
      { name: "React SPA", desc: "Manager dashboards, operator task screens, inventory views" },
      { name: "Socket.IO Client", desc: "Real-time push updates via WebSockets" },
    ],
  },
  {
    label: "API Gateway",
    color: "border-brand-200 bg-brand-50",
    textColor: "text-brand-800",
    items: [
      { name: "Nginx Reverse Proxy", desc: "Static assets, API routing, WebSocket upgrade" },
    ],
  },
  {
    label: "Application Layer",
    color: "border-emerald-200 bg-emerald-50",
    textColor: "text-emerald-800",
    items: [
      { name: "Express REST API", desc: "JWT-protected endpoints for all WMS operations" },
      { name: "Socket.IO Server", desc: "Room-based event broadcasting (manager, operator)" },
      { name: "Background Workers", desc: "Task generation, auto-assignment, labor metrics, integrations" },
    ],
  },
  {
    label: "Data Layer",
    color: "border-purple-200 bg-purple-50",
    textColor: "text-purple-800",
    items: [
      { name: "PostgreSQL 16", desc: "Warehouses, inventory, tasks, operators, audit logs" },
      { name: "Redis 7", desc: "BullMQ job queues, pub/sub for real-time event fan-out" },
    ],
  },
  {
    label: "External Systems",
    color: "border-amber-200 bg-amber-50",
    textColor: "text-amber-800",
    items: [
      { name: "Webhook Connectors", desc: "Bidirectional JSON webhooks with JWT/API-key auth" },
      { name: "ERP / OMS / 3PL", desc: "SAP, Oracle, Shopify, QuickBooks, and more" },
    ],
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
            Built for reliability and scale
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            A containerized, event-driven architecture that scales horizontally.
            Every component runs as an independent Docker service.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <div className="flex flex-col gap-3">
            {LAYERS.map((layer, idx) => (
              <div key={layer.label}>
                <div
                  className={`rounded-xl border ${layer.color} p-5`}
                >
                  <h3 className={`text-sm font-bold uppercase tracking-wide ${layer.textColor}`}>
                    {layer.label}
                  </h3>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {layer.items.map((item) => (
                      <div
                        key={item.name}
                        className="rounded-lg border border-white/60 bg-white/80 px-4 py-3 shadow-sm"
                      >
                        <p className="text-sm font-semibold text-gray-900">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                {idx < LAYERS.length - 1 && (
                  <div className="flex justify-center py-1">
                    <svg className="h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
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
              desc: "Direct PostgreSQL queries with optimized indexes",
            },
            {
              stat: "Real-time",
              label: "Event propagation",
              desc: "Redis pub/sub to Socket.IO in milliseconds",
            },
            {
              stat: "Zero-downtime",
              label: "Deployments",
              desc: "Docker Compose rolling updates with health checks",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm"
            >
              <p className="text-2xl font-extrabold text-brand-600">{item.stat}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{item.label}</p>
              <p className="mt-1 text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
