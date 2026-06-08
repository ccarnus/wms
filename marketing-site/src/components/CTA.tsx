const DEMO_POINTS = [
  {
    title: "See your warehouse configured live",
    desc: "We walk through the platform using your warehouse layout, SKU structure, and order flow — not a generic demo environment.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    title: "Map your integrations in 30 minutes",
    desc: "We identify which of your existing systems (ERP, OMS, shipping platform) connect to Greenlights and how — so you leave with a clear integration plan, not a proposal to review.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    title: "Get a straight answer on fit",
    desc: "If Greenlights isn't the right tool for your operation, we'll tell you. We'd rather send you to a competitor than start an onboarding that isn't going to work.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export function CTA() {
  return (
    <section id="demo" aria-label="Request a demo" className="relative overflow-hidden bg-slate-950 py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 bottom-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-brand-600/8 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">
            Get Started
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            30 minutes. Your warehouse layout. No slides.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-400">
            Every demo is configured for your operation before the call. Bring
            your questions about integrations, pricing, or implementation — we
            answer everything live.
          </p>

          {/* Demo value cards */}
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-3">
            {DEMO_POINTS.map((item) => (
              <div
                key={item.title}
                className="flex flex-col items-center rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/20 bg-brand-500/10 text-brand-400">
                  {item.icon}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Email capture form */}
          <div className="mx-auto mt-12 max-w-md">
            <form
              action="https://formsubmit.co/carnus.clement@gmail.com"
              method="POST"
              aria-label="Demo request form"
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input type="hidden" name="_cc" value="claytoneverhartb@gmail.com" />
              <input type="hidden" name="_subject" value="New Greenlights Demo Request" />
              <input type="hidden" name="_captcha" value="false" />
              <input type="hidden" name="_next" value="https://greenlights.us/#demo" />
              <input type="hidden" name="_template" value="table" />
              <label htmlFor="demo-email" className="sr-only">Work email address</label>
              <input
                id="demo-email"
                type="email"
                name="email"
                required
                placeholder="Your work email"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                className="cursor-pointer rounded-xl bg-brand-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-all duration-200 hover:bg-brand-500 hover:shadow-xl hover:shadow-brand-600/30"
              >
                Book a Demo
              </button>
            </form>
            <p className="mt-3 text-xs text-slate-600">
              No commitment. We&apos;ll reach out within 24 hours to schedule.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
