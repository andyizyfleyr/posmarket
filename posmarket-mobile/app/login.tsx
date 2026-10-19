/**
 * Connexion vendeur — copie fidèle de `src/views/AuthView.tsx` du web
 * (page `/login`) à largeur mobile : logo « leboncoin », titre, champs
 * « Nom complet * » / « E-mail * », bouton « Continuer » et écran
 * « Lien de connexion envoyé ».
 *
 * Comme pour l'acheteur, le lien magique est échangé immédiatement côté
 * serveur contre le cookie de session : l'app se connecte sans quitter
 * l'écran (le repli e-mail reste géré).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, MailCheck } from 'lucide-react-native';
import { fetchSellerBootstrap, loginSeller } from '@/api/seller';
import { loadSession, saveSession } from '@/api/session';
import { Button } from '@/components/Button';
import { ToastViewport, useToast } from '@/components/ToastProvider';
import { COLORS } from '@/theme';

export default function SellerLoginScreen() {
  const insets = useSafeAreaInsets();
  const { notify } = useToast();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  // Déjà connecté en vendeur : direction le tableau de bord (comme le web).
  useEffect(() => {
    let active = true;
    (async () => {
      const session = await loadSession();
      if (!session) return;
      const res = await fetchSellerBootstrap().catch(() => null);
      if (active && res?.success) {
        router.replace('/seller/dashboard');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (isLogin) {
      if (!cleanEmail) {
        setErrorMsg('Veuillez saisir votre adresse email');
        return;
      }
    } else if (!cleanEmail || !cleanName) {
      setErrorMsg('Veuillez remplir tous les champs');
      return;
    }

    setErrorMsg('');
    setSentEmail(null);
    setLoading(true);
    try {
      const res = await loginSeller({
        email: cleanEmail,
        name: isLogin ? undefined : cleanName,
        mode: isLogin ? 'login' : 'register',
      });

      if (!res?.success) {
        setErrorMsg(res?.error || 'Une erreur est survenue');
        return;
      }

      if (res.session?.value && res.user) {
        await saveSession(res.session);
        notify('Connexion réussie', 'success');
        router.replace((isLogin ? '/seller/dashboard' : '/seller/subscription') as Href);
        return;
      }

      // Repli : le lien part par e-mail, l'utilisateur clique dessus.
      setEmail('');
      setName('');
      setSentEmail(res.user?.email || cleanEmail);
      notify(
        'Un lien de connexion a été envoyé à votre adresse email. Vérifiez votre boîte mail.',
        'success',
        'Vérifiez votre email',
      );
    } catch {
      setErrorMsg(
        'Connexion impossible. Vérifiez votre connexion Internet puis réessayez.',
      );
    } finally {
      setLoading(false);
    }
  }, [email, isLogin, name, notify]);

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
          ]}
        >
          <View style={styles.inner}>
            {/* Logo mobile (le web l'affiche uniquement sous lg:) */}
            <View style={styles.logoWrap}>
              <Text style={styles.logo}>
                lebon<Text style={styles.logoBrand}>coin</Text>
              </Text>
            </View>

            <Text style={styles.title}>
              {isLogin ? 'Connectez-vous' : 'Créez votre compte'}
            </Text>

            {sentEmail ? (
              <View style={styles.sentWrap}>
                <View style={styles.sentCard}>
                  <MailCheck size={40} color="#16A34A" />
                  <Text style={styles.sentTitle}>Lien de connexion envoyé</Text>
                  <Text style={styles.sentText}>
                    Cliquez sur le lien reçu à{' '}
                    <Text style={styles.sentStrong}>{sentEmail}</Text> pour
                    {isLogin ? ' vous connecter' : ' activer votre compte commerçant'}.
                  </Text>
                </View>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={() => setSentEmail(null)}
                >
                  Envoyer un autre lien
                </Button>
              </View>
            ) : (
              <>
                <View style={styles.form}>
                  {errorMsg ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}

                  {!isLogin && (
                    <View>
                      <Text style={styles.label}>Nom complet *</Text>
                      <TextInput
                        value={name}
                        onChangeText={setName}
                        autoComplete="name"
                        style={styles.input}
                      />
                    </View>
                  )}

                  <View>
                    <Text style={styles.label}>E-mail *</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      onSubmitEditing={handleSubmit}
                      style={styles.input}
                    />
                  </View>

                  <Button
                    size="lg"
                    fullWidth
                    loading={loading}
                    loadingText="Envoi du lien..."
                    onPress={handleSubmit}
                    icon={<Mail size={16} color="#FFFFFF" />}
                    style={styles.submitBtn}
                  >
                    Continuer
                  </Button>
                </View>

                <View style={styles.toggleWrap}>
                  <Text style={styles.toggleText}>
                    {isLogin
                      ? "Vous n'avez pas encore de compte ?"
                      : 'Vous avez déjà un compte ?'}
                    <Text
                      onPress={() => {
                        setIsLogin(!isLogin);
                        setSentEmail(null);
                        setErrorMsg('');
                      }}
                      style={styles.toggleLink}
                    >
                      {isLogin ? 'Inscrivez-vous' : 'Connectez-vous'}
                    </Text>
                  </Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ToastViewport />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  inner: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  logoWrap: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: COLORS.ink,
  },
  logoBrand: {
    color: COLORS.brand,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.ink,
    lineHeight: 34,
    marginBottom: 48,
  },

  form: {
    gap: 24,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  label: {
    fontSize: 14,
    color: COLORS.ink,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#8C8C8C',
    borderRadius: 16,
    fontSize: 14,
    color: COLORS.ink,
    backgroundColor: '#FFFFFF',
  },
  submitBtn: {
    borderRadius: 999,
  },

  toggleWrap: {
    marginTop: 24,
    alignItems: 'center',
  },  toggleText: {
    fontSize: 14,
    color: COLORS.ink,
  },
  toggleLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4183D7',
  },

  sentWrap: {
    gap: 24,
  },
  sentCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  sentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803D',
  },
  sentText: {
    fontSize: 12,
    color: '#16A34A',
    textAlign: 'center',
    lineHeight: 18,
  },
  sentStrong: {
    fontWeight: '700',
    color: '#15803D',
  },
});
