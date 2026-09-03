import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';

export const metadata = {
  title: 'Administration | POS Senegal',
  description: 'Espace d\'administration de la plateforme POS Senegal.',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data } = await supabase
    .from('profiles')
    .select('is_super_admin, full_name, email, avatar_url')
    .eq('id', user.id)
    .single();
  const profile = (data as { is_super_admin: boolean; full_name: string | null; email: string | null; avatar_url: string | null } | null) ?? null;

  if (!profile?.is_super_admin) {
    redirect('/dashboard');
  }

  return (
    <AdminShell
      userName={profile.full_name || profile.email || 'Admin'}
      userEmail={profile.email || ''}
    >
      {children}
    </AdminShell>
  );
}
