const FOOTER_LINKS = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "Architecture", href: "/#architecture" },
    { label: "Integrations", href: "/#connectors" },
    { label: "Pricing", href: "/#pricing" },
  ],
  Company: [
    { label: "Security", href: "/security" },
    { label: "Contact", href: "/#demo" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="cursor-pointer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Greenlights_full_logo.png" alt="Greenlights" className="h-9 w-auto" />
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Enterprise-grade warehouse management for modern logistics operations.
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-slate-900">{category}</h4>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="cursor-pointer text-sm text-slate-500 transition-colors duration-200 hover:text-slate-900"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-slate-100 pt-8">
          <p className="text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Greenlights. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
