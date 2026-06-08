// Industry verticals — helps with long-tail SEO ("WMS for 3PL", "ecommerce WMS")
// and helps prospects self-identify. Pattern borrowed from Deposco/Infor.

const INDUSTRIES = [
  {
    name: "E-commerce & DTC",
    problem: "Order spikes flood your team with manual pick lists. Greenlights auto-generates and assigns pick tasks the moment an order lands — zero clipboard coordination.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  {
    name: "3PL & Fulfillment Centers",
    problem: "Managing multiple clients across shared space with separate SLAs. Greenlights' multi-location model and webhook integrations let you connect each client's OMS independently.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="1" y="3" width="15" height="13" rx="1" />
        <path d="M16 8h4l3 3v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    name: "B2B Distribution",
    problem: "Large, mixed-SKU orders with tight delivery windows. Greenlights priority-scores tasks by ship date and routes operators by zone — so your fastest pickers always work the hottest orders.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    name: "Retail & Omnichannel",
    problem: "Balancing store replenishment against online orders from the same stock pool. Greenlights holds inventory in a single ledger and allocates it to the right channel at fulfillment time.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      </svg>
    ),
  },
  {
    name: "Manufacturing & Assembly",
    problem: "Raw materials arrive, WIP moves between zones, finished goods ship — all in the same building. Greenlights tracks every movement as a transaction so nothing goes missing between stations.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93l-1.41 1.41M6.34 17.66l-1.41 1.41M2 12h2M20 12h2M6.34 6.34L4.93 4.93M17.66 17.66l1.41 1.41M12 2v2M12 20v2" />
      </svg>
    ),
  },
  {
    name: "Food & Beverage",
    problem: "FEFO rotation, lot-level traceability, and temperature-zone compliance on every shipment. Greenlights enforces movement rules and logs every touch for regulatory readiness.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
];

export function Industries() {
  return (
    <section id="industries" aria-label="Industries served" className="bg-slate-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Who It&apos;s For
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Built for the warehouses that keep commerce moving
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">
            Whether you ship 500 orders a day or 50,000, Greenlights adapts to
            your operation — not the other way around.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((industry) => (
            <article
              key={industry.name}
              className="group cursor-default rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors duration-200 group-hover:bg-brand-100">
                {industry.icon}
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                {industry.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {industry.problem}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500">
            Not sure if Greenlights fits your operation?{" "}
            <a
              href="#demo"
              className="cursor-pointer font-semibold text-brand-600 transition-colors duration-200 hover:text-brand-700"
            >
              Book a free 30-minute walkthrough
            </a>{" "}
            and we&apos;ll tell you honestly.
          </p>
        </div>
      </div>
    </section>
  );
}
