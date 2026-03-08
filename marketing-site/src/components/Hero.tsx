export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/60 to-white" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,rgba(22,163,74,0.08),transparent)]" />

      <div className="mx-auto max-w-7xl px-6 pb-20 pt-24 sm:pt-32 lg:pt-40">
        <div className="mx-auto max-w-3xl text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="mb-8 flex justify-center">
            <img
              src="/Greenlights.png"
              alt="Greenlights"
              className="h-16 w-auto sm:h-20"
            />
          </div>

          <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Live in 1 week
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700">
              No commitment &mdash; cancel anytime
            </span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Warehouse operations,{" "}
            <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
              orchestrated in real time
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
            Greenlights combines intelligent task assignment, live inventory
            tracking, and operator performance analytics into a single
            platform. Get onboarded and integrated in just one week.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#demo"
              className="w-full rounded-xl bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 sm:w-auto"
            >
              Request a Demo
            </a>
            <a
              href="#pricing"
              className="w-full rounded-xl border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 sm:w-auto"
            >
              See Pricing
            </a>
          </div>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="mx-auto mt-16 max-w-3xl sm:mt-20">
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-2xl shadow-gray-900/10">
            <img
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80&auto=format&fit=crop"
              alt="Small business owner preparing packages at a fulfillment desk"
              className="h-auto w-full object-cover"
              width={800}
              height={400}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
