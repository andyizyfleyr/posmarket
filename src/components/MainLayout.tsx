'use client';
import React from 'react';
import { useRouter } from '@/components/RouterPolyfill';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import Toast from './Toast';
import Loader from './Loader';
import { 
  Lock, ArrowRight, Clock, Ban, Mail, Phone, 
  MapPin, FileText, Save, CheckCircle2, 
  ChevronRight, Info
} from 'lucide-react';
import { updateStoreSettingsAction } from '@/app/actions/settings';
import {
  ViewType,
  StaffRole,
  StoreData,
  SubscriptionPlan,
  UserSubscription,
  ToastNotification,
  NotificationType
} from '@/types';

interface MainLayoutProps {
  children: React.ReactNode;
  currentUserRole: StaffRole;
  currentView: ViewType;
  isSubscriptionValid: boolean;
  onViewChange: (view: ViewType) => void;
  onLogout: () => Promise<void>;
  stores: StoreData[];
  currentStore: StoreData;
  currentPlan: SubscriptionPlan;
  onStoreChange: (id: string) => void;
  onCreateStore: (name: string, businessType: string) => Promise<void>;
  onDeleteStore: (id: string) => Promise<void>;
  userEmail?: string;
  userSubscription: UserSubscription;
  isOnline: boolean;
  toastNotifications: ToastNotification[];
  removeToast: (id: string) => void;
  isSaving: boolean;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  currentUserRole,
  currentView,
  isSubscriptionValid,
  onViewChange,
  onLogout,
  stores,
  currentStore,
  currentPlan,
  onStoreChange,
  onCreateStore,
  onDeleteStore,
  userEmail,
  userSubscription,
  isOnline,
  toastNotifications,
  removeToast,
  isSaving
}) => {
  const router = useRouter();
  
  // State for the verification form
  const [formData, setFormData] = React.useState({
    email: '',
    phone: '',
    address: '',
    description: ''
  });
  const [isSavingForm, setIsSavingForm] = React.useState(false);
  const [activeStep, setActiveStep] = React.useState(1);

  React.useEffect(() => {
    setActiveStep(1);
    if (currentStore && currentStore.status === 'PENDING') {
      setFormData({
        email: currentStore.settings?.email || '',
        phone: currentStore.settings?.phone || '',
        address: currentStore.settings?.address || '',
        description: currentStore.settings?.description || ''
      });
    }
  }, [currentStore]);

  const handleUpdateStoreInfo = async () => {
    if (!currentStore) return;
    setIsSavingForm(true);
    try {
      const result = await updateStoreSettingsAction(currentStore.id, {
        ...currentStore.settings,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        description: formData.description
      });
      if (result.success) {
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to update store info:', err);
    } finally {
      setIsSavingForm(false);
    }
  };

  // Redirect SELLER away from restricted views
  if (currentUserRole === 'SELLER' && ['settings', 'reports'].includes(currentView)) {
    router.replace('/dashboard');
    return null;
  }

  if (currentView !== 'subscription' && !isSubscriptionValid) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 text-center min-h-screen">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-[#f56b2a]"></div>
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Lock size={36} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Abonnement Requis</h2>
          <p className="text-slate-500 mb-8 font-medium">Un abonnement Pro ou Entreprise est désormais <span className="text-red-500 font-bold">obligatoire</span> pour utiliser le Point de Vente et gérer votre commerce. Veuillez choisir une formule pour activer votre compte.</p>
          <button
            onClick={() => { window.location.href = '/subscription'; }}
            className="w-full bg-[#f56b2a] hover:bg-[#d55a20] text-white font-black py-4 px-6 rounded-xl transition-all shadow-lg shadow-orange-200 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Voir les offres <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  const isInfoComplete = !!(
    currentStore?.settings?.email && 
    currentStore?.settings?.phone && 
    currentStore?.settings?.address && 
    (currentStore?.description || currentStore?.settings?.description)
  );

  // Verification Blocking Screen
  if (currentStore && (currentStore.status === 'PENDING' || currentStore.status === 'REJECTED') && currentView !== 'settings' && currentView !== 'admin' && currentView !== 'subscription') {
      const isRejected = currentStore.status === 'REJECTED';
      return (
         <div className="flex-1 flex flex-col items-center justify-start pt-[10vh] px-4 bg-[#fcfdfe] text-left min-h-screen overflow-y-auto selection:bg-orange-100 selection:text-[#f56b2a] relative">
             {/* Background Elements */}
             <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-50/50 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-50/80 rounded-full blur-[100px]" />
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#f56b2a 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>
             </div>

             <div className="max-w-md w-full relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-white p-8 md:p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100">
                 {/* Identity & Status */}
                 <div className="flex items-center gap-4 mb-10">
                    <div className={`w-12 h-12 flex items-center justify-center rounded-xl border ${isRejected ? 'bg-red-50 border-red-100 text-red-500' : 'bg-orange-50 border-orange-100 text-[#f56b2a]'}`}>
                        {isRejected ? <Ban size={20} strokeWidth={2.5} /> : <Clock size={20} strokeWidth={2.5} />}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-2">
                            {isRejected ? 'Boutique Refusée' : 'Vérification de compte'}
                        </h1>
                        <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${isRejected ? 'bg-red-500' : 'bg-[#f56b2a] animate-pulse'}`} />
                            <span className="text-[10px] font-bold text-[#f56b2a] uppercase tracking-widest">
                                Statut : {isRejected ? 'Refusée' : 'En examen'}
                            </span>
                        </div>
                    </div>
                 </div>

                 {/* Message */}
                 <div className="mb-12">
                    <p className="text-[13px] text-slate-500 font-medium leading-relaxed">
                        {isRejected ? (
                            <>Votre boutique <span className="text-slate-900 font-bold">"{currentStore.name || 'Sans nom'}"</span> n'a pas pu être activée après examen de nos services de sécurité.</>
                        ) : (
                            <>Bienvenue, <span className="text-slate-900 font-bold">"{currentStore.name || 'Sans nom'}"</span>. Votre boutique est en cours de validation. Pour accélérer le processus, veuillez compléter les informations ci-dessous.</>
                        )}
                    </p>
                 </div>

                 {!isRejected && !isInfoComplete && (
                    <div className="space-y-6 animate-in fade-in duration-700">
                        {/* Step Indicator */}
                        <div className="flex items-center gap-1.5 mb-8">
                            {[1, 2, 3, 4].map((step) => (
                                <div 
                                    key={step} 
                                    className={`h-1 flex-1 rounded-full transition-all duration-500 ${step <= activeStep ? 'bg-[#f56b2a]' : 'bg-slate-100'}`} 
                                />
                            ))}
                        </div>

                        {activeStep === 1 && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                                <label className="text-[11px] font-bold text-slate-900 flex items-center gap-2">Email professionnel</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#f56b2a] transition-colors"><Mail size={14} /></div>
                                    <input 
                                        type="email"
                                        className="w-full h-12 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#f56b2a]/10 focus:border-[#f56b2a] outline-none transition-all"
                                        placeholder="contact@boutique.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        {activeStep === 2 && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                                <label className="text-[11px] font-bold text-slate-900 flex items-center gap-2">Numéro WhatsApp</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#f56b2a] transition-colors"><Phone size={14} /></div>
                                    <input 
                                        type="tel"
                                        className="w-full h-12 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#f56b2a]/10 focus:border-[#f56b2a] outline-none transition-all"
                                        placeholder="221..."
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        {activeStep === 3 && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                                <label className="text-[11px] font-bold text-slate-900 flex items-center gap-2">Pays de résidence</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#f56b2a] transition-colors"><MapPin size={14} /></div>
                                    <select 
                                        className="w-full h-12 pl-10 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#f56b2a]/10 focus:border-[#f56b2a] outline-none transition-all appearance-none cursor-pointer"
                                        value={formData.address}
                                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                    >
                                        <option value="">Sélectionner un pays</option>
                                        <option value="Sénégal">Sénégal</option>
                                        <option value="Bénin">Bénin</option>
                                        <option value="Côte d'Ivoire">Côte d'Ivoire</option>
                                        <option value="Togo">Togo</option>
                                        <option value="Cameroun">Cameroun</option>
                                    </select>
                                    <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        )}

                        {activeStep === 4 && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                                <label className="text-[11px] font-bold text-slate-900 flex items-center gap-2">Description courte</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#f56b2a] transition-colors"><FileText size={14} /></div>
                                    <input 
                                        type="text"
                                        className="w-full h-12 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#f56b2a]/10 focus:border-[#f56b2a] outline-none transition-all"
                                        placeholder="Votre activité..."
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            {activeStep > 1 && (
                                <button 
                                    onClick={() => setActiveStep(prev => prev - 1)}
                                    className="px-6 h-12 rounded-xl font-bold text-[13px] border border-slate-200 text-slate-400 hover:bg-slate-50 transition-all"
                                >
                                    Retour
                                </button>
                            )}
                            {activeStep < 4 ? (
                                <button 
                                    onClick={() => setActiveStep(prev => prev + 1)}
                                    className="flex-1 h-12 rounded-xl font-bold text-[13px] bg-slate-900 text-white hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    Suivant <ArrowRight size={16} />
                                </button>
                            ) : (
                                <button 
                                    onClick={async () => {
                                        await handleUpdateStoreInfo();
                                        setTimeout(() => { window.location.reload(); }, 1500);
                                    }}
                                    disabled={isSavingForm}
                                    className={`flex-1 h-12 rounded-xl font-bold text-[13px] transition-all flex items-center justify-center gap-2 ${isSavingForm ? 'bg-[#f56b2a]/50' : 'bg-[#f56b2a] text-white hover:bg-[#d55a20] shadow-lg shadow-orange-100'}`}
                                >
                                    {isSavingForm ? <Loader size="sm" /> : <Save size={16} />}
                                    Finaliser
                                </button>
                            )}
                        </div>
                    </div>
                 )}

                 {isInfoComplete && !isRejected && (
                     <div className="bg-orange-50/30 rounded-xl p-8 border border-orange-100 text-left space-y-4 animate-in zoom-in-95 duration-500">
                         <div className="flex items-center gap-3">
                             <CheckCircle2 size={18} className="text-[#f56b2a]" strokeWidth={2.5} />
                             <h3 className="text-sm font-bold text-[#f56b2a]">Dossier finalisé</h3>
                         </div>
                         <p className="text-[#f56b2a]/80 text-[13px] font-medium leading-relaxed italic">
                            Informations bien reçues. Votre boutique apparaîtra sur la marketplace dès sa validation par un modérateur.
                         </p>
                         
                         <div className="pt-4 border-t border-orange-100 mt-4">
                            <button 
                                onClick={() => { onViewChange('settings'); }} 
                                className="w-full h-11 rounded-lg font-bold text-[11px] uppercase tracking-widest bg-[#f56b2a] text-white hover:bg-[#d55a20] shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-2 group"
                            >
                                Paramètres complets <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                         </div>
                     </div>
                 )}

                 {/* Footer Info */}
                 {!isRejected && (
                    <div className="pt-8 mt-12 border-t border-slate-100 flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-[#f56b2a] rounded-full animate-ping" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                Validation estimée sous : <span className="text-slate-900 border-b border-[#f56b2a] pb-0.5">12 Heures</span>
                            </p>
                        </div>
                    </div>
                 )}
             </div>
         </div>
      );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden relative">
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-4 pointer-events-none items-end">
        {toastNotifications.map(notif => (
          <Toast key={notif.id} notification={notif} onRemove={removeToast} />
        ))}
      </div>

      <Sidebar
        currentView={currentView}
        onViewChange={onViewChange}
        onLogout={onLogout}
        userRole={currentUserRole}
        businessType={currentStore?.business_type}
      />

      <div className="flex flex-col flex-grow overflow-hidden relative w-full">
        {currentView !== 'admin' && (
          <Navbar
            currentView={currentView}
            onViewChange={onViewChange}
            stores={stores}
            currentStore={currentStore}
            currentPlan={currentPlan}
            onStoreChange={onStoreChange}
            onCreateStore={onCreateStore}
            onDeleteStore={onDeleteStore}
            userEmail={userEmail}
            userSubscription={userSubscription}
            isOnline={isOnline}
            userRole={currentUserRole}
            onLogout={onLogout}
          />
        )}
        <main className="flex-grow overflow-hidden flex flex-col bg-white pb-16 md:pb-0 relative">
          <div key={currentView} className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            {children}
          </div>
        </main>
      </div>

      <BottomNav currentView={currentView} onViewChange={onViewChange} userRole={currentUserRole} businessType={currentStore?.business_type} />
      {isSaving && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
            <Loader size="lg" />
            <p className="text-sm font-black text-slate-800 uppercase tracking-widest">Enregistrement...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
