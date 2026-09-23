'use client';
import React, { useState } from 'react';
import { Mail, Store, ShoppingCart, Zap, Car, Shirt, Tent, Briefcase, BookOpen, Heart, MailCheck } from 'lucide-react';
import { loginAction, signupAction } from '@/app/actions/auth';
import { NotificationType } from '@/types';
import Button from '@/components/Button';

interface AuthViewProps {
    onLogin: (user: unknown) => void;
    notify: (message: string, type: NotificationType, title?: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ notify }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [sentEmail, setSentEmail] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSentEmail(null);
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('email', email);
            if (!isLogin) formData.append('name', name);

            if (isLogin) {
                if (!email) throw new Error('Veuillez saisir votre adresse email');
            } else {
                if (!email || !name) throw new Error('Veuillez remplir tous les champs');
            }

            const result = isLogin ? await loginAction(formData) : await signupAction(formData);

            if (result && 'error' in result && result.error) {
                setErrorMsg(result.error);
                setLoading(false);
                return;
            }

            setLoading(false);
            setEmail('');
            setName('');
            setSentEmail((result as { email?: string })?.email || email);
            notify(
                'Un lien de connexion a été envoyé à votre adresse email. Vérifiez votre boîte mail.',
                'success',
                'Vérifiez votre email',
            );
        } catch (error: unknown) {
            const e = error as { message?: unknown } | null;
            if (e && e.message === 'NEXT_REDIRECT') throw error;
            setErrorMsg(typeof e?.message === 'string' ? e.message : 'Une erreur est survenue');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex font-sans overflow-hidden">
            {/* Left Side: Auth Form */}
            <div className="w-full lg:w-[45%] flex flex-col justify-center px-6 sm:px-12 md:px-20 lg:px-24">
                <div className="max-w-[400px] w-full mx-auto lg:mx-0">
                    {/* Header Logo for Mobile */}
                    <div className="mb-10 lg:hidden text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-[#002f34]">
                            lebon<span className="text-[#f56b2a]">coin</span>
                        </h1>
                    </div>

                    <h1 className="text-[28px] md:text-[34px] font-bold text-[#002f34] leading-tight mb-12">
                        {isLogin ? 'Connectez-vous' : 'Créez votre compte'}
                    </h1>

                    {sentEmail ? (
                        <div className="space-y-6">
                            <div className="bg-green-50 text-green-700 p-5 rounded-2xl border border-green-100 flex flex-col items-center text-center space-y-3">
                                <MailCheck className="w-10 h-10 text-green-600" />
                                <p className="text-sm font-semibold">Lien de connexion envoyé</p>
                                <p className="text-xs text-green-600">
                                    Cliquez sur le lien reçu à <span className="font-bold">{sentEmail}</span> pour
                                    {isLogin ? ' vous connecter' : ' activer votre compte commerçant'}.
                                </p>
                            </div>
                            <Button
                                onClick={() => setSentEmail(null)}
                                fullWidth
                                size="lg"
                                variant="secondary"
                            >
                                Envoyer un autre lien
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {errorMsg && (
                                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-semibold border border-red-100 animate-in shake duration-500">
                                    {errorMsg}
                                </div>
                            )}

                            {!isLogin && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-sm font-normal text-[#002f34]">
                                        Nom complet *
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-3 border border-[#8c8c8c] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a] transition-all text-[#002f34] font-normal text-sm"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-normal text-[#002f34]">
                                    E-mail *
                                </label>
                                <input
                                    required
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 border border-[#8c8c8c] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a] transition-all text-[#002f34] font-normal text-sm"
                                />
                            </div>

                            <Button
                                type="submit"
                                loading={loading}
                                loadingText={isLogin ? 'Envoi du lien...' : 'Envoi du lien...'}
                                fullWidth
                                size="lg"
                                className="rounded-full"
                            >
                                <Mail className="w-4 h-4 mr-2" />
                                Continuer
                            </Button>
                        </form>
                    )}

                    {!sentEmail && (
                    <div className="mt-6 text-center text-[#002f34]">
                        <p className="text-sm font-normal">
                            {isLogin ? "Vous n'avez pas encore de compte ?" : "Vous avez déjà un compte ?"}
                            <button
                                onClick={() => { setIsLogin(!isLogin); setSentEmail(null); setErrorMsg(''); }}
                                className="ml-2 font-semibold text-[#4183d7] hover:underline"
                            >
                                {isLogin ? "Inscrivez-vous" : "Connectez-vous"}
                            </button>
                        </p>
                    </div>
                    )}

                </div>
            </div>

            {/* Right Side: Decorative Illustration Grid */}
            <div className="hidden lg:flex w-[55%] bg-[#F5F7F8] p-12 items-center justify-center">
                <div className="grid grid-cols-3 grid-rows-3 gap-6 w-full max-w-[800px] aspect-square">
                    {[
                        { color: '#E7D6F3', icon: <Store className="w-12 h-12 text-[#9B69B9]" />, delay: '0ms' },
                        { color: '#D1F5F5', icon: <ShoppingCart className="w-12 h-12 text-[#3D9191]" />, delay: '100ms' },
                        { color: '#FCE6D6', icon: <Zap className="w-12 h-12 text-[#E67E22]" />, delay: '200ms' },
                        { color: '#FDE2E4', icon: <Car className="w-12 h-12 text-[#E74C3C]" />, delay: '150ms' },
                        { color: '#FFF9E1', icon: <div className="w-16 h-12 bg-[#F1C40F] rounded-lg relative"><div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-[#F1C40F] opacity-50"></div></div>, delay: '250ms' },
                        { color: '#E2E8F0', icon: <Shirt className="w-12 h-12 text-[#34495E]" />, delay: '350ms' },
                        { color: '#FEF9E7', icon: <Tent className="w-12 h-12 text-[#27AE60]" />, delay: '200ms' },
                        { color: '#D1E9F6', icon: <Briefcase className="w-12 h-12 text-[#2980B9]" />, delay: '300ms' },
                        { color: '#E8E8FF', icon: <BookOpen className="w-12 h-12 text-[#5D5DFF]" />, delay: '400ms' },
                    ].map((card, idx) => (
                        <div
                            key={idx}
                            style={{ backgroundColor: card.color, animationDelay: card.delay }}
                            className="rounded-[40px] relative flex items-center justify-center shadow-sm overflow-hidden animate-in zoom-in duration-700 fill-mode-both"
                        >
                            <div className="absolute top-6 right-6 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                                <Heart size={18} className="text-gray-300" />
                            </div>
                            <div className="transform scale-110 md:scale-125 lg:scale-150">
                                {card.icon}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};