/**
 * Modale de connexion acheteur — copie fidèle de la modale du web
 * (`StorefrontView`, « Connexion / Inscription ») : poignée, croix de
 * fermeture, sélecteur d'onglets, titres, champs avec icônes, bouton
 * d'envoi et écran « Vérifiez votre email ».
 */

import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, MailCheck, User, X } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { useToast } from '@/components/ToastProvider';
import { COLORS } from '@/theme';

type AuthMode = 'login' | 'register';

interface AuthModalProps {
  visible: boolean;
  mode: AuthMode;
  submitting: boolean;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onSubmit: (input: {
    email: string;
    name?: string;
    mode: AuthMode;
  }) => Promise<{ ok: boolean; sent?: boolean; error?: string }>;
}

export function AuthModal({
  visible,
  mode,
  submitting,
  onModeChange,
  onClose,
  onSubmit,
}: AuthModalProps) {
  const insets = useSafeAreaInsets();
  const { notify } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);

  // Chaque ouverture repart d'un formulaire vierge (ajustement pendant le
  // rendu : évite un effet qui déclencherait un rendu en cascade).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setSent(false);
      setName('');
      setEmail('');
    }
  }

  const handleSubmit = useCallback(async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      notify('Veuillez saisir une adresse email valide', 'error');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      notify('Veuillez saisir votre nom complet', 'error');
      return;
    }
    const res = await onSubmit({ email: cleanEmail, name: name.trim(), mode });
    if (!res.ok) {
      notify(res.error || "Erreur d'authentification", 'error');
      return;
    }
    if (res.sent) {
      setSent(true);
      notify(
        'Un lien de connexion a été envoyé à votre email. Cliquez dessus pour terminer.',
        'success',
      );
      return;
    }
    // Session obtenue immédiatement : la modale se referme.
    notify('Connexion réussie', 'success');
    onClose();
  }, [email, mode, name, notify, onClose, onSubmit]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Fermer la connexion"
        />

        <View style={styles.sheet}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={8}
            accessibilityLabel="Fermer"
          >
            <X size={18} color="#4B5563" />
          </Pressable>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, 24) },
            ]}
          >
            {sent ? (
              <View style={styles.sentWrap}>
                <View style={styles.sentIcon}>
                  <MailCheck size={28} color="#16A34A" />
                </View>
                <Text style={styles.title}>Vérifiez votre email</Text>
                <Text style={styles.subtitle}>
                  Un lien {mode === 'login' ? 'de connexion' : 'd’activation'} a été envoyé à{' '}
                  <Text style={styles.subtitleStrong}>{email.trim().toLowerCase()}</Text>. Cliquez
                  dessus pour {mode === 'login' ? 'vous connecter' : 'activer votre compte'}.
                </Text>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={() => setSent(false)}
                  style={styles.sentBtn}
                >
                  Envoyer un autre lien
                </Button>
                <Button
                  size="lg"
                  fullWidth
                  onPress={() => {
                    onClose();
                    setSent(false);
                    setName('');
                    setEmail('');
                  }}
                >
                  Fermer
                </Button>
              </View>
            ) : (
              <>
                <View style={styles.tabsWrap}>
                  <View style={styles.tabs}>
                    {(['login', 'register'] as const).map((value) => {
                      const isActive = mode === value;
                      return (
                        <Pressable
                          key={value}
                          onPress={() => {
                            onModeChange(value);
                            setSent(false);
                          }}
                          style={[styles.tab, isActive && styles.tabActive]}
                        >
                          <Text
                            style={[styles.tabText, isActive && styles.tabTextActive]}
                          >
                            {value === 'login' ? 'Connexion' : 'Inscription'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.headings}>
                  <Text style={styles.title}>
                    {mode === 'login' ? 'Ravi de vous revoir !' : 'Bienvenue parmi nous'}
                  </Text>
                  <Text style={styles.subtitleSmall}>
                    {mode === 'login'
                      ? 'Connectez-vous pour continuer vos achats.'
                      : 'Créez votre compte en quelques secondes.'}
                  </Text>
                </View>

                <View style={styles.form}>
                  {mode === 'register' && (
                    <View>
                      <Text style={styles.label}>Nom complet</Text>
                      <View style={styles.field}>
                        <User size={18} color="#9CA3AF" />
                        <TextInput
                          value={name}
                          onChangeText={setName}
                          placeholder="Votre nom et prénom"
                          placeholderTextColor="#9CA3AF"
                          autoComplete="name"
                          style={styles.input}
                        />
                      </View>
                    </View>
                  )}

                  <View>
                    <Text style={styles.label}>Adresse email</Text>
                    <View style={styles.field}>
                      <Mail size={18} color="#9CA3AF" />
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="exemple@email.com"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        onSubmitEditing={handleSubmit}
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <Button
                    size="lg"
                    fullWidth
                    loading={submitting}
                    loadingText="Envoi du lien..."
                    onPress={handleSubmit}
                    style={styles.submitBtn}
                  >
                    {mode === 'login' ? 'Recevoir le lien de connexion' : 'Créer mon compte'}
                  </Button>

                  <Text style={styles.note}>
                    En continuant, vous acceptez nos conditions d’utilisation et notre politique de
                    confidentialité.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,47,52,0.6)',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    overflow: 'hidden',
    elevation: 20,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(243,244,246,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 4,
  },

  // Onglets
  tabsWrap: {
    marginTop: 12,
    marginBottom: 24,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  tabTextActive: {
    color: COLORS.ink,
  },

  // Titres
  headings: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  subtitleStrong: {
    fontWeight: '700',
    color: '#374151',
  },
  subtitleSmall: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Formulaire
  form: {
    gap: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    paddingLeft: 16,
    paddingRight: 16,
    minHeight: 54,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 12,
    paddingVertical: 14,
    fontSize: 16,
    color: '#374151',
  },
  submitBtn: {
    marginTop: 8,
  },
  note: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 17,
  },

  // Écran « lien envoyé »
  sentWrap: {
    alignItems: 'center',
    paddingTop: 24,
  },
  sentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sentBtn: {
    marginBottom: 12,
  },
});

export default AuthModal;
