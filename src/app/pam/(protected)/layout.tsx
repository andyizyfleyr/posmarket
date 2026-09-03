import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import { getAdminSession } from '@/app/actions/admin-auth';

export const metadata = {
  title: 'Administration | POS Senegal',
  description: 'Espace d\'administration de la plateforme POS Senegal.',
};

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    redirect('/pam/login');
  }

  return (
    <AdminShell
      userName={session.displayName || session.username}
      userEmail={session.email}
    >
      {children}
    </AdminShell>
  );
}
