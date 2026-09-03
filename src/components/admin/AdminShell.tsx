'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Shield,
  LayoutDashboard,
  Store,
  Users,
  Wallet,
  Package,
  Star,
  FileText,
  Settings,
  LogOut,
  Activity
} from 'lucide-react';

interface AdminNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: AdminNavItem[] = [
  { href: '/pam', label: 'Surveillance', icon: <LayoutDashboard size={20} /> },
  { href: '/pam/stores', label: 'Boutiques', icon: <Store size={20} /> },
  { href: '/pam/users', label: 'Utilisateurs', icon: <Users size={20} /> },
  { href: '/pam/orders', label: 'Transactions', icon: <Wallet size={20} /> },
  { href: '/pam/inventory', label: 'Inventaire', icon: <Package size={20} /> },
  { href: '/pam/reviews', label: 'Avis', icon: <Star size={20} /> },
  { href: '/pam/invoices', label: 'Factures', icon: <FileText size={20} /> },
  { href: '/pam/settings', label: 'Paramètres', icon: <Settings size={20} /> },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/pam') return pathname === '/pam';
  return pathname.startsWith(href);
}

export default function AdminShell({
  children,
  userName,
  userEmail
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    const { adminLogout } = await import('@/app/actions/admin-auth');
    await adminLogout();
    router.refresh();
  };

  const sidebar = (
    <aside className={`bg-[#0a0a0c] border-r border-[#f56b2a]/20 flex flex-col z-40 transition-all duration-300 fixed md:sticky top-0 h-screen md:h-auto w-64 md:w-64 ${sidebarOpen ? 'left-0' : '-left-64 md:left-0'}`}>
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
        <div className="w-11 h-11 bg-[#f56b2a] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-900/40">
          <Shield size={22} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-white uppercase tracking-tight leading-none">Pôle Suprême</p>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
            <Activity size={11} className="text-emerald-500" /> Système Synchronisé
          </p>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-6 py-3.5 mx-2 rounded-xl transition-all relative group ${
                active ? 'text-white bg-[#f56b2a]/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className={active ? 'text-[#f56b2a]' : 'text-slate-500 group-hover:text-slate-300'}>{item.icon}</span>
              <span className="text-[11px] font-black uppercase tracking-tighter">{item.label}</span>
              {active && <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-[#f56b2a] rounded-r-md" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-4 space-y-1">
        <div className="px-2 py-2">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider">{userName}</p>
          <p className="text-[10px] text-gray-600 lowercase font-bold">{userEmail}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-[11px] font-black uppercase tracking-tighter"
        >
          <LogOut size={18} className="text-red-400" /> Se déconnecter
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {sidebar}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-20 bg-[#0a0a0c] border-b border-[#f56b2a]/20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-[#f56b2a]"
              aria-label="Ouvrir le menu"
            >
              <Shield size={20} />
            </button>
            <span className="text-sm font-black text-white uppercase tracking-tight">Admin</span>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
