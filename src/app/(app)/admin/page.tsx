import AdminView from '@/views/AdminView';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Administration Suprême | POS Senegal',
  description: 'Gérez l\'ensemble de la plateforme POS Senegal.',
};

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Double security check for Super Admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_super_admin) {
    // If not super admin, redirect to dashboard or home
    redirect('/dashboard');
  }

  return <AdminView />;
}
