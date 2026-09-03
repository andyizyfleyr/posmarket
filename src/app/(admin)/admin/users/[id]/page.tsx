import { getUserById, getUserStores } from '@/app/actions/admin';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  User,
  Shield,
  Mail,
  Phone,
  Calendar,
  Store,
  Package,
  TrendingUp,
  Wallet
} from 'lucide-react';

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const user = await getUserById(params.id);
  if (!user) notFound();

  const userStores = await getUserStores(params.id);

  const totalTeams = userStores.length;

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm font-black text-gray-400 hover:text-[#f56b2a] transition-colors uppercase tracking-widest">
        <ChevronLeft size={18} /> Utilisateurs
      </Link>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-white text-2xl font-black shadow-lg ${user.isSuperAdmin ? 'bg-[#f56b2a] shadow-orange-100' : 'bg-gray-900'}`}>
            {user.email?.[0]?.toUpperCase() || <User size={28} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter">{user.fullName || 'Utilisateur'}</h1>
              {user.isSuperAdmin && (
                <span className="px-3 py-1 bg-orange-50 text-[#f56b2a] rounded-lg text-[9px] font-black uppercase border border-orange-100 flex items-center gap-1">
                  <Shield size={11} /> Super Admin
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="text-xs font-bold text-gray-400 lowercase flex items-center gap-1.5"><Mail size={14} className="text-orange-500" /> {user.email}</span>
              {user.phone && <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5"><Phone size={14} className="text-orange-500" /> {user.phone}</span>}
              {user.createdAt && <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5"><Calendar size={14} className="text-orange-500" /> Inscrit le {new Date(user.createdAt).toLocaleDateString('fr-FR')}</span>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {(['STARTER', 'PRO', 'ENTERPRISE'] as const).map((tier) => (
              <div key={tier} className={`p-2.5 rounded-xl border text-center ${user.subscriptionTier === tier ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest ${user.subscriptionTier === tier ? 'text-[#f56b2a]' : 'text-gray-400'}`}>{tier}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="p-3 mb-3 bg-[#f56b2a]/10 text-[#f56b2a] rounded-xl w-fit"><Store size={20} /></div>
          <p className="text-2xl font-black text-gray-900">{userStores.length}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Boutiques</p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="p-3 mb-3 bg-purple-50 text-purple-600 rounded-xl w-fit"><Wallet size={20} /></div>
          <p className="text-2xl font-black text-gray-900">{totalTeams}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Enseignes</p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="p-3 mb-3 bg-orange-50 text-orange-600 rounded-xl w-fit"><Package size={20} /></div>
          <p className="text-2xl font-black text-gray-900 uppercase">{user.subscriptionTier || 'PRO'}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Offre active</p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="p-3 mb-3 bg-green-50 text-green-600 rounded-xl w-fit"><TrendingUp size={20} /></div>
          <p className="text-2xl font-black text-gray-900 uppercase">{user.subscriptionStatus || 'ACTIVE'}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Statut offre</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-black text-gray-900 mb-4">Boutiques de l&apos;utilisateur</h3>
        {userStores.length === 0 ? (
          <p className="text-sm text-gray-400 font-bold py-6 text-center">Cet utilisateur ne possède aucune boutique</p>
        ) : (
          <div className="space-y-3">
            {userStores.map((s) => (
              <Link
                key={s.id}
                href={`/admin/stores/${s.id}`}
                className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-orange-50/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-[#f56b2a] font-black">
                    <Store size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-900 group-hover:text-[#f56b2a] transition-colors">{s.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 font-mono tracking-tight">/{s.slug}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase border ${
                  s.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                  s.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-100' :
                  s.status === 'DISABLED' ? 'bg-gray-50 text-gray-400 border-gray-100' :
                  'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}>
                  {s.status === 'PENDING' ? 'En attente' : s.status === 'REJECTED' ? 'Refusée' : s.status === 'DISABLED' ? 'Désactivée' : 'Active'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
