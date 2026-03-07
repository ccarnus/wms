const BENEFITS = [
  {
    title: "Eliminate manual task dispatching",
    description:
      "The assignment worker automatically matches pending tasks to qualified, available operators every 10 seconds. No more clipboard-based dispatching or radio calls.",
    metric: "90%",
    metricLabel: "reduction in dispatch overhead",
  },
  {
    title: "Full inventory accuracy",
    description:
      "Every stock movement is transactional with rollback protection. Cycle-count tasks are scheduled automatically to maintain accuracy without disrupting operations.",
    metric: "99.9%",
    metricLabel: "inventory accuracy target",
  },
  {
    title: "Operator visibility and accountability",
    description:
      "Performance scores, utilization percentages, and task completion rates are tracked per operator. Managers see who needs coaching and who deserves recognition.",
    metric: "Real-time",
    metricLabel: "performance dashboards",
  },
  {
    title: "Connect any external system",
    description:
      "Bidirectional webhook integrations with flexible authentication mean you can connect your ERP, OMS, or shipping platform in minutes instead of months.",
    metric: "3",
    metricLabel: "auth modes supported",
  },
  {
    title: "Role-based access control",
    description:
      "Five user roles (admin, warehouse manager, supervisor, operator, viewer) with JWT-based authentication ensure the right people see the right data.",
    metric: "5",
    metricLabel: "configurable roles",
  },
  {
    title: "Zero-refresh real-time views",
    description:
      "Socket.IO push updates mean operators see new assignments instantly and managers watch dashboards update live. No polling, no stale data.",
    metric: "< 100ms",
    metricLabel: "update latency",
  },
];

export function Benefits() {
  return (
    <section id="benefits" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Benefits
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Built for the warehouse floor
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Every feature is designed to reduce friction, increase throughput,
            and give operations leaders the visibility they need.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-4">
                <span className="text-3xl font-extrabold text-brand-600">
                  {benefit.metric}
                </span>
                <span className="ml-2 text-sm font-medium text-gray-400">
                  {benefit.metricLabel}
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-900">
                {benefit.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
