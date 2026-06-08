const STATS = [
  { value: "90%", label: "reduction in dispatch overhead" },
  { value: "99.9%", label: "inventory accuracy target" },
  { value: "< 100ms", label: "real-time update latency" },
];

export function Hero() {
  return (
    <section className="overflow-hidden bg-white pt-16">
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-24 sm:pt-32 lg:pt-40">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Live in 1 week — no commitment required
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Warehouse operations,{" "}
            <span className="text-brand-600">fully coordinated.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Greenlights combines intelligent task assignment, live inventory
            tracking, and operator performance analytics into a single platform.
            Get onboarded and integrated in just one week.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#demo"
              className="w-full cursor-pointer rounded-xl bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition-colors duration-200 hover:bg-brand-700 sm:w-auto"
            >
              Request a Demo
            </a>
            <a
              href="#pricing"
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
            >
              See Pricing
            </a>
          </div>

          <div className="mt-14 grid grid-cols-3 gap-6 border-t border-slate-100 pt-10">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-extrabold text-brand-600">{stat.value}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero-warehouse.jpg"
              alt="Modern warehouse coordinated by Greenlights"
              className="h-auto w-full object-cover"
              width={1200}
              height={600}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
