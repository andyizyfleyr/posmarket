"use client";

import React from "react";
import { Link, usePathname } from "@/components/RouterPolyfill";
import {
  ArrowLeft,
  Home,
  ShoppingBag,
  Store,
  Sparkles,
  Wrench,
} from "lucide-react";

const navItems = [
  { href: "/docs/utilisation", label: "Accueil", icon: Home, color: "text-gray-600" },
  { href: "/docs/utilisation/acheteur", label: "Acheteur", icon: ShoppingBag, color: "text-orange-600" },
  { href: "/docs/utilisation/vendeur", label: "Vendeur", icon: Store, color: "text-blue-600" },
  { href: "/docs/utilisation/fonctionnalites", label: "Fonctionnalités", icon: Sparkles, color: "text-indigo-600" },
  { href: "/docs/utilisation/problemes", label: "Problèmes", icon: Wrench, color: "text-red-600" },
];

function isActive(pathname: string, href: string) {
  if (href === "/docs/utilisation") return pathname === "/docs/utilisation";
  return pathname.startsWith(href);
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-50">
      {/* Back to home */}
      <div className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#f56b2a] hover:underline"
          >
            <ArrowLeft size={14} /> Retour à l&apos;accueil
          </Link>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-6 md:py-10 flex gap-8">
        {/* Sidebar navigation - desktop */}
        <aside className="hidden md:block w-56 shrink-0">
          <nav className="sticky top-6 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 px-3">
              Guide
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? "bg-white shadow-sm border border-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-900 hover:bg-white/60"
                  }`}
                >
                  <Icon size={16} className={active ? item.color : ""} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile nav tabs */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 flex overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex flex-col items-center gap-1 px-4 py-3 text-[10px] font-black shrink-0 transition-colors ${
                  active ? "text-[#f56b2a]" : "text-gray-400"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0 pb-20 md:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
