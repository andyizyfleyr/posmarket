'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from '@/components/RouterPolyfill';
import { useSearchParams } from 'next/navigation';
import { 
    updateStoreSettingsAction, 
    createStoreAction, 
    deleteStoreAction, 
    saveCouponAction, 
    deleteCouponAction,
    addStaffAction,
    deleteStaffAction,
    updateProfileAction
} from '@/app/actions/settings';
import { optimizeImage, fileToBase64 } from '@/utils/image-optimization';
import {
    Settings,
    Store,
    User,
    ShieldCheck,
    Smartphone,
    Languages,
    CreditCard,
    Building,
    Mail,
    Phone,
    MapPin,
    Save,
    ChevronRight,
    Users,
    Trash2,
    Plus,
    CheckSquare,
    Square,
    X,
    Camera,
    Tag,
    Loader2,
    FileText,
    Info
} from 'lucide-react';

import { StoreSettings, Product, Customer, Order, Staff, StaffRole, StaffPermissions, NotificationType, StoreData, Coupon } from '@/types';
import { supabase } from '@/supabase';

interface SettingsViewProps {
    storeSettings: StoreSettings;
    products: Product[];
    customers: Customer[];
    orders: Order[];
    staff: Staff[];
    coupons?: Coupon[];
    userRole: StaffRole;
    permissions: StaffPermissions;
    notify?: (message: string, type: NotificationType, title?: string) => void;
    stores: StoreData[];
    currentStoreId: string;
    currentUserId?: string;
    userName?: string;
    userEmail?: string;
}

// Sub-components for better performance (memoization)
const SettingItem = React.memo(({ icon, title, description, badge, onClick }: any) => (
    <div 
        onClick={onClick}
        className="flex items-center justify-between p-2.5 md:p-4 hover:bg-orange-50/50 transition-all cursor-pointer group rounded-xl md:rounded-2xl border border-transparent hover:border-orange-100"
    >
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 group-hover:text-[#f56b2a] transition-colors flex-shrink-0">
                {React.cloneElement(icon, { size: 16, className: 'md:size-5' })}
            </div>
            <div className="min-w-0">
                <h4 className="text-[11px] md:text-sm font-black text-gray-900 leading-tight truncate">{title}</h4>
                <p className="text-[9px] md:text-[10px] text-gray-400 md:text-gray-500 font-medium truncate">{description}</p>
            </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {badge && <span className="bg-orange-100 text-[#f56b2a] text-[8px] md:text-[10px] font-black px-1.5 md:px-2 py-0.5 rounded-full">{badge}</span>}
            <ChevronRight size={14} className="text-gray-300 md:size-4 group-hover:text-[#f56b2a]" />
        </div>
    </div>
));

const SectionHeader = React.memo(({ title, icon }: any) => (
    <div className="flex items-center gap-2.5 md:gap-3 mb-3 md:mb-6">
        <div className="p-1.5 md:p-2 bg-[#f56b2a] rounded-lg md:rounded-xl text-white">
            {React.cloneElement(icon, { size: 14, className: 'md:size-[18px]' })}
        </div>
        <h3 className="text-[10px] md:text-sm font-black text-gray-900 uppercase tracking-widest leading-none">{title}</h3>
    </div>
));

const SettingsView: React.FC<SettingsViewProps> = ({
    storeSettings,
    products,
    customers,
    orders,
    staff,
    coupons: initialCoupons = [],
    userRole,
    permissions,
    notify,
    stores,
    currentStoreId,
    currentUserId,
    userName,
    userEmail
}) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const currentStoreData = stores.find(s => s.id === currentStoreId);

    const [localSettings, setLocalSettings] = useState<StoreSettings>(storeSettings ? {
        ...storeSettings,
        address: storeSettings.address || currentStoreData?.address || '',
        description: storeSettings.description || currentStoreData?.description || ''
    } : {
        name: '',
        email: '',
        phone: '',
        address: currentStoreData?.address || '',
        ninea: '',
        currency: 'XOF',
        language: 'fr',
        description: currentStoreData?.description || ''
    });

    const activeTab = useMemo(() => {
        const tab = searchParams.get('tab');
        const validTabs = ['general', 'store', 'user', 'staff', 'promos'];
        return (tab && validTabs.includes(tab) ? tab : 'general') as 'general' | 'store' | 'user' | 'staff' | 'promos';
    }, [searchParams]);

    const setActiveTab = useCallback((tab: string) => {
        const params = new URLSearchParams(window.location.search);
        params.set('tab', tab);
        router.push(`?${params.toString()}`);
    }, [router]);

    const [isSaving, setIsSaving] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState(false);
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);
    const [newStaffEmail, setNewStaffEmail] = useState('');
    const [newStaffPassword, setNewStaffPassword] = useState('');
    const [profileName, setProfileName] = useState(userName || '');
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [newStaffRole, setNewStaffRole] = useState<StaffRole>('SELLER');
    const [selectedStoreId, setSelectedStoreId] = useState(currentStoreId);
    
    // Coupons state
    const [localCoupons, setLocalCoupons] = useState<Coupon[]>(initialCoupons);
    const [newCouponCode, setNewCouponCode] = useState('');
    const [newCouponDiscount, setNewCouponDiscount] = useState(10);
    const [loadingCoupons, setLoadingCoupons] = useState(false);
    
    useEffect(() => { setLocalCoupons(initialCoupons); }, [initialCoupons]);
    useEffect(() => { 
        if (storeSettings) {
            setLocalSettings(prev => ({ 
                ...prev, 
                ...storeSettings,
                address: storeSettings.address || prev.address || '',
                description: storeSettings.description || prev.description || ''
            })); 
        } 
    }, [storeSettings]);

    const handleAddCoupon = async () => {
        if (!newCouponCode.trim()) return;
        setLoadingCoupons(true);
        try {
            const result = await saveCouponAction({
                code: newCouponCode.trim().toUpperCase(),
                discountPct: newCouponDiscount,
                active: true
            }, currentStoreId);
            if (result.success) {
                if (notify) notify('Code promo créé avec succès', 'success');
                setNewCouponCode('');
                setNewCouponDiscount(10);
                router.refresh();
            } else {
                if (notify) notify(result.error || 'Erreur lors de la création', 'error');
            }
        } catch (err: any) {
            if (notify) notify(err.message, 'error');
        } finally {
            setLoadingCoupons(false);
        }
    };
    
    const handleDeleteCouponLocal = async (id: string) => {
        setLoadingCoupons(true);
        try {
            const result = await deleteCouponAction(id);
            if (result.success) {
                if (notify) notify('Code promo supprimé', 'info');
                router.refresh();
            } else { throw new Error(result.error); }
        } catch (err: any) {
            if (notify) notify(err.message, 'error');
        } finally {
            setLoadingCoupons(false);
        }
    };
    
    const handleToggleCoupon = async (id: string) => {
        // Optimistic update
        setLocalCoupons(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
        
        const coupon = localCoupons.find(c => c.id === id);
        if (!coupon) return;
        
        const { error } = await supabase.from('coupons').update({ active: !coupon.active }).eq('id', id);
        if (error) {
            if (notify) notify("Erreur de mise à jour", "error");
            setLocalCoupons(initialCoupons);
        } else {
            router.refresh();
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let result;
            if (currentStoreId) {
                result = await updateStoreSettingsAction(currentStoreId, localSettings);
            } else {
                if (!currentUserId) throw new Error("ID utilisateur manquant");
                result = await createStoreAction(localSettings, currentUserId);
                if (result.success && result.store) {
                    router.refresh();
                    return;
                }
            }

            if (result.success) {
                setSaveFeedback(true);
                setTimeout(() => setSaveFeedback(false), 2500);
                if (notify) notify("Réglages enregistrés !", "success");
                router.refresh();
            } else {
                throw new Error(result.error);
            }
        } catch (err: any) {
            console.error(err);
            if (notify) notify(err.message || "Erreur lors de la sauvegarde", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmitStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingStaff(true);
        try {
            const result = await addStaffAction({
                email: newStaffEmail,
                password: newStaffPassword,
                role: newStaffRole
            }, selectedStoreId);
            
            if (result.success) {
                if (notify) notify("Employé ajouté avec succès", 'success');
                setIsStaffModalOpen(false);
                setNewStaffEmail('');
                setNewStaffPassword('');
                router.refresh();
            } else {
                if (notify) notify(result.error || "Erreur lors de l'ajout", 'error');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmittingStaff(false);
        }
    };

    const handleUpdateProfileLocal = async () => {
        if (!currentUserId) return;
        setIsUpdatingProfile(true);
        try {
            const result = await updateProfileAction(currentUserId, {
                fullName: profileName,
                avatarUrl: profilePhoto || undefined
            });
            if (result.success) {
                if (notify) notify('Profil mis à jour !', 'success');
                router.refresh();
            } else {
                throw new Error(result.error);
            }
        } catch (err: any) {
            if (notify) notify(err.message, 'error');
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const optimizedFile = await optimizeImage(file);
                const base64 = await fileToBase64(optimizedFile);
                setProfilePhoto(base64);
            } catch (err) {
                if (notify) notify("Erreur lors de l'optimisation de l'image", "error");
            }
        }
    };



    const handleNotImplemented = (feature: string) => {
        if (notify) notify(`La fonctionnalité "${feature}" n'est pas encore disponible.`, 'info');
    };

    const handleDeleteStaffLocal = async (id: string) => {
        if (!confirm("Supprimer ce membre de l'équipe ?")) return;
        try {
            const result = await deleteStaffAction(id);
            if (result.success) {
                if (notify) notify("Membre supprimé", 'info');
                router.refresh();
            } else { throw new Error(result.error); }
        } catch (err: any) {
            if (notify) notify(err.message, 'error');
        }
    };

    return (
        <div className="flex-grow overflow-hidden flex flex-col p-3 md:p-8 bg-gray-50/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-8 gap-3 md:gap-4">
                <div>
                    <h1 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight whitespace-nowrap">Réglages</h1>
                    <p className="text-gray-500 text-[10px] md:text-sm mt-0.5 md:mt-1 truncate">Gérez vos préférences.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex items-center justify-center gap-2 px-4 py-2 md:px-6 md:py-3 text-white rounded-lg md:rounded-xl text-[10px] md:text-sm font-black transition-all shadow-lg active:scale-95 whitespace-nowrap ${isSaving ? 'opacity-70 cursor-not-allowed' : ''} ${saveFeedback ? 'bg-green-500 shadow-green-100' : 'bg-[#f56b2a] shadow-orange-100 hover:bg-[#d55a20]'}`}
                >
                    {isSaving ? <Loader2 size={16} className="md:size-[18px] animate-spin" /> : saveFeedback ? <ShieldCheck size={16} className="md:size-[18px]" /> : <Save size={16} className="md:size-[18px]" />}
                    {isSaving ? 'Traitement...' : saveFeedback ? 'Prêt !' : 'Enregistrer'}
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 flex-grow overflow-hidden">
                {/* Sidebar Tabs */}
                <div className="w-full lg:w-64 flex flex-row lg:flex-col gap-1.5 md:gap-2 overflow-x-auto pb-3 lg:pb-0 no-scrollbar -mx-3 px-3 md:mx-0 md:px-0">
                    {[
                        { id: 'general', label: 'Général', icon: <Settings size={18} /> },
                        { id: 'store', label: 'Boutique', icon: <Store size={18} /> },
                        { id: 'user', label: 'Profil', icon: <User size={18} /> },
                        { id: 'staff', label: 'Équipe', icon: <Users size={18} />, hidden: !permissions.canManageStaff },
                        { id: 'promos', label: 'Promos', icon: <Tag size={18} /> },
                    ].filter(t => !t.hidden).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl font-black text-[10px] md:text-sm transition-all whitespace-nowrap min-w-fit flex-shrink-0 ${activeTab === tab.id ? 'bg-white text-[#f56b2a] shadow-md border border-gray-100' : 'text-gray-500 hover:bg-white/50'}`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-grow bg-white rounded-3xl md:rounded-[32px] border border-gray-100 shadow-sm overflow-y-auto custom-scrollbar p-3.5 md:p-10">
                    {activeTab === 'general' && (
                        <div className="space-y-8 md:space-y-12 animate-in fade-in slide-in-from-right-4 duration-300">
                            <section>
                                <SectionHeader title="Préférences" icon={<Settings />} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2">
                                    <SettingItem
                                        icon={<Languages size={20} />}
                                        title="Langue"
                                        description="Français (Sénégal)"
                                        badge="FR"
                                        onClick={() => handleNotImplemented('Changer la langue')}
                                    />
                                    <SettingItem
                                        icon={<CreditCard size={20} />}
                                        title="Devise"
                                        description="Franc CFA (XOF)"
                                        onClick={() => handleNotImplemented('Changer la devise')}
                                    />
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'store' && (
                        <div className="space-y-6 md:space-y-12 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div>
                                <SectionHeader title="Informations de la Boutique" icon={<Store />} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    <div>
                                        <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 md:mb-2 text-ellipsis overflow-hidden">Nom de la Boutique</label>
                                        <div className="relative">
                                            <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 md:size-4" size={14} />
                                            <input
                                                className="w-full pl-10 md:pl-11 pr-4 py-2.5 md:py-3 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-[11px] md:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 transition-all"
                                                value={localSettings.name}
                                                onChange={(e) => setLocalSettings(prev => ({ ...prev, name: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 md:mb-2 text-ellipsis overflow-hidden">Email de Contact</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 md:size-4" size={14} />
                                            <input
                                                className="w-full pl-10 md:pl-11 pr-4 py-2.5 md:py-3 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-[11px] md:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 transition-all"
                                                value={localSettings.email}
                                                onChange={(e) => setLocalSettings(prev => ({ ...prev, email: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 md:mb-2 text-ellipsis overflow-hidden">Numéro WhatsApp (Commande)</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 md:size-4" size={14} />
                                            <input
                                                className="w-full pl-10 md:pl-11 pr-4 py-2.5 md:py-3 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-[11px] md:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 transition-all"
                                                placeholder="Ex: 221771234567 (Sans le +)"
                                                value={localSettings.phone}
                                                onChange={(e) => setLocalSettings(prev => ({ ...prev, phone: e.target.value }))}
                                            />
                                        </div>
                                        <p className="text-[8px] md:text-[9px] text-gray-400 mt-1 font-bold italic px-1">Indicatif pays sans le + (ex: 221...)</p>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 md:mb-2 text-ellipsis overflow-hidden">Pays</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 md:size-4" size={14} />
                                            <select
                                                className="w-full pl-10 md:pl-11 pr-10 py-2.5 md:py-3 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-[11px] md:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 transition-all appearance-none cursor-pointer"
                                                value={localSettings.address}
                                                onChange={(e) => setLocalSettings(prev => ({ ...prev, address: e.target.value }))}
                                            >
                                                <option value="">Sélectionnez un pays</option>
                                                <option value="Bénin">Bénin</option>
                                                <option value="Côte d'Ivoire">Côte d'Ivoire</option>
                                                <option value="Togo">Togo</option>
                                                <option value="Cameroun">Cameroun</option>
                                            </select>
                                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 md:size-4 rotate-90 pointer-events-none" size={14} />
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 md:mb-2 text-ellipsis overflow-hidden">Description de la boutique</label>
                                        <div className="relative">
                                            <FileText className="absolute left-3.5 top-3 text-gray-300 md:size-4" size={14} />
                                            <textarea
                                                className="w-full pl-10 md:pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-[11px] md:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 transition-all resize-none min-h-[100px] no-global-border"
                                                placeholder="Décrivez votre univers (lettres uniquement, max 250 car.)..."
                                                maxLength={250}
                                                value={localSettings.description || ''}
                                                onChange={(e) => {
                                                    // Filtrage strict : lettres, espaces et points autorisés (garde les accents)
                                                    const filteredValue = e.target.value.replace(/[^a-zA-ZÀ-ÿ\s\.]/g, '');
                                                    setLocalSettings(prev => ({ ...prev, description: filteredValue }));
                                                }}
                                            />
                                            <div className="absolute bottom-3 right-4 text-[8px] font-black text-gray-300 uppercase tracking-widest">
                                                {(localSettings.description || '').length} / 250
                                            </div>
                                        </div>
                                        <p className="text-[8px] md:text-[9px] text-gray-400 mt-1 font-bold italic px-1 flex items-center gap-1">
                                            <Info size={10} /> Chiffres, liens et codes interdits (Lettres uniquement)
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {activeTab === 'user' && (
                        <div className="space-y-8 md:space-y-12 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Profile Header Card */}
                            <div className="relative p-6 md:p-10 bg-gradient-to-br from-[#f56b2a] to-[#ff8c52] rounded-[32px] md:rounded-[48px] overflow-hidden shadow-2xl shadow-orange-100 flex flex-col md:flex-row items-center gap-6 md:gap-10">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-20 -mb-20 blur-2xl" />
                                
                                <div className="relative z-10 group">
                                    <div className="w-28 h-28 md:w-36 md:h-36 rounded-[32px] md:rounded-[42px] overflow-hidden border-4 border-white/30 shadow-2xl transform group-hover:scale-[1.02] transition-all duration-500">
                                        <img 
                                            src={profilePhoto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userEmail} 
                                            className="w-full h-full object-cover" 
                                            alt="Profil"
                                        />
                                    </div>
                                    <label className="absolute -bottom-2 -right-2 bg-white text-[#f56b2a] p-2.5 md:p-3 rounded-2xl shadow-xl hover:scale-110 active:scale-90 transition-all cursor-pointer border border-[#f56b2a]/10">
                                        <Camera size={18} className="md:size-5" />
                                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                    </label>
                                </div>

                                <div className="relative z-10 flex-grow text-center md:text-left space-y-1 md:space-y-2">
                                    <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">{profileName || 'Gérant'}</h2>
                                    <p className="text-white/80 text-xs md:text-base font-medium flex items-center justify-center md:justify-start gap-2">
                                        <Mail size={14} className="md:size-4" /> {userEmail}
                                    </p>
                                </div>
                            </div>

                            <div className="max-w-2xl mx-auto w-full space-y-8">
                                {/* Identity Section */}
                                <section>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-orange-50 rounded-xl text-[#f56b2a]">
                                            <User size={20} />
                                        </div>
                                        <h3 className="text-xs md:text-sm font-black text-gray-900 uppercase tracking-widest leading-none">Identité Personnelle</h3>
                                    </div>
                                    
                                    <div className="bg-gray-50/50 p-6 md:p-10 rounded-[32px] border border-gray-100 space-y-8">
                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom Complet</label>
                                            <div className="relative group">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#f56b2a] transition-colors" size={20} />
                                                <input
                                                    type="text"
                                                    value={profileName}
                                                    onChange={(e) => setProfileName(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#f56b2a]/10 outline-none shadow-sm transition-all"
                                                    placeholder="Votre nom"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleUpdateProfileLocal}
                                            disabled={isUpdatingProfile}
                                            className="w-full py-4.5 bg-[#f56b2a] text-white rounded-2xl text-sm font-black shadow-xl shadow-orange-100/50 hover:bg-[#d55a20] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isUpdatingProfile ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                            {isUpdatingProfile ? 'Mise à jour...' : 'Sauvegarder les modifications'}
                                        </button>
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {activeTab === 'staff' && (
                        <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between gap-4">
                                <SectionHeader title="Gestion de l'Équipe" icon={<Users />} />
                                <button
                                    onClick={() => setIsStaffModalOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-[#f56b2a] text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-black shadow-lg shadow-orange-100 hover:bg-[#d55a20] transition-all active:scale-95 whitespace-nowrap"
                                >
                                    <Plus size={14} /> Ajouter un membre
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {staff.length === 0 ? (
                                    <div className="col-span-full py-12 text-center text-gray-400 font-bold border-2 border-dashed border-gray-100 rounded-3xl">
                                        Aucun membre d'équipe enregistré.
                                    </div>
                                ) : (
                                    staff.map(member => (
                                        <div key={member.id} className="p-3.5 md:p-5 bg-gray-50 border border-gray-100 rounded-xl md:rounded-3xl group relative hover:bg-white hover:shadow-xl hover:shadow-orange-100/20 transition-all">
                                            <button
                                                onClick={() => handleDeleteStaffLocal(member.id)}
                                                className="absolute top-2.5 right-2.5 md:top-4 md:right-4 p-1.5 text-red-400 opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            >
                                                <Trash2 size={12} className="md:size-4" />
                                            </button>
                                            <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-[#f56b2a] flex-shrink-0 shadow-sm">
                                                    <User size={20} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-black text-gray-900 text-xs md:text-sm tracking-tight truncate pr-6">{member.userId}</h4>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[8px] md:text-[9px] font-black px-1.5 md:px-2 py-0.5 rounded-full ${member.role === 'OWNER' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-[#f56b2a]'}`}>
                                                            {member.role}
                                                        </span>
                                                        <span className="text-[9px] md:text-[10px] text-gray-400 font-bold flex items-center gap-1 truncate">
                                                            <Store size={8} className="md:size-[10px]" />
                                                            {stores.find(s => s.id === member.storeId)?.settings.name || 'Boutique'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'promos' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <section>
                                <SectionHeader title="Campagnes Promotionnelles" icon={<Tag />} />
                                <p className="text-gray-500 text-xs md:text-sm mb-6 leading-relaxed">
                                    Créez des codes promo uniques pour fidéliser vos clients et booster vos ventes en ligne.
                                </p>
                                
                                <div className="bg-gray-50 rounded-2xl md:rounded-3xl p-4 md:p-6 border border-gray-100 mb-8 shadow-sm">
                                    <h4 className="font-black text-xs md:text-sm mb-4 flex items-center gap-2 uppercase tracking-tight">
                                        <Plus size={16} className="text-[#f56b2a]" /> Nouveau Code
                                    </h4>
                                    <div className="flex flex-col md:flex-row gap-3">
                                        <input
                                            type="text"
                                            value={newCouponCode}
                                            onChange={e => setNewCouponCode(e.target.value)}
                                            placeholder="Code (ex: BIENVENUE20)"
                                            className="flex-grow px-4 py-2.5 bg-white border border-gray-100 rounded-xl md:rounded-2xl font-black text-xs md:text-sm uppercase focus:ring-2 focus:ring-[#f56b2a]/10 outline-none"
                                        />
                                        <div className="w-full md:w-32 relative">
                                            <input
                                                type="number" min="1" max="100"
                                                value={newCouponDiscount}
                                                onChange={e => setNewCouponDiscount(Number(e.target.value))}
                                                className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl md:rounded-2xl font-black text-xs md:text-sm focus:ring-2 focus:ring-[#f56b2a]/10 outline-none"
                                            />
                                            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-black">%</span>
                                        </div>
                                        <button
                                            onClick={handleAddCoupon}
                                            disabled={!newCouponCode.trim() || loadingCoupons}
                                            className="px-6 py-2.5 bg-[#f56b2a] text-white rounded-xl md:rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-orange-100 hover:bg-[#d55a20] disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2 active:scale-95 transition-all"
                                        >
                                            {loadingCoupons ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                            {loadingCoupons ? 'Action...' : 'Ajouter'}
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="space-y-3">
                                    {localCoupons.length === 0 ? (
                                        <div className="text-center py-12 md:py-16 text-gray-400 border-2 border-dashed border-gray-50 rounded-3xl">
                                            <Tag size={48} className="mx-auto mb-4 opacity-10" />
                                            <p className="font-bold text-sm tracking-tight italic">Aucune promotion active actuellement.</p>
                                        </div>
                                    ) : (
                                        localCoupons.map(coupon => (
                                            <div key={coupon.id || coupon.code} className="flex items-center justify-between p-3.5 md:p-5 bg-white rounded-xl md:rounded-[28px] border border-gray-100 shadow-sm hover:shadow-lg hover:border-orange-50 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <button 
                                                        onClick={() => coupon.id && handleToggleCoupon(coupon.id)}
                                                        className="transition-transform active:scale-90"
                                                    >
                                                        {coupon.active ? (
                                                            <CheckSquare size={22} className="text-[#f56b2a]" />
                                                        ) : (
                                                            <Square size={22} className="text-gray-300 hover:text-gray-400" />
                                                        )}
                                                    </button>
                                                    <div>
                                                        <span className="font-black text-xs md:text-sm uppercase tracking-tighter text-gray-900">{coupon.code}</span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="bg-orange-50 text-[#f56b2a] text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-lg">-{coupon.discount_pct}%</span>
                                                            <span className="text-gray-400 text-[10px] md:text-xs">Valide en ligne</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => coupon.id && handleDeleteCouponLocal(coupon.id)}
                                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                                
                                <div className="p-4 bg-orange-50/50 rounded-2xl md:rounded-3xl border border-orange-100/50 flex gap-3 mt-8">
                                    <ShieldCheck size={18} className="text-[#f56b2a] flex-shrink-0" />
                                    <p className="text-[#f56b2a] text-[10px] md:text-xs font-medium leading-relaxed">
                                        <strong>Conseil :</strong> Les codes promo sont sensibles à la casse. Vos clients verront ces remises s'appliquer automatiquement s'ils saisissent le code correspondant dans leur panier.
                                    </p>
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>

            {isStaffModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh] border border-white/20 animate-in zoom-in-95 duration-300">
                        <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Nouvel Employé</h2>
                                <p className="text-xs text-gray-500 mt-1">Créez un accès sécurisé pour votre équipe.</p>
                            </div>
                            <button onClick={() => setIsStaffModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-white rounded-xl transition-all"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmitStaff} className="p-6 md:p-8 space-y-5 md:space-y-6 overflow-y-auto custom-scrollbar">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email de l'employé</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#f56b2a] transition-colors" size={18} />
                                    <input
                                        required type="email"
                                        value={newStaffEmail}
                                        onChange={e => setNewStaffEmail(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none transition-all shadow-inner"
                                        placeholder="exemple@boutique.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Mot de passe provisoire</label>
                                <div className="relative group">
                                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#f56b2a] transition-colors" size={18} />
                                    <input
                                        required type="password"
                                        value={newStaffPassword}
                                        onChange={e => setNewStaffPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none transition-all shadow-inner"
                                        placeholder="Min 6 caractères"
                                    />
                                </div>
                            </div>

                            {stores.length > 1 && (
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Attribuer à la boutique</label>
                                    <div className="relative group">
                                        <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#f56b2a] transition-colors" size={18} />
                                        <select
                                            value={selectedStoreId}
                                            onChange={e => setSelectedStoreId(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black focus:ring-4 focus:ring-[#f56b2a]/10 focus:bg-white outline-none appearance-none cursor-pointer transition-all shadow-inner"
                                        >
                                            {stores.map(s => <option key={s.id} value={s.id}>{s.settings.name}</option>)}
                                        </select>
                                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 rotate-90 pointer-events-none" size={18} />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Niveau d'accès (Rôle)</label>
                                <div className="p-4 bg-orange-50 border-2 border-[#f56b2a] rounded-2xl flex items-center justify-between shadow-lg shadow-orange-100/50">
                                    <div>
                                        <span className="font-black text-sm text-[#f56b2a]">VENDEUR (SELLER)</span>
                                        <p className="text-[10px] text-[#f56b2a]/70 font-bold mt-0.5">Accès au POS, commandes et inventaire.</p>
                                    </div>
                                    <ShieldCheck size={24} className="text-[#f56b2a]" />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-6">
                                <button
                                    type="button" onClick={() => setIsStaffModalOpen(false)}
                                    className="flex-grow py-4 border-2 border-gray-100 rounded-2xl font-black text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all active:scale-95"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit" disabled={isSubmittingStaff}
                                    className="flex-grow py-4 bg-[#f56b2a] text-white font-black rounded-2xl shadow-2xl shadow-orange-100 hover:bg-[#d55a20] disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {isSubmittingStaff ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                    {isSubmittingStaff ? 'Création...' : 'Valider'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsView;
