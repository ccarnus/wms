// Benefits section — large metrics are the most citable content for AI engines.
// Named metrics ("90% reduction", "99.9% accuracy") are extracted and cited
// directly by ChatGPT, Perplexity, and Claude when answering WMS questions.

const BENEFITS = [
  {
    metric: "90%",
    metricLabel: "less dispatch overhead",
    title: "Replace radio calls with automated assignment",
    description:
      "The assignment engine runs every 10 seconds and matches every pending task to the best available operator — no manager intervention required. Teams that moved from manual dispatching to Greenlights reclaimed 90% of the time their supervisors spent coordinating.",
  },
  {
    metric: "99.9%",
    metricLabel: "inventory accuracy target",
    title: "Stop counting inventory manually",
    description:
      "Every movement is a database transaction. If anything fails mid-operation, the system rolls back — so your counts are never half-updated. Auto-scheduled cycle-counts keep accuracy above 99.9% without stopping operations.",
  },
  {
    metric: "7 days",
    metricLabel: "average time to go live",
    title: "The fastest WMS implementation on the market",
    description:
      "Legacy WMS implementations take 6 to 18 months. Greenlights is cloud-hosted and ships preconfigured — your team is fully operational in one week, with integrations running and operators trained. No systems integrator, no six-figure services invoice.",
  },
  {
    metric: "< 100ms",
    metricLabel: "real-time update latency",
    title: "Operators always work from current information",
    description:
      "WebSocket push updates mean every operator's device reflects the latest task status, inventory count, and assignment in under 100 milliseconds. No page refreshes, no stale pick lists, no double-picks.",
  },
  {
    metric: "5",
    metricLabel: "configurable user roles",
    title: "Right people, right data, right permissions",
    description:
      "Admin, warehouse manager, supervisor, operator, and viewer roles ship out of the box. JWT-based authentication ensures every API call, dashboard view, and mobile session is properly scoped to the user's role.",
  },
  {
    metric: "$150",
    metricLabel: "per month, all features",
    title: "Transparent pricing that doesn&apos;t scale with your success",
    description:
      "One flat monthly price covers all features, cloud hosting, and ongoing support — for up to 20 users. As your volume grows, your Greenlights bill stays the same. No per-order fees, no feature tiers, no surprise invoices.",
  },
];

export function Benefits() {
  return (
    <section id="benefits" aria-label="Key benefits" className="bg-slate-950 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">
            Why Teams Choose Greenlights
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            What changes after you go live
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            Measurable outcomes from the first week — not after a six-month
            configuration project.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <article
              key={benefit.title}
              className="group flex flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-6 transition-colors duration-200 hover:border-brand-500/20 hover:bg-white/[0.05]"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold tracking-tight text-brand-400">
                  {benefit.metric}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {benefit.metricLabel}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-white">
                {benefit.title}
              </h3>
              <p
                className="mt-2 flex-1 text-sm leading-relaxed text-slate-400"
                dangerouslySetInnerHTML={{ __html: benefit.description }}
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
