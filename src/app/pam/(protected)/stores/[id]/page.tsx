import { getStoreById, getUserById, getStoreOrders, getStoreProducts, getStoreReviews } from '@/app/actions/admin';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  Store,
  ShoppingBag,
  Package,
  Star,
  Mail,
  Phone,
  MapPin,
  Eye,
  Shield,
  Calendar,
  Wallet
} from 'lucide-react';
import { formatCurrency } from '@/utils';

export default async function StoreDetailPage({ params }: { params: { id: string } }) {
  const store = await getStoreById(params.id);
  if (!store) notFound();

  const [owner, orders, products, reviews] = await Promise.all([
    store.userId ? getUserById(store.userId) : Promise.resolve(null),
    getStoreOrders(params.id),
    getStoreProducts(params.id),
    getStoreReviews(params.id),
  ]);

  const totalSales = orders.reduce((acc, o) => acc + (parseFloat(o.total ?? '') || 0), 0);
  const avgRating = reviews.length ? reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length : 0;

  return (
    <div className="space-y-6">
      <Link href="/pam/stores" className="inline-flex items-center gap-2 text-sm font-black text-gray-400 hover:text-[#f56b2a] transition-colors uppercase tracking-widest">
        <ChevronLeft size={18} /> Boutiques
      </Link>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-16 h-16 bg-[#f56b2a]/10 rounded-2xl flex items-center justify-center text-[#f56b2a]">
            <Store size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter">{store.name}</h1>
            <p className="text-sm text-gray-400 font-mono tracking-tight mt-1">/{store.slug}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${
                store.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                store.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-100' :
                store.status === 'DISABLED' ? 'bg-gray-50 text-gray-400 border-gray-100' :
                'bg-emerald-50 text-emerald-600 border-emerald-100'
              }`}>
                {store.status === 'PENDING' ? 'En attente' : store.status === 'REJECTED' ? 'Refusée' : store.status === 'DISABLED' ? 'Désactivée' : 'Active'}
              </span>
              <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg text-[9px] font-black uppercase border border-purple-100">
                {store.businessType === 'food' ? 'Alimentation' : 'Shopping'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex md:flex-col">
            {store.views !== undefined && (
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-2">
                <Eye size={16} className="text-[#f56b2a]" />
                <span className="text-xs font-black text-gray-900">{store.views} <span className="text-gray-400 font-bold">vues</span></span>
              </div>
            )}
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-2">
              <Calendar size={16} className="text-[#f56b2a]" />
              <span className="text-xs font-black text-gray-900">{store.createdAt ? new Date(store.createdAt).toLocaleDateString('fr-FR') : '—'}</span>
            </div>
          </div>
        </div>

        {store.description && (
          <p className="mt-6 text-sm text-gray-600 font-medium leading-relaxed border-t border-gray-100 pt-6">{store.description}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {store.email && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <Mail size={18} className="text-[#f56b2a]" />
              <div className="min-w-0">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Email</p>
                <p className="text-xs font-black text-gray-900 truncate">{store.email}</p>
              </div>
            </div>
          )}
          {store.phone && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <Phone size={18} className="text-[#f56b2a]" />
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Téléphone</p>
                <p className="text-xs font-black text-gray-900">{store.phone}</p>
              </div>
            </div>
          )}
          {store.address && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <MapPin size={18} className="text-[#f56b2a]" />
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Adresse</p>
                <p className="text-xs font-black text-gray-900">{store.address}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="p-3 mb-3 bg-purple-50 text-purple-600 rounded-xl w-fit"><ShoppingBag size={20} /></div>
          <p className="text-2xl font-black text-gray-900">{orders.length}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Commandes</p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="p-3 mb-3 bg-orange-50 text-orange-600 rounded-xl w-fit"><Package size={20} /></div>
          <p className="text-2xl font-black text-gray-900">{products.length}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Produits</p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="p-3 mb-3 bg-green-50 text-green-600 rounded-xl w-fit"><Wallet size={20} /></div>
          <p className="text-2xl font-black text-gray-900">{formatCurrency(totalSales)}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Généré</p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="p-3 mb-3 bg-yellow-50 text-yellow-600 rounded-xl w-fit"><Star size={20} /></div>
          <p className="text-2xl font-black text-gray-900">{avgRating ? avgRating.toFixed(1) : '—'}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{reviews.length} avis</p>
        </div>
      </div>

      {owner && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-900 rounded-xl text-white flex items-center justify-center font-black">
              {owner.fullName?.[0]?.toUpperCase() || owner.email?.[0]?.toUpperCase() || 'P'}
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">{owner.fullName || 'Propriétaire'}</h3>
              <p className="text-[10px] font-bold text-gray-400 lowercase">{owner.email}</p>
            </div>
            {owner.isSuperAdmin && (
              <span className="px-2 py-0.5 bg-orange-50 text-[#f56b2a] text-[8px] font-black rounded-lg uppercase border border-orange-100 flex items-center gap-1">
                <Shield size={10} /> Super Admin
              </span>
            )}
          </div>
          <Link href={`/pam/users/${owner.id}`} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#f56b2a] hover:text-orange-600">
            Voir le profil <span aria-hidden>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
