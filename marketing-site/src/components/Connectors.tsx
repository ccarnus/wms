/* eslint-disable @next/next/no-img-element */

// Brand hex colors sourced from each company's official brand guidelines.
// All logos are white (brightness-0 invert applied), displayed on the brand color.

const CONNECTORS = [
  {
    name: "SAP",
    category: "ERP",
    desc: "Orders, inventory sync, and fulfillment status updates.",
    logo: "/images/sap.svg",
    bg: "bg-[#0070F3]",
  },
  {
    name: "Oracle NetSuite",
    category: "ERP",
    desc: "Procurement, warehouse operations, and order management.",
    logo: "/images/oracle.svg",
    bg: "bg-[#C74634]",
  },
  {
    name: "Microsoft Dynamics",
    category: "ERP",
    desc: "Finance, supply chain, and warehouse module integration.",
    logo: "/images/microsoft.svg",
    bg: "bg-[#0078D4]",
  },
  {
    name: "Salesforce",
    category: "CRM / OMS",
    desc: "Order management, sales order sync, and customer data.",
    logo: "/images/salesforce.svg",
    bg: "bg-[#00A1E0]",
  },
  {
    name: "Shopify",
    category: "E-commerce",
    desc: "Orders, products, and inventory levels from your storefront.",
    logo: "/images/shopify.svg",
    bg: "bg-[#7AB55C]",
  },
  {
    name: "WooCommerce",
    category: "E-commerce",
    desc: "Real-time order import and stock updates for WordPress stores.",
    logo: "/images/woocommerce.svg",
    bg: "bg-[#96588A]",
  },
  {
    name: "Magento",
    category: "E-commerce",
    desc: "Adobe Commerce order sync, product catalog, and inventory.",
    logo: "/images/magento.svg",
    bg: "bg-[#EE672F]",
  },
  {
    name: "Amazon",
    category: "Marketplace",
    desc: "Amazon Seller Central orders, FBA inventory, and shipments.",
    logo: "/images/amazon.svg",
    bg: "bg-[#FF9900]",
  },
  {
    name: "QuickBooks",
    category: "Accounting",
    desc: "Accounting and inventory sync for small-to-medium operations.",
    logo: "/images/quickbooks.svg",
    bg: "bg-[#2CA01C]",
  },
  {
    name: "FedEx",
    category: "Shipping",
    desc: "Outbound shipment creation, tracking, and label generation.",
    logo: "/images/fedex.svg",
    bg: "bg-[#4D148C]",
  },
  {
    name: "DHL",
    category: "Shipping",
    desc: "International and domestic shipment dispatch and tracking.",
    logo: "/images/dhl.svg",
    bg: "bg-[#D40511]",
  },
  {
    name: "Any REST / SOAP / EDI",
    category: "Custom",
    desc: "Connect any system via JSON webhooks with flexible authentication.",
    logo: null,
    bg: "bg-slate-600",
  },
];

const WEBHOOK_ICON = (
  <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const CATEGORY_COLORS: Record<string, string> = {
  "ERP": "text-blue-400 bg-blue-500/10",
  "CRM / OMS": "text-cyan-400 bg-cyan-500/10",
  "E-commerce": "text-green-400 bg-green-500/10",
  "Marketplace": "text-orange-400 bg-orange-500/10",
  "Accounting": "text-emerald-400 bg-emerald-500/10",
  "Shipping": "text-purple-400 bg-purple-500/10",
  "Custom": "text-slate-400 bg-slate-500/10",
};

export function Connectors() {
  return (
    <section id="connectors" aria-label="Integrations" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Integrations
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Connects to the tools you already use
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">
            Bidirectional webhook integrations with leading ERPs, e-commerce
            platforms, and shipping carriers — or any REST, SOAP, or EDI
            endpoint via the generic connector.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CONNECTORS.map((connector) => (
            <div
              key={connector.name}
              className="group flex cursor-default items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              {/* Logo tile */}
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${connector.bg} shadow-sm`}
              >
                {connector.logo ? (
                  <img
                    src={connector.logo}
                    alt={`${connector.name} logo`}
                    className="h-5 w-5 brightness-0 invert"
                    width={20}
                    height={20}
                  />
                ) : (
                  WEBHOOK_ICON
                )}
              </div>

              {/* Text */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">{connector.name}</h3>
                </div>
                <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[connector.category] ?? "text-slate-400 bg-slate-100"}`}>
                  {connector.category}
                </span>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{connector.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          Don&apos;t see your system?{" "}
          <a
            href="#demo"
            className="cursor-pointer font-semibold text-brand-600 transition-colors duration-200 hover:text-brand-700"
          >
            Talk to us
          </a>{" "}
          — custom connectors are built during Enterprise onboarding.
        </p>
      </div>
    </section>
  );
}
