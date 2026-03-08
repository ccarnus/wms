export function Pricing() {
  return (
    <section id="pricing" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            One plan, everything included. No hidden fees, no long-term
            contracts.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-lg">
          <div className="rounded-2xl border-2 border-brand-600 bg-white p-8 shadow-xl shadow-brand-600/10 sm:p-10">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Greenlights</h3>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                Most popular
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight text-gray-900">
                $150
              </span>
              <span className="text-lg text-gray-500">/month</span>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Up to 20 users included. Billed monthly.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                "Full WMS platform access",
                "Up to 20 users (managers & operators)",
                "Real-time task orchestration",
                "Live inventory tracking",
                "Labor performance analytics",
                "Unlimited webhook integrations",
                "Dedicated onboarding in 1 week",
                "Email & chat support",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href="#demo"
              className="mt-10 block w-full rounded-xl bg-brand-600 px-8 py-3.5 text-center text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
            >
              Get Started
            </a>

            <div className="mt-6 flex flex-col items-center gap-2">
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  No commitment
                </span>
                <span className="flex items-center gap-1.5">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Cancel anytime
                </span>
                <span className="flex items-center gap-1.5">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Live in 1 week
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
