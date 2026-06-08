"use client";

import { useState, useEffect } from "react";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Integrations", href: "/#connectors" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Security", href: "/security" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav
        className={`mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl px-5 transition-all duration-300 ${
          scrolled
            ? "border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-900/5 backdrop-blur-md"
            : "border border-white/10 bg-white/10 backdrop-blur-md"
        }`}
      >
        <a href="/" className="flex cursor-pointer items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Greenlights_icon.png" alt="Greenlights" className="h-7 w-auto" />
          <span
            className={`text-sm font-bold tracking-tight transition-colors duration-300 ${
              scrolled ? "text-slate-900" : "text-white"
            }`}
          >
            Greenlights
          </span>
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`cursor-pointer text-sm font-medium transition-colors duration-200 ${
                scrolled
                  ? "text-slate-500 hover:text-slate-900"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <a
          href="#demo"
          className="hidden cursor-pointer items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition-all duration-200 hover:bg-brand-500 hover:shadow-lg hover:shadow-brand-600/30 md:inline-flex"
        >
          Request Demo
        </a>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors duration-200 md:hidden ${
            scrolled ? "text-slate-500 hover:bg-slate-100" : "text-white/70 hover:bg-white/10"
          }`}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </nav>

      {mobileOpen && (
        <div className="mx-auto mt-2 max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex flex-col gap-1 px-4 py-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#demo"
              onClick={() => setMobileOpen(false)}
              className="mt-2 cursor-pointer rounded-xl bg-brand-600 px-5 py-3 text-center text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-700"
            >
              Request Demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
