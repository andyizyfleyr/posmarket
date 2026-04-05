'use client';

import { AuthView } from '@/views/AuthView';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  return (
    <AuthView 
      onLogin={() => router.push('/dashboard')} 
      notify={(msg, type) => console.log('Login notify:', msg, type)}
    />
  );
}
