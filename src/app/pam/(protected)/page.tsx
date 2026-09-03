import { getGlobalStats, getAllStores } from '@/app/actions/admin';
import Link from 'next/link';
import {
  Store,
  Users,
  TrendingUp,
  Package,
  Shield,
  Activity,
  AlertCircle,
  ArrowRight,
  Eye
} from 'lucide-react';
import { formatCurrency } from '@/utils';

export const metadata = {
  title: 'Surveillance | Administration',
  description: 'Vue d\'ensemble du réseau POS Senegal.',
};

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  color: string;
  link?: string;
}

function StatCard({ title, value, icon, color, link }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${color} text-white shadow-lg`}>{icon}</div>
      </div>
      <div className="flex flex-col">
        <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">{title}</span>
        <span className="text-2xl font-black text-gray-900 mt-1">{value}</span>
      </div>
      {link && (
        <Link href={link} className="mt-4 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#f56b2a] hover:text-orange-600">
          Voir <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const [stats, stores] = await Promise.all([getGlobalStats(), getAllStores()]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter">Surveillance du Réseau</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Vue d&apos;ensemble globale de la plateforme</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="Boutiques" value={stats.totalStores} icon={<Store size={20} />} color="bg-[#f56b2a]" link="/pam/stores" />
        <StatCard title="Utilisateurs" value={stats.totalUsers} icon={<Users size={20} />} color="bg-purple-600" link="/pam/users" />
        <StatCard title="Ventes Globales" value={formatCurrency(stats.totalSales)} icon={<TrendingUp size={20} />} color="bg-green-600" link="/pam/orders" />
        <StatCard title="Produits" value={stats.totalProducts} icon={<Package size={20} />} color="bg-orange-600" link="/pam/inventory" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <TrendingUp className="text-[#f56b2a]" size={20} /> Dernières Boutiques
            </h3>
            <Link href="/pam/stores" className="text-[10px] font-black uppercase tracking-widest text-[#f56b2a] hover:text-orange-600">
              Tout voir
            </Link>
          </div>
          <div className="space-y-3">
            {stores.slice(0, 8).map((s) => (
              <Link
                key={s.id}
                href={`/pam/stores/${s.id}`}
                className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-orange-50/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-[#f56b2a] font-black">
                    {s.name?.[0] || 'S'}
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-900">{s.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 font-mono tracking-tight">/{s.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase border ${
                    s.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                    s.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-100' :
                    s.status === 'DISABLED' ? 'bg-gray-50 text-gray-400 border-gray-100' :
                    'bg-emerald-50 text-emerald-600 border-emerald-100'
                  }`}>
                    {s.status === 'PENDING' ? 'En attente' : s.status === 'REJECTED' ? 'Refusée' : s.status === 'DISABLED' ? 'Désactivée' : 'Active'}
                  </span>
                  <Eye size={16} className="text-gray-300 group-hover:text-[#f56b2a] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 relative overflow-hidden h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-orange-50 text-[#f56b2a] rounded-xl"><Shield size={20} /></div>
            <h3 className="text-lg font-black text-gray-900">Sentinel Système</h3>
          </div>
          {stats.pendingStores > 0 && (
            <Link href="/pam/stores" className="flex items-center gap-3 p-4 mb-4 bg-yellow-50 rounded-2xl border border-yellow-100 hover:bg-yellow-100/60 transition-all">
              <AlertCircle size={20} className="text-yellow-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-black text-yellow-700">{stats.pendingStores} boutique(s) en attente de validation</p>
                <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mt-0.5">Action requise</p>
              </div>
            </Link>
          )}
          <div className="space-y-4">
            {[
              { l: 'Base de Données', v: 'Neon PostgreSQL', s: 'green' },
              { l: 'Hébergement', v: 'Vercel', s: 'green' },
              { l: 'Stockage Fichiers', v: 'Cloudflare R2', s: 'green' },
            ].map((item, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.l}</span>
                  <div className={`w-2 h-2 rounded-full bg-${item.s}-500`} />
                </div>
                <div className="text-xs font-black text-gray-700">{item.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
