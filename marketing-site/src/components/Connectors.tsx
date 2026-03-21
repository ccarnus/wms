/* eslint-disable @next/next/no-img-element */

const CONNECTORS = [
  {
    name: "SAP",
    desc: "ERP integration for orders, inventory sync, and fulfillment updates.",
    logo: "/images/sap.svg",
    bgColor: "bg-[#0FAAFF]",
  },
  {
    name: "Shopify",
    desc: "Sync orders, products, and inventory levels with your storefront.",
    logo: "/images/shopify.svg",
    bgColor: "bg-[#7AB55C]",
  },
  {
    name: "Oracle",
    desc: "Connect to Oracle ERP Cloud for procurement and warehouse operations.",
    logo: "/images/oracle.svg",
    bgColor: "bg-[#F80000]",
  },
  {
    name: "QuickBooks",
    desc: "Accounting and inventory sync for small-to-medium operations.",
    logo: "/images/quickbooks.svg",
    bgColor: "bg-[#2CA01C]",
  },
  {
    name: "WooCommerce",
    desc: "Real-time order import and stock updates for WordPress stores.",
    logo: "/images/woocommerce.svg",
    bgColor: "bg-[#96588A]",
  },
  {
    name: "Generic Webhook",
    desc: "Connect any system via JSON webhooks with flexible authentication.",
    logo: null,
    bgColor: "bg-gray-500",
  },
];

export function Connectors() {
  return (
    <section id="connectors" className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Integrations
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Connect to the tools you already use
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Greenlights integrates with leading ERPs, e-commerce platforms, and
            any custom system via webhooks. Set up in minutes, not months.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CONNECTORS.map((connector) => (
            <div
              key={connector.name}
              className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${connector.bgColor}`}
              >
                {connector.logo ? (
                  <img
                    src={connector.logo}
                    alt={connector.name}
                    className="h-5 w-5 brightness-0 invert"
                    width={20}
                    height={20}
                  />
                ) : (
                  <svg
                    className="h-5 w-5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {connector.name}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  {connector.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Don&apos;t see your system?{" "}
            <a
              href="#demo"
              className="font-semibold text-brand-600 transition hover:text-brand-700"
            >
              Talk to us
            </a>{" "}
            &mdash; custom connectors can be built during onboarding.
          </p>
        </div>
      </div>
    </section>
  );
}
