import { getUserById, getUserStores } from '@/app/actions/admin';
import UserAccountEditor from '@/components/admin/UserAccountEditor';
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
  Wallet,
  Building2,
  LogIn
} from 'lucide-react';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  const userStores = await getUserStores(id);

  const totalTeams = userStores.length;

  return (
    <div className="space-y-6">
      <Link href="/pam/users" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-[#f56b2a] transition-colors uppercase tracking-widest">
        <ChevronLeft size={18} /> Utilisateurs
      </Link>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-white text-2xl font-bold shadow-lg ${user.isSuperAdmin ? 'bg-[#f56b2a] shadow-orange-100' : 'bg-gray-900'}`}>
            {user.email?.[0]?.toUpperCase() || <User size={28} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 uppercase tracking-tighter">{user.fullName || 'Utilisateur'}</h1>
              <span className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase border flex items-center gap-1 ${
                user.accountType === 'seller' || user.isSuperAdmin
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : 'bg-blue-50 text-blue-500 border-blue-100'
              }`}>
                {user.accountType === 'seller' || user.isSuperAdmin ? <Shield size={11} /> : <User size={11} />}
                {user.isSuperAdmin ? 'Super Admin' : user.accountType === 'seller' ? 'Vendeur' : 'Acheteur'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="text-xs font-semibold text-gray-400 lowercase flex items-center gap-1.5"><Mail size={14} className="text-orange-500" /> {user.email}</span>
              {user.phone && <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5"><Phone size={14} className="text-orange-500" /> {user.phone}</span>}
              {user.companyName && <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5"><Building2 size={14} className="text-orange-500" /> {user.companyName}</span>}
              {user.createdAt && <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5"><Calendar size={14} className="text-orange-500" /> Inscrit le {new Date(user.createdAt).toLocaleDateString('fr-FR')}</span>}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col items-stretch gap-2">
            <a
              href={`/api/pam/impersonate?userId=${user.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#f56b2a] to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95"
              title="Se connecter directement à ce compte sans mot de passe (nouvel onglet)"
            >
              <LogIn size={15} /> Se connecter au compte
            </a>
            <UserAccountEditor
              userId={user.id}
              fullName={user.fullName}
              email={user.email}
              phone={user.phone}
              companyName={user.companyName}
              ninea={user.ninea}
              accountType={user.accountType}
              isSuperAdmin={user.isSuperAdmin}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {(['STARTER', 'PRO', 'ENTERPRISE'] as const).map((tier) => (
              <div key={tier} className={`p-2.5 rounded-xl border text-center ${user.subscriptionTier === tier ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                <p className={`text-[9px] font-bold uppercase tracking-widest ${user.subscriptionTier === tier ? 'text-[#f56b2a]' : 'text-gray-400'}`}>{tier}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="p-3 mb-3 bg-[#f56b2a]/10 text-[#f56b2a] rounded-xl w-fit"><Store size={20} /></div>
          <p className="text-2xl font-bold text-gray-900">{userStores.length}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Boutiques</p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="p-3 mb-3 bg-purple-50 text-purple-600 rounded-xl w-fit"><Wallet size={20} /></div>
          <p className="text-2xl font-bold text-gray-900">{totalTeams}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Enseignes</p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="p-3 mb-3 bg-orange-50 text-orange-600 rounded-xl w-fit"><Package size={20} /></div>
          <p className="text-2xl font-bold text-gray-900 uppercase">{user.subscriptionTier || 'NONE'}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Offre active</p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="p-3 mb-3 bg-green-50 text-green-600 rounded-xl w-fit"><TrendingUp size={20} /></div>
          <p className="text-2xl font-bold text-gray-900 uppercase">{user.subscriptionStatus || 'NONE'}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Statut offre</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Boutiques de l&apos;utilisateur</h3>
        {userStores.length === 0 ? (
          <p className="text-sm text-gray-400 font-semibold py-6 text-center">Cet utilisateur ne possède aucune boutique</p>
        ) : (
          <div className="space-y-3">
            {userStores.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-orange-50/30 transition-all group"
              >
                <Link href={`/pam/stores/${s.id}`} className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-[#f56b2a] font-bold shrink-0">
                    <Store size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 group-hover:text-[#f56b2a] transition-colors truncate">{s.name}</p>
                    <p className="text-[10px] font-semibold text-gray-400 font-mono tracking-tight">/{s.slug}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`/api/pam/impersonate?userId=${user.id}&storeId=${s.id}&redirectTo=/dashboard`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-orange-50 text-[#f56b2a] hover:bg-[#f56b2a] hover:text-white border border-orange-200 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                    title="Ouvrir la boutique en tant que commerçant (nouvel onglet)"
                  >
                    <LogIn size={13} /> Ouvrir boutique
                  </a>
                  <Link
                    href={`/pam/stores/${s.id}`}
                    className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase border ${
                      s.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                      s.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-100' :
                      s.status === 'DISABLED' ? 'bg-gray-50 text-gray-400 border-gray-100' :
                      'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}
                  >
                    {s.status === 'PENDING' ? 'En attente' : s.status === 'REJECTED' ? 'Refusée' : s.status === 'DISABLED' ? 'Désactivée' : 'Active'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
