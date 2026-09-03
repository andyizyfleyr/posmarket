import { getGlobalOrders, getOrderItems, getStoreById, getUserById } from '@/app/actions/admin';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  Wallet,
  Package,
  CreditCard,
  Banknote,
  ShoppingBag,
  User,
  Store,
  Mail,
  Calendar
} from 'lucide-react';
import { formatCurrency } from '@/utils';

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
  READY: { label: 'Prête', color: 'bg-blue-50 text-blue-600 border-blue-100' },
  COMPLETED: { label: 'Validée', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
};

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const allOrders = await getGlobalOrders(100000);
  const order = allOrders.find(o => o.id === params.id);
  if (!order) notFound();

  const [items, store] = await Promise.all([
    getOrderItems(params.id),
    order.storeId ? getStoreById(order.storeId) : Promise.resolve(null),
  ]);

  const date = order.date || order.createdAt;

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm font-black text-gray-400 hover:text-[#f56b2a] transition-colors uppercase tracking-widest">
        <ChevronLeft size={18} /> Transactions
      </Link>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-16 h-16 bg-[#f56b2a]/10 rounded-2xl flex items-center justify-center text-[#f56b2a]">
            <Wallet size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter">#{order.id.split('-')[0]?.toUpperCase()}</h1>
              {(order.status && statusLabels[order.status]) ? (
                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${statusLabels[order.status].color}`}>
                  {statusLabels[order.status].label}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase border bg-gray-50 text-gray-500 border-gray-100">{order.status || '—'}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-bold text-gray-400">
              {date && <span className="flex items-center gap-1.5"><Calendar size={14} className="text-orange-500" /> {new Date(date).toLocaleString('fr-FR')}</span>}
              {order.type && <span>Type : {order.type === 'IN_STORE' ? 'En boutique' : 'À emporter'}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</p>
            <p className="text-3xl font-black text-[#f56b2a]">{formatCurrency(parseFloat(order.total ?? '') || 0)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2"><Store size={16} className="text-[#f56b2a]" /> Boutique</h3>
          {store ? (
            <Link href={`/admin/stores/${store.id}`} className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-orange-50/30 transition-all">
              <div className="w-11 h-11 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-[#f56b2a] font-black">
                <Store size={20} />
              </div>
              <div>
                <p className="text-sm font-black text-gray-900">{store.name}</p>
                <p className="text-[10px] font-bold text-gray-400 font-mono">/{store.slug}</p>
              </div>
            </Link>
          ) : (
            <p className="text-sm text-gray-400 font-bold">Boutique inconnue</p>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2">
            <ShoppingBag size={16} className="text-[#f56b2a]" /> Paiement
          </h3>
          <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-bold flex items-center gap-2">
                {order.paymentMethod === 'CARD' ? <CreditCard size={14} /> : <Banknote size={14} />}
                Mode de paiement
              </span>
              <span className="font-black text-gray-900 uppercase">{order.paymentMethod || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-bold">Sous-total</span>
              <span className="font-black text-gray-900">{formatCurrency(parseFloat(order.subtotal ?? '') || 0)}</span>
            </div>
            {order.discountAmount && parseFloat(order.discountAmount) > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-bold">Remise {(order.promoCode ? `(${order.promoCode})` : '')}</span>
                <span className="font-black text-red-500">-{formatCurrency(parseFloat(order.discountAmount))}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
              <span className="text-gray-400 font-black">TOTAL</span>
              <span className="font-black text-[#f56b2a]">{formatCurrency(parseFloat(order.total ?? '') || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {order.buyerEmail && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2"><User size={16} className="text-[#f56b2a]" /> Client (compte)</h3>
          <div className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
            <div className="w-11 h-11 bg-[#f56b2a]/10 text-[#f56b2a] rounded-xl flex items-center justify-center">
              <Mail size={20} />
            </div>
            <p className="text-sm font-black text-gray-900 lowercase">{order.buyerEmail}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2">
          <Package size={16} className="text-[#f56b2a]" /> Articles ({items.length})
        </h3>
        <div className="space-y-3">
          {items.length === 0 && <p className="text-sm text-gray-400 font-bold py-6 text-center">Aucun article trouvé</p>}
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl border border-gray-100 flex items-center justify-center text-[#f56b2a] font-black">
                  <Package size={18} />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-900">Produit #{item.productId?.split('-')[0]?.toUpperCase() || '—'}</p>
                  <p className="text-[10px] font-bold text-gray-400">{item.quantity} × {formatCurrency(parseFloat(item.unitPrice ?? '') || 0)}</p>
                </div>
              </div>
              <p className="text-xs font-black text-gray-900">{formatCurrency(parseFloat(item.total ?? '') || 0)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
