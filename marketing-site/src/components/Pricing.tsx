const CHECK_ICON = (
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
);

const TRUST_ICON = (
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
);

const STANDARD_FEATURES = [
  "Cloud-hosted, zero infrastructure to manage",
  "Up to 20 users (managers & operators)",
  "Real-time task orchestration",
  "Live inventory tracking",
  "Labor performance analytics",
  "Webhook & REST API integrations",
  "Dedicated onboarding in 1 week",
  "Email & chat support",
];

const ENTERPRISE_FEATURES = [
  "Everything in Standard",
  "Unlimited users & warehouses",
  "Custom upstream integrations (SAP, Oracle, NetSuite, Dynamics 365)",
  "Custom downstream integrations (FedEx, UPS, DHL, 3PL providers)",
  "EDI support (X12 850/856/810 and EDIFACT)",
  "Dedicated implementation engineer",
  "Custom workflows & automation rules",
  "SSO via SAML 2.0 / OIDC",
  "99.9% uptime SLA with credits",
  "Priority support — dedicated Slack channel",
  "Extended audit logs & custom data retention",
  "On-premise or hybrid deployment option",
];

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
            Start in a week or build a fully custom integration stack.
            No hidden fees.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Standard plan */}
          <div className="flex flex-col rounded-2xl border-2 border-brand-600 bg-white p-8 shadow-xl shadow-brand-600/10 sm:p-10">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Standard</h3>
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

            <ul className="mt-8 flex-1 space-y-4">
              {STANDARD_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  {CHECK_ICON}
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

            <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                {TRUST_ICON}
                No commitment
              </span>
              <span className="flex items-center gap-1.5">
                {TRUST_ICON}
                Cancel anytime
              </span>
              <span className="flex items-center gap-1.5">
                {TRUST_ICON}
                Live in 1 week
              </span>
            </div>
          </div>

          {/* Enterprise plan */}
          <div className="flex flex-col rounded-2xl border-2 border-gray-900 bg-gray-900 p-8 shadow-xl shadow-gray-900/20 sm:p-10">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Enterprise</h3>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-200">
                Custom quote
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight text-white">
                Custom
              </span>
            </div>

            <p className="mt-2 text-sm text-gray-400">
              Tailored to your operation — integrations, scale, and SLA
              included.
            </p>

            <ul className="mt-8 flex-1 space-y-4">
              {ENTERPRISE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href="#demo"
              className="mt-10 block w-full rounded-xl bg-white px-8 py-3.5 text-center text-base font-semibold text-gray-900 shadow-lg transition hover:bg-gray-100"
            >
              Talk to Sales
            </a>

            <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                99.9% SLA
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Dedicated engineer
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Custom timeline
              </span>
            </div>
          </div>
        </div>

        {/* Integration callout */}
        <div className="mx-auto mt-12 max-w-5xl rounded-2xl border border-gray-200 bg-gray-50 px-8 py-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Need a connector that isn&apos;t listed?
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Enterprise includes custom connectors built by our team — upstream ERP, downstream
                carriers, 3PL providers, or any REST / SOAP / EDI endpoint.
              </p>
            </div>
            <a
              href="#demo"
              className="flex-shrink-0 rounded-xl border border-brand-600 px-6 py-2.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
            >
              Request a connector
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
