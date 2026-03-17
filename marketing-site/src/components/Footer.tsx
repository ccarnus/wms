const FOOTER_LINKS = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Architecture", href: "#architecture" },
    { label: "Integrations", href: "#features" },
    { label: "Security", href: "/security" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Contact", href: "#demo" },
  ],
  Resources: [
    { label: "Documentation", href: "#" },
    { label: "API Reference", href: "#" },
    { label: "Status", href: "#" },
    { label: "Changelog", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Logo.png"
                alt="Greenlights"
                className="h-6 w-auto"
              />
              <span className="text-lg font-bold tracking-tight text-gray-900">
                Green<span className="text-brand-600">lights</span>
              </span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-500">
              Simple warehouse management for small businesses. Get organized,
              stay in control, and grow with confidence.
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-gray-900">
                {category}
              </h4>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-gray-500 transition hover:text-gray-900"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-gray-100 pt-8">
          <p className="text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Greenlights. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
