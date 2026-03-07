export function CTA() {
  return (
    <section id="demo" className="bg-gray-900 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Ready to modernize your warehouse?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-400">
            See FlowWMS in action with a personalized demo tailored to your
            operation. Our team will walk you through task orchestration,
            real-time tracking, and integration setup.
          </p>

          <div className="mx-auto mt-10 max-w-md">
            <form
              action="#"
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                placeholder="Enter your work email"
                className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-5 py-3.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                className="rounded-xl bg-brand-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-500"
              >
                Request Demo
              </button>
            </form>
            <p className="mt-3 text-xs text-gray-500">
              No commitment required. We&apos;ll reach out within 24 hours.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              {
                title: "Personalized walkthrough",
                desc: "See the platform configured for your warehouse layout and processes.",
              },
              {
                title: "Integration planning",
                desc: "Map out webhook connections to your existing ERP and OMS systems.",
              },
              {
                title: "ROI assessment",
                desc: "Get a clear picture of time saved and efficiency gains.",
              },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-600/20">
                  <svg
                    className="h-5 w-5 text-brand-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
