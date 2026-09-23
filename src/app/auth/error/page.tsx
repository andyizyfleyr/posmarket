import { ShieldAlert, Link2Off, KeyRound, Lock } from 'lucide-react';

interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { error } = await searchParams;
  const code = error || 'Default';

  const config: Record<string, { icon: typeof ShieldAlert; title: string; message: string }> = {
    Verification: {
      icon: Link2Off,
      title: 'Lien invalide ou expiré',
      message:
        'Ce lien de connexion a déjà été utilisé ou a expiré. Pour votre sécurité, chaque lien ne fonctionne qu’une seule fois et pendant 10 minutes. Lancez simplement une nouvelle connexion pour recevoir un lien tout neuf.',
    },
    AccessDenied: {
      icon: Lock,
      title: 'Accès refusé',
      message: 'Vous n’avez pas l’autorisation d’accéder à cette page.',
    },
    Configuration: {
      icon: KeyRound,
      title: 'Problème de configuration',
      message: 'Une erreur de configuration est survenue. Merci de réessayer dans quelques instants.',
    },
    Default: {
      icon: ShieldAlert,
      title: 'Une erreur est survenue',
      message: 'Nous n’avons pas pu terminer la connexion. Merci de réessayer.',
    },
  };

  const { icon: Icon, title, message } = config[code] ?? config.Default;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 font-sans">
      <div className="max-w-[440px] w-full text-center space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#002f34]">
          lebon<span className="text-[#f56b2a]">coin</span>
        </h1>

        <div className="bg-orange-50 rounded-3xl p-8 space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#f56b2a]/10 flex items-center justify-center">
            <Icon className="w-7 h-7 text-[#f56b2a]" />
          </div>
          <h2 className="text-xl font-bold text-[#002f34]">{title}</h2>
          <p className="text-sm text-[#002f34]/70 leading-relaxed">{message}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/login"
            className="flex-1 inline-flex items-center justify-center px-6 py-3.5 text-sm font-bold bg-[#f56b2a] text-white rounded-full hover:bg-[#e55a1b] transition-all shadow-md shadow-orange-100"
          >
            Se connecter à nouveau
          </a>
          <a
            href="/"
            className="flex-1 inline-flex items-center justify-center px-6 py-3.5 text-sm font-bold bg-white text-gray-900 border border-gray-100 rounded-full hover:bg-gray-50 transition-all shadow-sm"
          >
            Retour à l’accueil
          </a>
        </div>
      </div>
    </div>
  );
}