"use client";

import { useState } from "react";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Integrations", href: "/#connectors" },
  { label: "Architecture", href: "/#architecture" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Security", href: "/security" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2.5 cursor-pointer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Greenlights_icon.png" alt="Greenlights" className="h-7 w-auto" />
          <span className="text-sm font-bold tracking-tight text-slate-900">Greenlights</span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="cursor-pointer text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-slate-900"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#demo"
            className="cursor-pointer rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-700"
          >
            Request Demo
          </a>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 md:hidden"
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
        <div className="border-t border-slate-100 bg-white px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="cursor-pointer text-sm font-medium text-slate-600"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#demo"
              onClick={() => setMobileOpen(false)}
              className="cursor-pointer rounded-lg bg-brand-600 px-5 py-2.5 text-center text-sm font-semibold text-white"
            >
              Request Demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
