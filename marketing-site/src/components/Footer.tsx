const FOOTER_LINKS = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "Industries", href: "/#industries" },
    { label: "Integrations", href: "/#connectors" },
    { label: "Architecture", href: "/#architecture" },
    { label: "Pricing", href: "/#pricing" },
  ],
  Resources: [
    { label: "FAQ", href: "/faq" },
    { label: "Security", href: "/security" },
  ],
  Company: [
    { label: "Request a Demo", href: "/#demo" },
    { label: "Contact Us", href: "/#demo" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-slate-950" aria-label="Site footer">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-2">
            <a href="/" className="cursor-pointer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Greenlights_full_logo.png"
                alt="Greenlights WMS"
                className="h-9 w-auto brightness-0 invert"
              />
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Cloud warehouse management system for small and mid-size operations.
              Live in 7 days. Starting at $150/month.
            </p>
            <div className="mt-6 space-y-1 text-xs text-slate-600">
              <p>
                <span className="font-semibold text-slate-400">Implementation:</span> 7 days
              </p>
              <p>
                <span className="font-semibold text-slate-400">Starting price:</span> $150/month
              </p>
              <p>
                <span className="font-semibold text-slate-400">Users included:</span> Up to 20
              </p>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-slate-300">{category}</h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="cursor-pointer text-sm text-slate-500 transition-colors duration-200 hover:text-slate-300"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} Greenlights. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <a href="/faq" className="cursor-pointer transition-colors hover:text-slate-400">FAQ</a>
            <a href="/security" className="cursor-pointer transition-colors hover:text-slate-400">Security</a>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600" />
              </span>
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
