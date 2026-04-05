'use client';

import React, { useState, useRef } from 'react';
import {
  FileText,
  Calendar,
  Filter,
  ChevronRight,
  Printer,
  Download,
  X,
  CreditCard,
  User,
  Package,
  CheckCircle2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Order, Customer, StoreSettings } from '@/types';
import { formatCurrency } from '@/utils';

interface ReportsViewProps {
  orders: Order[];
  customers: Customer[];
  storeSettings: StoreSettings;
}

const ReportsView: React.FC<ReportsViewProps> = ({ orders, customers, storeSettings }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 200] });
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Recu-${selectedOrder?.id}.pdf`);
  };

  return (
    <div className="flex-grow overflow-hidden flex flex-col p-3 md:p-8 bg-gray-50/30">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-8 gap-3 md:gap-4">
        <div>
          <h1 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight whitespace-nowrap">Historique</h1>
          <p className="text-gray-500 text-[10px] md:text-sm mt-0.5 md:mt-1 truncate">Consultez vos transactions passées.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white border border-gray-100 rounded-lg md:rounded-xl text-[10px] md:text-sm font-black text-gray-600 hover:bg-gray-50 shadow-sm whitespace-nowrap">
            <Calendar size={14} className="md:w-4 md:h-4" /> Période
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white border border-gray-100 rounded-lg md:rounded-xl text-[10px] md:text-sm font-black text-gray-600 hover:bg-gray-50 shadow-sm whitespace-nowrap">
            <Filter size={14} className="md:w-4 md:h-4" /> Filtrer
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm flex-grow overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-grow custom-scrollbar">
          {orders.length > 0 ? (
            <div className="block md:table w-full">
              <div className="hidden md:table-header-group bg-gray-50/80 backdrop-blur text-gray-400 uppercase text-[10px] font-bold tracking-widest sticky top-0 z-10">
                <div className="table-row">
                  <div className="table-cell px-6 py-4">ID Commande</div>
                  <div className="table-cell px-6 py-4">Date & Heure</div>
                  <div className="table-cell px-6 py-4">Client</div>
                  <div className="table-cell px-6 py-4">Méthode</div>
                  <div className="table-cell px-6 py-4">Articles</div>
                  <div className="table-cell px-6 py-4">Total</div>
                  <div className="table-cell px-6 py-4 text-right">Actions</div>
                </div>
              </div>
              <div className="block md:table-row-group divide-y divide-gray-100">
                {orders.map(order => (
                  <div
                    key={order.id}
                    className="block md:table-row hover:bg-orange-50/30 transition-colors group cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="block md:table-cell px-2 md:px-6 py-1.5 md:py-4">
                      <div className="flex items-center justify-between gap-2 overflow-hidden">
                        <div className="flex items-center gap-2.5 md:gap-3 min-w-0 flex-grow">
                          <div className="w-7 h-7 md:w-10 md:h-10 rounded-lg bg-orange-50 text-[#f56b2a] flex items-center justify-center flex-shrink-0">
                            <FileText size={14} className="md:w-4 md:h-4" />
                          </div>
                          <div className="min-w-0 flex flex-col">
                            <div className="flex items-center gap-1.5 md:gap-2">
                              <span className="text-[11px] md:text-sm font-black text-gray-900 truncate whitespace-nowrap">#{order.id.slice(-6).toUpperCase()}</span>
                              <span className="text-[9px] md:hidden text-gray-400 font-bold whitespace-nowrap">{new Date(order.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="flex md:hidden items-center gap-2 mt-0.5 whitespace-nowrap">
                              <span className="text-[10px] text-gray-500 font-bold truncate max-w-[70px]">
                                {order.customer?.name || 'Passage'}
                              </span>
                              <span className="text-gray-200">|</span>
                              <span className="text-[10px] font-black text-[#f56b2a]">
                                {formatCurrency(order.total)}
                              </span>
                            </div>
                          </div>
                        </div>
 
                        <div className="flex md:hidden items-center gap-1.5 flex-shrink-0">
                          <span className={`text-[7px] md:text-[8px] font-black px-1 md:px-1.5 py-0 md:py-0.5 rounded whitespace-nowrap tracking-tighter ${order.paymentMethod === 'CASH' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                            {order.paymentMethod === 'CASH' ? 'ESP' : order.paymentMethod === 'CARD' ? 'CBE' : 'VIR'}
                          </span>
                          <ChevronRight size={12} className="text-gray-300" />
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:table-cell px-6 py-4">
                      <div className="text-xs text-gray-900 font-black">{new Date(order.date).toLocaleDateString('fr-FR')}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{new Date(order.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>

                    <div className="hidden md:table-cell px-6 py-4">
                      <div className="text-sm text-gray-700 font-bold">
                        {order.customer?.name || 'Client de passage'}
                      </div>
                    </div>

                    <div className="hidden md:table-cell px-6 py-4">
                      <span className="text-[10px] font-black px-2 py-1 bg-orange-50 text-[#f56b2a] rounded-lg uppercase tracking-wider">
                        {order.paymentMethod === 'CASH' ? 'Espèces' : order.paymentMethod === 'CARD' ? 'Carte' : 'Virement'}
                      </span>
                    </div>

                    <div className="hidden md:table-cell px-6 py-4 text-xs text-gray-500 font-medium">
                      {order.items.reduce((s, i) => s + i.quantity, 0)} articles
                    </div>

                    <div className="hidden md:table-cell px-6 py-4">
                      <span className="text-sm font-black text-gray-900">{formatCurrency(order.total)}</span>
                    </div>

                    <div className="hidden md:table-cell px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 text-gray-300 hover:text-[#f56b2a] group-hover:bg-orange-50 rounded-xl transition-all"><ChevronRight size={18} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-20 gap-4">
              <FileText size={64} className="opacity-10" />
              <div className="text-center">
                <p className="text-lg font-black text-gray-900 tracking-tight">Aucune commande</p>
                <p className="text-xs mt-1 text-gray-500">Les ventes apparaîtront ici.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Détails Commande */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-3 md:px-6 py-3 md:py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-base md:text-xl font-black text-gray-900 tracking-tight whitespace-nowrap">Commande #{selectedOrder.id.slice(-6).toUpperCase()}</h2>
                <p className="text-[8px] md:text-[10px] text-gray-400 font-medium uppercase tracking-wider">{new Date(selectedOrder.date).toLocaleString('fr-FR')}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 md:p-2 hover:bg-gray-50 rounded-full">
                <X size={18} className="md:size-6" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto flex flex-col md:flex-row">
              {/* Infos Gauche */}
              <div className="flex-grow p-3 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8 mb-4 md:mb-8">
                  <div className="space-y-3 md:space-y-4">
                    <h3 className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Client</h3>
                    <div className="bg-gray-50/50 p-2.5 md:p-4 rounded-xl md:rounded-2xl border border-gray-50">
                      {selectedOrder.customer ? (
                        <div className="flex items-center gap-2.5 md:gap-3">
                          <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-2xl bg-[#f56b2a] text-white flex items-center justify-center font-black text-base shadow-lg shadow-orange-100">
                            {selectedOrder.customer.name[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-xs md:text-base text-gray-900 truncate">{selectedOrder.customer.name}</div>
                            <div className="text-[9px] md:text-xs text-gray-500 truncate">{selectedOrder.customer.email}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 md:gap-3 text-gray-400">
                          <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-2xl bg-gray-100 flex items-center justify-center"><User size={18} className="md:size-6" /></div>
                          <span className="text-xs md:text-sm font-bold italic">Passage</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3 md:space-y-4">
                    <h3 className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Paiement</h3>
                    <div className="bg-gray-50/50 p-2.5 md:p-4 rounded-xl md:rounded-2xl border border-gray-50">
                      <div className="flex items-center gap-2.5 md:gap-3">
                        <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-2xl bg-green-600 text-white flex items-center justify-center shadow-lg shadow-green-100">
                          <CreditCard size={18} className="md:size-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-gray-900 uppercase text-[9px] md:text-xs leading-tight truncate">
                            {selectedOrder.paymentMethod === 'CASH' ? 'Espèces' : selectedOrder.paymentMethod === 'CARD' ? 'Carte B.' : 'Virement'}
                          </div>
                          <div className="text-[8px] md:text-[10px] text-green-600 font-black flex items-center gap-1 uppercase tracking-wider whitespace-nowrap">
                            <CheckCircle2 size={8} className="md:size-3" /> Payé
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 md:mb-4">Articles</h3>
                <div className="space-y-2 md:space-y-3">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 md:gap-4 p-2 md:p-3 bg-white border border-gray-50 rounded-xl md:rounded-2xl shadow-sm">
                      <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl overflow-hidden border border-gray-100 flex-shrink-0">
                        <img src={item.product.image} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="text-[10px] md:text-sm font-black text-gray-900 truncate whitespace-nowrap">{item.product.name}</div>
                        <div className="text-[8px] md:text-[10px] text-gray-400 font-mono truncate">{item.product.sku}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[8px] md:text-xs font-bold text-gray-400 leading-tight">{item.quantity}{item.product.unit && item.product.unit !== 'pièce' ? ` ${item.product.unit}` : ''} x {formatCurrency(item.product.price)}</div>
                        <div className="text-[10px] md:text-sm font-black text-[#f56b2a] whitespace-nowrap">{formatCurrency(item.quantity * item.product.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reçu Droite */}
              <div className="w-full md:w-[350px] bg-gray-50/50 border-t md:border-t-0 md:border-l border-gray-100 p-4 md:p-6 flex flex-col items-center">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 md:mb-6">Aperçu du Reçu</h3>
 
                <div
                   ref={receiptRef}
                   className="bg-white p-4 md:p-6 shadow-2xl border border-gray-100 w-full text-[9pt] font-mono leading-tight rounded-sm"
                >
                  <div className="text-center mb-4 border-b border-dashed border-gray-300 pb-4">
                    <h1 className="font-black text-sm uppercase tracking-tighter">{storeSettings.name}</h1>
                    <p className="text-[7pt] text-gray-600 mt-1">{storeSettings.address}</p>
                    <p className="text-[7pt] text-gray-500 font-mono mt-0.5">{storeSettings.phone} • {storeSettings.email}</p>
                    <p className="text-[6pt] text-gray-400 mt-1 uppercase tracking-widest">NINEA: {storeSettings.ninea}</p>
                    <div className="mt-3 text-[7pt] text-gray-500">
                      <p>CMD #{selectedOrder.id}</p>
                      <p>{new Date(selectedOrder.date).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
 
                  <div className="space-y-1 mb-4">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between gap-2">
                        <span className="truncate flex-grow">{item.product.name}</span>
                        <span className="flex-shrink-0">{item.quantity}{item.product.unit && item.product.unit !== 'pièce' ? ` ${item.product.unit}` : 'x'} {formatCurrency(item.product.price)}</span>
                      </div>
                    ))}
                  </div>
 
                  <div className="border-t border-dashed border-gray-300 pt-3 space-y-1">
                    <div className="flex justify-between font-black text-base mt-2 pt-2 border-t border-gray-200 text-[#f56b2a]">
                      <span>TOTAL:</span><span>{formatCurrency(selectedOrder.total)}</span>
                    </div>
                  </div>
 
                  <div className="mt-6 text-center text-[7pt] text-gray-400 border-t border-dashed border-gray-300 pt-4">
                    <p className="font-bold">MERCI DE VOTRE VISITE !</p>
                    <p className="mt-1">pospro.example.com</p>
                  </div>
                </div>

                <div className="w-full mt-6 md:mt-8 space-y-2.5 md:space-y-3">
                  <button
                    onClick={handlePrint}
                    className="w-full py-3 md:py-4 bg-white border border-gray-100 rounded-xl md:rounded-2xl font-black text-xs md:text-base text-gray-600 flex items-center justify-center gap-2 hover:bg-gray-50 shadow-sm active:scale-95 transition-all whitespace-nowrap"
                  >
                    <Printer size={16} className="md:w-[18px] md:h-[18px]" /> Imprimer
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="w-full py-3 md:py-4 bg-[#f56b2a] text-white rounded-xl md:rounded-2xl font-black text-xs md:text-base flex items-center justify-center gap-2 hover:bg-[#d55a20] shadow-xl shadow-orange-100 active:scale-95 transition-all whitespace-nowrap"
                  >
                    <Download size={16} className="md:w-[18px] md:h-[18px]" /> Télécharger PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;

