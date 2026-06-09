// Key differentiator vs competition (Deposco: 90 days, legacy WMS: 6–18 months):
// Greenlights goes live in 7 days at $150/month. Make that unmissable.

const STATS = [
  { value: "7 days", label: "Average time to go live" },
  { value: "$150/mo", label: "Starting price, all features" },
  { value: "99.9%", label: "Inventory accuracy target" },
  { value: "< 100ms", label: "Real-time update latency" },
];

const CHECK_ICON = (
  <svg className="h-3.5 w-3.5 text-brand-500" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-950 pt-24" aria-label="Hero">
      {/* Radial green glow */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-brand-600/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[400px] w-[500px] translate-x-1/3 rounded-full bg-brand-500/5 blur-3xl" />
      </div>

      {/* Dot grid overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(circle, #22c55e 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 pt-20 sm:pt-28">
        <div className="mx-auto max-w-4xl text-center">

          {/* Animated badge — speed is the hero differentiator */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-sm font-medium text-brand-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            Live in 7 days — no IT consultant, no long-term contract
          </div>

          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
            The WMS built for teams{" "}
            <span className="bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 bg-clip-text text-transparent">
              that can&apos;t wait 18 months.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            Most warehouse teams still dispatch tasks by radio, track inventory in Excel, and get performance data at the end of the month.{" "}
            <strong className="font-semibold text-slate-200">Greenlights replaces all of that in one week</strong> — with automated task assignment, real-time inventory visibility, and live operator dashboards.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#demo"
              className="group inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition-all duration-200 hover:bg-brand-500 hover:shadow-xl hover:shadow-brand-600/30 sm:w-auto"
            >
              Book a Free 30-Min Demo
              <svg
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a
              href="#pricing"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:border-white/20 hover:bg-white/10 sm:w-auto"
            >
              See Pricing
            </a>
          </div>

          {/* Trust badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
            {[
              "No credit card required",
              "Cancel anytime",
              "All features on every plan",
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                {CHECK_ICON}
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Browser-frame product screenshot */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-slate-900 shadow-2xl shadow-black/60">
            <div className="flex items-center gap-1.5 border-b border-white/5 bg-slate-800/60 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <div className="h-3 w-3 rounded-full bg-green-500/70" />
              <div className="mx-3 flex-1 rounded-md bg-slate-700/60 py-1 px-3 text-center text-xs text-slate-500">
                app.greenlights.us — Manager Dashboard
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero-dashboard.svg"
              alt="Greenlights WMS manager dashboard — live task board with pick and putaway tasks, operator status, and inventory alerts"
              className="h-auto w-full"
              width={1200}
              height={600}
            />
          </div>
        </div>
      </div>

      {/* Stats band */}
      <div className="relative bg-slate-950">
        <div className="mx-auto max-w-5xl px-6">
          <div className="overflow-hidden rounded-b-2xl border border-t-0 border-white/5">
            <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center bg-slate-950 px-6 py-8 text-center"
                >
                  <p className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="h-24 bg-gradient-to-b from-slate-950 to-white" />
      </div>
    </section>
  );
}
