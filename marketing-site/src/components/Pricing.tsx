const CHECK_ICON = (
  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const CHECK_ICON_DARK = (
  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-400" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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

const TRUST_BADGE = ({ label }: { label: string }) => (
  <span className="flex items-center gap-1.5 text-xs text-slate-400">
    <svg className="h-3.5 w-3.5 text-brand-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
    {label}
  </span>
);

const ENT_TRUST_BADGE = ({ label }: { label: string }) => (
  <span className="flex items-center gap-1.5 text-xs text-slate-500">
    <svg className="h-3.5 w-3.5 text-brand-600" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
    {label}
  </span>
);

export function Pricing() {
  return (
    <section id="pricing" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">
            Start in a week or build a fully custom integration stack. No hidden fees.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Standard */}
          <div className="relative flex flex-col overflow-hidden rounded-2xl border-2 border-brand-600 bg-white p-8 shadow-2xl shadow-brand-600/10 sm:p-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 to-brand-700" />

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Standard</h3>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
                Most popular
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight text-slate-900">$150</span>
              <span className="text-lg text-slate-400">/month</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">Up to 20 users included. Billed monthly.</p>

            <ul className="mt-8 flex-1 space-y-3">
              {STANDARD_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  {CHECK_ICON}
                  <span className="text-sm text-slate-600">{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href="#demo"
              className="mt-10 block w-full cursor-pointer rounded-xl bg-brand-600 px-8 py-3.5 text-center text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition-all duration-200 hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/25"
            >
              Get Started
            </a>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
              <TRUST_BADGE label="No commitment" />
              <TRUST_BADGE label="Cancel anytime" />
              <TRUST_BADGE label="Live in 1 week" />
            </div>
          </div>

          {/* Enterprise */}
          <div className="flex flex-col rounded-2xl border-2 border-slate-900 bg-slate-900 p-8 shadow-xl shadow-slate-900/20 sm:p-10">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Enterprise</h3>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                Custom quote
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight text-white">Custom</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Tailored to your operation — integrations, scale, and SLA included.
            </p>

            <ul className="mt-8 flex-1 space-y-3">
              {ENTERPRISE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  {CHECK_ICON_DARK}
                  <span className="text-sm text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href="#demo"
              className="mt-10 block w-full cursor-pointer rounded-xl bg-white px-8 py-3.5 text-center text-base font-semibold text-slate-900 shadow-lg transition-all duration-200 hover:bg-slate-100"
            >
              Talk to Sales
            </a>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
              <ENT_TRUST_BADGE label="99.9% SLA" />
              <ENT_TRUST_BADGE label="Dedicated engineer" />
              <ENT_TRUST_BADGE label="Custom timeline" />
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <div className="flex flex-col items-start gap-4 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Need a connector that isn&apos;t listed?
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Enterprise includes custom connectors built by our team — upstream ERP, downstream
                carriers, 3PL providers, or any REST / SOAP / EDI endpoint.
              </p>
            </div>
            <a
              href="#demo"
              className="flex-shrink-0 cursor-pointer rounded-xl border border-brand-600 px-6 py-2.5 text-sm font-semibold text-brand-600 transition-colors duration-200 hover:bg-brand-50"
            >
              Request a connector
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
