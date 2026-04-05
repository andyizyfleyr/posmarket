'use client';
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/supabase';
import { useRouter } from 'next/navigation';
import {
    FileText,
    Plus,
    Search,
    Filter,
    X,
    Download,
    Printer,
    ChevronRight,
    CheckCircle2,
    Clock,
    Send,
    Trash2,
    Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Invoice, InvoiceItem, StoreSettings, Customer, Product, StaffPermissions, StaffRole, NotificationType } from '@/types';
import { formatCurrency } from '@/utils';
import { fetchInvoiceItems } from '../hooks/useSupabaseData';

interface InvoicesViewProps {
    invoices: Invoice[];
    onSaveInvoice?: (invoice: Invoice) => Promise<void>;
    customers: Customer[];
    products: Product[];
    storeSettings: StoreSettings;
    permissions: StaffPermissions;
    notify?: (message: string, type: NotificationType, title?: string) => void;
    userRole?: StaffRole;
}

const InvoicesView: React.FC<InvoicesViewProps> = ({ invoices, onSaveInvoice, customers, products, storeSettings, permissions, notify, userRole }) => {
    const router = useRouter();
    const isSeller = userRole === 'SELLER';
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<InvoiceItem[]>([]);
    const [loadingInvoiceItems, setLoadingInvoiceItems] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const invoiceRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedInvoice) {
            setLoadingInvoiceItems(true);
            setSelectedInvoiceItems(selectedInvoice.items || []);
            fetchInvoiceItems(selectedInvoice.id).then(items => {
                setSelectedInvoiceItems(items);
                setLoadingInvoiceItems(false);
            });
        }
        return () => setSelectedInvoiceItems([]);
    }, [selectedInvoice?.id]);

    // Create Form State
    const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +14 days default
        items: [],
        status: 'DRAFT'
    });
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [step, setStep] = useState(1);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PAID': return 'bg-green-100 text-green-700 border-green-200';
            case 'SENT': return 'bg-orange-100 text-[#d55a20] border-orange-200';
            case 'DRAFT': return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'OVERDUE': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PAID': return <CheckCircle2 size={12} className="mr-1" />;
            case 'SENT': return <Send size={12} className="mr-1" />;
            case 'OVERDUE': return <Clock size={12} className="mr-1" />;
            default: return <FileText size={12} className="mr-1" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PAID': return 'Payée';
            case 'SENT': return 'Envoyée';
            case 'OVERDUE': return 'En retard';
            case 'DRAFT': return 'Brouillon';
            default: return status;
        }
    };

    const handlePrint = () => window.print();

    const handleDownloadPDF = async () => {
        if (!invoiceRef.current) return;
        const canvas = await html2canvas(invoiceRef.current, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        // A4 Portrait
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Facture-${selectedInvoice?.invoiceNumber || selectedInvoice?.id}.pdf`);
    };

    const handleAddItem = () => {
        if (!selectedProduct) return;
        const product = products.find(p => p.id === selectedProduct);
        if (!product) return;

        const newItem: InvoiceItem = {
            description: product.name,
            quantity: quantity,
            unitPrice: product.price,
            total: product.price * quantity
        };

        setNewInvoice(prev => {
            const updatedItems = [...(prev.items || []), newItem];
            return { ...prev, items: updatedItems };
        });

        setSelectedProduct('');
        setQuantity(1);
    };

    const handleRemoveItem = (index: number) => {
        setNewInvoice(prev => {
            const updatedItems = [...(prev.items || [])];
            updatedItems.splice(index, 1);
            return { ...prev, items: updatedItems };
        });
    };

    const handleSaveInvoice = async () => {
        const items = newInvoice.items || [];
        if (!newInvoice.customerName) {
            if (notify) notify("Entrez le nom du client.", 'warning');
            setStep(1);
            return;
        }
        if (items.length === 0) {
            if (notify) notify("Ajoutez au moins un article.", 'warning');
            setStep(3);
            return;
        }

        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const total = subtotal;

        const invoiceNumber = `FAC-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${String((invoices || []).length + 1).padStart(4, '0')}`;

        const invoice: Invoice = {
            id: `temp-${Date.now()}`,
            invoiceNumber,
            date: newInvoice.date || new Date().toISOString(),
            dueDate: newInvoice.dueDate || new Date().toISOString(),
            items,
            subtotal,
            total,
            status: (newInvoice.status as any) || 'DRAFT',
            customerName: newInvoice.customerName || 'Client',
            customerEmail: newInvoice.customerEmail || '',
            customerAddress: newInvoice.customerAddress || '',
            notes: newInvoice.notes
        };

        try {
            if (onSaveInvoice) {
                await onSaveInvoice(invoice);
            } else {
                const { error } = await supabase.from('invoices').upsert({
                    ...invoice,
                    store_id: (invoices?.[0] as any)?.store_id
                });
                if (error) throw error;
                router.refresh();
            }
            setIsCreating(false);
            setStep(1);
            // Reset form
            setNewInvoice({
                date: new Date().toISOString().split('T')[0],
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                items: [],
                status: 'DRAFT'
            });
        } catch (err) {
            console.error(err);
            if (notify) notify("Erreur lors de l'enregistrement de la facture", 'error');
        }
    };

    // Compute form totals
    const formSubtotal = (newInvoice.items || []).reduce((sum, item) => sum + item.total, 0);
    const formTotal = formSubtotal;

    return (
        <div className="flex-grow overflow-hidden flex flex-col p-4 md:p-8 bg-gray-50/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Factures</h1>
                    <p className="text-gray-500 text-xs md:text-sm mt-1">Gérez et générez vos factures professionnelles.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="hidden md:flex relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            className="pl-9 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm font-medium focus:outline-none focus:border-[#f56b2a] focus:ring-2 focus:ring-orange-100 transition-all shadow-sm w-48"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs md:text-sm font-black text-gray-600 hover:bg-gray-50 shadow-sm">
                        <Filter size={16} /> <span className="hidden sm:inline">Filtrer</span>
                    </button>
                    {permissions.canManageInvoices && (
                        <button
                            onClick={() => {
                                setIsCreating(true);
                                setStep(1);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-[#f56b2a] rounded-xl text-xs md:text-sm font-black text-white hover:bg-[#d55a20] shadow-lg shadow-orange-100 active:scale-95 transition-all"
                        >
                            <Plus size={16} /> Nouveau
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-3xl shadow-sm flex-grow overflow-hidden flex flex-col">
                <div className="overflow-y-auto flex-grow custom-scrollbar">
                    {invoices && invoices.length > 0 ? (
                        <div className="block md:table w-full">
                            <div className="hidden md:table-header-group bg-gray-50/80 backdrop-blur text-gray-400 uppercase text-[10px] font-bold tracking-widest sticky top-0 z-10">
                                <div className="table-row">
                                    <div className="table-cell px-6 py-4">Numéro</div>
                                    <div className="table-cell px-6 py-4">Date</div>
                                    <div className="table-cell px-6 py-4">Client</div>
                                    <div className="table-cell px-6 py-4">Statut</div>
                                    <div className="table-cell px-6 py-4">Montant</div>
                                    <div className="table-cell px-6 py-4 text-right">Actions</div>
                                </div>
                            </div>
                            <div className="block md:table-row-group divide-y divide-gray-100">
                                {invoices.map(invoice => (
                                    <div
                                        key={invoice.id}
                                        className="block md:table-row hover:bg-orange-50/30 transition-colors group cursor-pointer"
                                        onClick={() => setSelectedInvoice(invoice)}
                                    >
                                        <div className="block md:table-cell px-3 md:px-6 py-2 md:py-4">
                                            <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                <div className="flex items-center gap-3 min-w-0 flex-grow">
                                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-orange-50 text-[#f56b2a] flex items-center justify-center flex-shrink-0">
                                                        <FileText size={16} />
                                                    </div>
                                                    <div className="min-w-0 flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] md:text-sm font-black text-gray-900 truncate">{invoice.invoiceNumber}</span>
                                                            <span className="text-[9px] md:hidden text-gray-400 font-bold">{new Date(invoice.date).toLocaleDateString('fr-FR')}</span>
                                                        </div>
                                                        <div className="flex md:hidden items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] text-gray-500 font-bold truncate max-w-[100px]">{invoice.customerName || 'Client'}</span>
                                                            <span className="text-gray-200">|</span>
                                                            <span className="text-[10px] font-black text-gray-900">{formatCurrency(invoice.total)}</span>
                                                        </div>
                                                        <div className="hidden md:block text-[10px] text-gray-400 font-medium">Échéance: {new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</div>
                                                    </div>
                                                </div>

                                                <div className="flex md:hidden items-center gap-2 flex-shrink-0">
                                                    <span className={`p-1 rounded-lg border ${getStatusColor(invoice.status)}`}>
                                                        {getStatusIcon(invoice.status)}
                                                    </span>
                                                    <ChevronRight size={14} className="text-gray-300" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="hidden md:table-cell px-6 py-4">
                                            <div className="text-xs text-gray-900 font-bold">{new Date(invoice.date).toLocaleDateString('fr-FR')}</div>
                                            <div className="text-[10px] text-gray-400 font-medium">Échéance: {new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</div>
                                        </div>
                                        <div className="hidden md:table-cell px-6 py-4">
                                            <div className="text-sm text-gray-700 font-bold">{invoice.customerName || 'Client inconnu'}</div>
                                        </div>
                                        <div className="hidden md:table-cell px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getStatusColor(invoice.status)}`}>
                                                {getStatusIcon(invoice.status)}
                                                {getStatusLabel(invoice.status)}
                                            </span>
                                        </div>
                                        <div className="hidden md:table-cell px-6 py-4">
                                            <span className="text-sm font-black text-gray-900">{formatCurrency(invoice.total)}</span>
                                        </div>
                                        <div className="hidden md:table-cell px-6 py-4 text-right">
                                            <button className="p-2 text-gray-300 hover:text-[#f56b2a] group-hover:bg-orange-50 rounded-xl transition-all"><ChevronRight size={18} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-20 gap-4">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                                <FileText size={40} className="text-gray-300" />
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-black text-gray-900 tracking-tight">Aucune facture</p>
                                <p className="text-xs mt-1 text-gray-500">Créez votre première facture pour commencer.</p>
                            </div>
                            {permissions.canManageInvoices && (
                                <button
                                    onClick={() => {
                                        setIsCreating(true);
                                        setStep(1);
                                    }}
                                    className="mt-2 px-6 py-3 bg-[#f56b2a] text-white rounded-xl font-bold flex items-center gap-2 hover:bg-[#d55a20] transition"
                                >
                                    <Plus size={18} /> Créer une facture
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Création Facture */}
            {isCreating && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]">
                        <div className="px-6 py-4 md:py-6 border-b border-gray-100 bg-white sticky top-0 z-10">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                    <FileText className="text-[#f56b2a] size-5 md:size-6" /> Nouvelle Facture
                                </h2>
                                <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-50 rounded-full">
                                    <X size={20} className="md:size-6" />
                                </button>
                            </div>

                            {/* Step Indicator */}
                            <div className="flex items-center justify-between relative px-2">
                                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 z-0"></div>
                                <div className={`absolute top-1/2 left-0 h-0.5 bg-[#f56b2a] -translate-y-1/2 z-0 transition-all duration-500`} style={{ width: `${((step - 1) / 2) * 100}%` }}></div>

                                {[1, 2, 3].map((s) => (
                                    <div key={s} className="relative z-10 flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${step >= s ? 'bg-[#f56b2a] text-white' : 'bg-gray-100 text-gray-400'
                                            }`}>
                                            {step > s ? '✓' : s}
                                        </div>
                                        <span className={`text-[8px] font-black uppercase tracking-widest mt-2 ${step >= s ? 'text-[#f56b2a]' : 'text-gray-300'}`}>
                                            {s === 1 ? 'Client' : s === 2 ? 'Dates' : 'Articles'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto p-6 md:p-8 custom-scrollbar">
                            {step === 1 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Informations Client</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 whitespace-nowrap">Nom complet ou Société</label>
                                            <input
                                                type="text"
                                                value={newInvoice.customerName || ''}
                                                onChange={e => setNewInvoice({ ...newInvoice, customerName: e.target.value })}
                                                placeholder="Ex: Jean Dupont"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#f56b2a] focus:bg-white transition-all shadow-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 whitespace-nowrap">Email</label>
                                                <input
                                                    type="email"
                                                    value={newInvoice.customerEmail || ''}
                                                    onChange={e => setNewInvoice({ ...newInvoice, customerEmail: e.target.value })}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#f56b2a] focus:bg-white transition-all shadow-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 whitespace-nowrap">Adresse</label>
                                                <input
                                                    type="text"
                                                    value={newInvoice.customerAddress || ''}
                                                    onChange={e => setNewInvoice({ ...newInvoice, customerAddress: e.target.value })}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#f56b2a] focus:bg-white transition-all shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Détails & Échéances</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 whitespace-nowrap">Date d'émission</label>
                                                <input
                                                    type="date"
                                                    value={newInvoice.date}
                                                    onChange={e => setNewInvoice({ ...newInvoice, date: e.target.value })}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#f56b2a] focus:bg-white transition-all shadow-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 whitespace-nowrap">Échéance</label>
                                                <input
                                                    type="date"
                                                    value={newInvoice.dueDate}
                                                    onChange={e => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#f56b2a] focus:bg-white transition-all shadow-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 whitespace-nowrap">Statut Initial</label>
                                                <select
                                                    value={newInvoice.status}
                                                    onChange={e => setNewInvoice({ ...newInvoice, status: e.target.value as any })}
                                                    className={`w-full border-2 rounded-2xl px-5 py-4 text-sm font-black focus:outline-none transition-all shadow-sm ${getStatusColor(newInvoice.status || 'DRAFT')}`}
                                                >
                                                    <option value="DRAFT">Brouillon</option>
                                                    <option value="SENT">Envoyée</option>
                                                    <option value="PAID">Payée</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 whitespace-nowrap">Notes internes</label>
                                                <input
                                                    type="text"
                                                    value={newInvoice.notes || ''}
                                                    onChange={e => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                                                    placeholder="Ex: Confiance"
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#f56b2a] focus:bg-white transition-all shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Articles de la facture</h3>
                                        <span className="text-[10px] font-black text-[#f56b2a] bg-orange-50 px-2 py-0.5 rounded-full">{newInvoice.items?.length || 0} Articles</span>
                                    </div>

                                    <div className="bg-gray-50/50 rounded-2xl p-4 md:p-6 border border-gray-100">
                                        <div className="flex flex-col md:flex-row gap-4 items-end">
                                            <div className="flex-grow w-full">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1 whitespace-nowrap">Choisir un produit</label>
                                                <select
                                                    value={selectedProduct}
                                                    onChange={e => setSelectedProduct(e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-xs md:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 transition-all shadow-md"
                                                >
                                                    <option value="">Sélectionner un produit...</option>
                                                    {products.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-full md:w-36 shrink-0">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1 whitespace-nowrap">Quantité</label>
                                                <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-md h-[46px]">
                                                    <button 
                                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                                        className="px-3 h-full hover:bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors border-r border-gray-100"
                                                    >
                                                        <span className="font-black text-lg">−</span>
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={quantity}
                                                        onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                                                        className="w-full bg-transparent text-center text-sm font-black text-gray-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                    <button 
                                                        onClick={() => setQuantity(quantity + 1)}
                                                        className="px-3 h-full hover:bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors border-l border-gray-100"
                                                    >
                                                        <span className="font-black text-lg">+</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleAddItem}
                                                disabled={!selectedProduct}
                                                className="w-full md:w-auto px-6 py-3.5 bg-gray-900 text-white rounded-xl font-black flex items-center justify-center gap-2 hover:bg-black disabled:opacity-30 disabled:grayscale transition-all text-xs md:text-sm shadow-xl active:scale-95"
                                            >
                                                <Plus size={16} /> Ajouter
                                            </button>
                                        </div>
                                    </div>

                                {newInvoice.items && newInvoice.items.length > 0 ? (
                                    <div className="border border-gray-100 rounded-xl md:rounded-2xl overflow-hidden bg-white shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm min-w-[500px] md:min-w-0">
                                                <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                                                    <tr>
                                                        <th className="px-6 py-4">Description</th>
                                                        <th className="px-4 py-4 w-20 text-center">Qté</th>
                                                        <th className="px-6 py-4 w-32 text-right">Prix Un.</th>
                                                        <th className="px-6 py-4 w-32 text-right">Total</th>
                                                        <th className="px-4 py-4 w-12 text-center"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50 whitespace-nowrap">
                                                    {newInvoice.items.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-6 py-4 font-bold text-gray-900 max-w-[200px] truncate">{item.description}</td>
                                                            <td className="px-4 py-4 text-center font-black text-[#f56b2a] bg-orange-50/30">{item.quantity}</td>
                                                            <td className="px-6 py-4 text-right text-gray-500 font-medium">{formatCurrency(item.unitPrice)}</td>
                                                            <td className="px-6 py-4 text-right font-black text-gray-900">{formatCurrency(item.total)}</td>
                                                            <td className="px-4 py-4 text-center">
                                                                <button onClick={() => handleRemoveItem(idx)} className="text-gray-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 px-6 border-2 border-dashed border-gray-100 rounded-3xl text-gray-400">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Search size={24} className="text-gray-200" />
                                        </div>
                                        <p className="text-xs font-black uppercase tracking-widest">Aucun article ajouté</p>
                                        <p className="text-[10px] mt-1">Sélectionnez un produit ci-dessus pour commencer.</p>
                                    </div>
                                )}

                                    <div className="flex justify-end pt-6 border-t border-gray-100">
                                        <div className="space-y-4 w-full md:w-80 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                            <div className="flex justify-between text-[10px] text-gray-400 font-black uppercase tracking-widest whitespace-nowrap">
                                                <span>Sous-total</span>
                                                <span className="font-mono text-gray-900">{formatCurrency(formSubtotal)}</span>
                                            </div>
                                            <div className="flex justify-between text-lg md:text-xl font-black text-[#f56b2a] pt-4 border-t border-gray-100 tracking-tighter whitespace-nowrap">
                                                <span className="uppercase text-xs self-center">Total</span>
                                                <span className="font-mono">{formatCurrency(formTotal)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-4">
                            {step > 1 ? (
                                <button
                                    onClick={() => setStep(step - 1)}
                                    className="px-6 py-4 border border-gray-200 font-black text-gray-500 rounded-2xl hover:bg-gray-100 transition-all active:scale-95 text-sm"
                                >
                                    Précédent
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsCreating(false)}
                                    className="px-6 py-4 border border-gray-200 font-black text-gray-500 rounded-2xl hover:bg-gray-100 transition-all active:scale-95 text-sm"
                                >
                                    Annuler
                                </button>
                            )}

                            {step < 3 ? (
                                <button
                                    onClick={() => setStep(step + 1)}
                                    className="flex-grow md:flex-none px-10 py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl shadow-gray-200 hover:bg-black transition-all active:scale-95 text-sm"
                                >
                                    Continuer
                                </button>
                            ) : (
                                <button
                                    onClick={handleSaveInvoice}
                                    className="flex-grow md:flex-none px-12 py-4 bg-[#f56b2a] text-white font-black rounded-2xl shadow-xl shadow-orange-100 hover:bg-[#d55a20] transition-all active:scale-95 text-sm"
                                >
                                    Enregistrer la Facture
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Détails Facture & PDF */}
            {selectedInvoice && !isCreating && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
                        {/* Header Mobile Only */}
                        <div className="md:hidden flex items-center justify-between p-3 border-b border-gray-100 bg-white sticky top-0 z-20">
                            <div>
                                <h2 className="font-black text-gray-900 text-sm">{selectedInvoice.invoiceNumber}</h2>
                                <p className="text-[9px] text-gray-400 font-bold uppercase">{getStatusLabel(selectedInvoice.status)}</p>
                            </div>
                            <button onClick={() => setSelectedInvoice(null)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>

                        <div className="flex-grow overflow-y-auto p-2 md:p-8 custom-scrollbar bg-gray-50/50">
                            <div
                                ref={invoiceRef}
                                className="bg-white mx-auto shadow-xl md:shadow-sm border border-gray-100 md:border-gray-200 !max-w-[800px] w-full min-h-[500px] p-6 md:p-12 relative print:shadow-none print:border-none rounded-xl md:rounded-none overflow-x-auto"
                            >
                                {/* Decorative Header */}
                                <div className="absolute top-0 left-0 w-full h-2 bg-[#f56b2a]"></div>

                                <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 md:mb-12 mt-4">
                                    <div className="w-full md:w-auto">
                                        <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tighter uppercase mb-2">Facture</h1>
                                        <div className="text-gray-500 text-[10px] md:text-sm font-medium space-y-1">
                                            <p><span className="font-bold text-gray-400 w-20 md:w-24 inline-block uppercase tracking-wider">Numéro :</span> <span className="text-gray-900 font-mono font-bold">{selectedInvoice.invoiceNumber}</span></p>
                                            <p><span className="font-bold text-gray-400 w-20 md:w-24 inline-block uppercase tracking-wider">Date :</span> <span className="text-gray-900">{new Date(selectedInvoice.date).toLocaleDateString('fr-FR')}</span></p>
                                            <p><span className="font-bold text-gray-400 w-20 md:w-24 inline-block uppercase tracking-wider">Échéance :</span> <span className="text-gray-900">{new Date(selectedInvoice.dueDate).toLocaleDateString('fr-FR')}</span></p>
                                        </div>
                                    </div>
                                    <div className="text-left md:text-right text-[10px] md:text-sm w-full md:w-auto bg-gray-50 md:bg-transparent p-4 md:p-0 rounded-xl">
                                        <h2 className="text-sm md:text-xl font-black text-[#f56b2a] mb-1 md:mb-2">{storeSettings.name}</h2>
                                        <p className="text-gray-500 whitespace-pre-line leading-relaxed">{storeSettings.address}</p>
                                        <div className="mt-2 space-y-0.5">
                                            <p className="text-gray-700 font-bold">{storeSettings.phone}</p>
                                            <p className="text-gray-500">{storeSettings.email}</p>
                                            <p className="text-[#f56b2a] uppercase tracking-widest text-[8px] md:text-[10px] mt-2 font-black bg-orange-50 inline-block px-2 py-0.5 rounded">NINEA: {storeSettings.ninea}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-8 md:mb-12 p-4 md:p-6 bg-gray-50/50 rounded-xl md:rounded-2xl border border-gray-100">
                                    <h3 className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-200 pb-2">Client</h3>
                                    <div className="text-gray-900">
                                        <div className="font-black text-base md:text-lg mb-1">{selectedInvoice.customerName}</div>
                                        {selectedInvoice.customerAddress && <div className="text-xs md:text-sm text-gray-600 whitespace-pre-line mb-1 italic">{selectedInvoice.customerAddress}</div>}
                                        {selectedInvoice.customerEmail && <div className="text-xs md:text-sm text-[#f56b2a] font-bold">{selectedInvoice.customerEmail}</div>}
                                    </div>
                                </div>

                                <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0 mb-8">
                                    {loadingInvoiceItems ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="animate-spin text-[#f56b2a]" size={24} />
                                        </div>
                                    ) : (
                                    <table className="w-full text-left min-w-[500px] md:min-w-0">
                                        <thead className="border-b-2 border-gray-900">
                                            <tr>
                                                <th className="py-3 text-[10px] md:text-sm font-black text-gray-900 uppercase tracking-wider">Description</th>
                                                <th className="py-3 text-[10px] md:text-sm font-black text-gray-900 uppercase tracking-wider text-center w-16 md:w-20">Qté</th>
                                                <th className="py-3 text-[10px] md:text-sm font-black text-gray-900 uppercase tracking-wider text-right w-24 md:w-32">Prix Un.</th>
                                                <th className="py-3 text-[10px] md:text-sm font-black text-gray-900 uppercase tracking-wider text-right w-24 md:w-32">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {selectedInvoiceItems.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="py-3 md:py-4 text-xs md:text-sm font-bold text-gray-800">{item.description}</td>
                                                    <td className="py-3 md:py-4 text-xs md:text-sm text-center text-gray-600 font-medium">{item.quantity}</td>
                                                    <td className="py-3 md:py-4 text-xs md:text-sm text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                                                    <td className="py-3 md:py-4 text-xs md:text-sm text-right font-black text-gray-900">{formatCurrency(item.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    )}
                                </div>

                                <div className="flex justify-end pt-6 border-t border-gray-200">
                                    <div className="space-y-2 md:space-y-3 w-full md:w-72">
                                        <div className="flex justify-between text-xs md:text-sm text-gray-500">
                                            <span className="font-bold uppercase tracking-wider">Sous-total</span>
                                            <span className="font-mono">{formatCurrency(selectedInvoice.subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-base md:text-xl font-black text-[#f56b2a] pt-3 border-t-2 border-gray-900">
                                            <span className="uppercase tracking-tighter">Total</span>
                                            <span className="font-mono">{formatCurrency(selectedInvoice.total)}</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedInvoice.notes && (
                                    <div className="mt-16 pt-6 border-t border-gray-100">
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Conditions & Notes</h3>
                                        <p className="text-sm text-gray-600 whitespace-pre-line">{selectedInvoice.notes}</p>
                                    </div>
                                )}

                                <div className="mt-20 text-center text-xs text-gray-400 font-medium">
                                    Merci pour votre confiance. En cas de question concernant cette facture, merci de nous contacter.
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-gray-100 p-4 md:p-6 flex flex-col shrink-0 relative mt-auto md:mt-0">
                            <button onClick={() => setSelectedInvoice(null)} className="hidden md:flex absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-50 rounded-full">
                                <X size={24} />
                            </button>

                            <h3 className="text-lg font-black text-gray-900 tracking-tight mb-4 md:mb-6 hidden md:block mt-8">Actions</h3>

                            <div className="grid grid-cols-1 md:block gap-4">
                                {!isSeller && (
                                    <div className="mb-4">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Statut</label>
                                        <select
                                            value={selectedInvoice.status}
                                            onChange={async (e) => {
                                                const updated = { ...selectedInvoice, status: e.target.value as any };
                                                if (onSaveInvoice) {
                                                    await onSaveInvoice(updated);
                                                } else {
                                                    const { error } = await supabase.from('invoices').update({ status: updated.status }).eq('id', updated.id);
                                                    if (error) alert("Erreur lors de la mise à jour");
                                                    router.refresh();
                                                }
                                                setSelectedInvoice(updated);
                                            }}
                                            className={`w-full font-black border-2 rounded-xl px-4 py-2.5 md:py-3 outline-none transition-all text-xs md:text-sm ${getStatusColor(selectedInvoice.status)}`}
                                        >
                                            <option value="DRAFT">Brouillon</option>
                                            <option value="SENT">Envoyée</option>
                                            <option value="PAID">Payée</option>
                                            <option value="OVERDUE">En retard</option>
                                        </select>
                                    </div>
                                )}

                                <div className="pt-4 md:pt-6 border-t border-gray-100 flex md:flex-col gap-2 md:gap-3">
                                    <button
                                        onClick={handlePrint}
                                        className="flex-grow md:w-full py-2.5 md:py-3.5 bg-white border-2 border-gray-100 rounded-xl font-black text-gray-600 flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all text-[11px] md:text-sm"
                                    >
                                        <Printer size={16} className="md:size-[18px]" /> Imprimer
                                    </button>
                                    <button
                                        onClick={handleDownloadPDF}
                                        className="flex-grow md:w-full py-2.5 md:py-3.5 bg-[#f56b2a] text-white rounded-xl font-black flex items-center justify-center gap-2 hover:bg-[#d55a20] shadow-lg shadow-orange-100 active:scale-95 transition-all text-[11px] md:text-sm"
                                    >
                                        <Download size={16} className="md:size-[18px]" /> PDF
                                    </button>
                                    <button
                                        className="hidden md:flex w-full py-3.5 bg-gray-900 text-white rounded-xl font-black items-center justify-center gap-2 hover:bg-black shadow-lg shadow-gray-200 active:scale-95 transition-all text-sm"
                                    >
                                        <Send size={18} /> Email
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

export default InvoicesView;

