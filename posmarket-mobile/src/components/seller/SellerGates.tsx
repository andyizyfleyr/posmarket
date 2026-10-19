/**
 * Écrans de blocage de l'espace vendeur — copie fidèle de `MainLayout.tsx`
 * (web) aux largeurs mobiles :
 * - « Abonnement Requis » (aucun abonnement actif) ;
 * - « Vérification de compte » / « Boutique Refusée » (statut PENDING/REJECTED)
 *   avec le parcours en 4 étapes et son état « Dossier finalisé ».
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Mail,
  Save,
} from 'lucide-react-native';
import { COLORS } from '@/theme';
import { PhoneField } from '@/components/PhoneField';
import type { SellerStore } from '@/api/seller';

interface SubscriptionRequiredProps {
  onSeeOffers: () => void;
}

export function SubscriptionRequired({ onSeeOffers }: SubscriptionRequiredProps) {
  return (
    <View style={styles.subScreen}>
      <View style={styles.subCard}>
        <LinearGradient
          colors={['#EF4444', COLORS.brand]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.subTopBar}
        />
        <View style={styles.subIconCircle}>
          <Lock size={36} color="#EF4444" />
        </View>
        <Text style={styles.subTitle}>Abonnement Requis</Text>
        <Text style={styles.subText}>
          Un abonnement est désormais{' '}
          <Text style={styles.subTextStrong}>obligatoire</Text> pour utiliser le Point de Vente
          et gérer votre commerce. Veuillez choisir une formule pour activer votre compte.
        </Text>
        <Pressable onPress={onSeeOffers} style={styles.subButton}>
          <Text style={styles.subButtonText}>Voir les offres</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

interface StoreVerificationProps {
  store: SellerStore;
  /** Informations de la boutique déjà complètes ? */
  infoComplete: boolean;
  saving: boolean;
  onSave: (fields: {
    email: string;
    phone: string;
    address: string;
    description: string;
  }) => Promise<void>;
  onOpenSettings: () => void;
}

export function StoreVerification({
  store,
  infoComplete,
  saving,
  onSave,
  onOpenSettings,
}: StoreVerificationProps) {
  const isRejected = store.status === 'REJECTED';
  const [activeStep, setActiveStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    address: '',
    description: '',
  });

  useEffect(() => {
    setActiveStep(1);
    if (store && store.status === 'PENDING') {
      setFormData({
        email: String(store.settings?.email || ''),
        phone: String(store.settings?.phone || ''),
        address: String(store.settings?.address || ''),
        description: String(store.settings?.description || ''),
      });
    }
  }, [store]);

  const handleFinalize = useCallback(() => {
    void onSave(formData);
  }, [formData, onSave]);

  return (
    <View style={styles.verifScreen}>
      <ScrollView
        contentContainerStyle={styles.verifScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.verifCard}>
          {/* Identité & statut */}
          <View style={styles.verifHeader}>
            <View
              style={[
                styles.verifIconBox,
                isRejected ? styles.verifIconBoxRejected : styles.verifIconBoxPending,
              ]}
            >
              {isRejected ? (
                <Ban size={20} color="#EF4444" strokeWidth={2.5} />
              ) : (
                <Clock size={20} color={COLORS.brand} strokeWidth={2.5} />
              )}
            </View>
            <View style={styles.verifHeaderText}>
              <Text style={styles.verifTitle}>
                {isRejected ? 'Boutique Refusée' : 'Vérification de compte'}
              </Text>
              <View style={styles.verifStatusRow}>
                <View
                  style={[
                    styles.verifStatusDot,
                    { backgroundColor: isRejected ? '#EF4444' : COLORS.brand },
                  ]}
                />
                <Text style={styles.verifStatusText}>
                  Statut : {isRejected ? 'Refusée' : 'En examen'}
                </Text>
              </View>
            </View>
          </View>

          {/* Message */}
          <View style={styles.verifMessageWrap}>
            <Text style={styles.verifMessage}>
              {isRejected ? (
                <>
                  Votre boutique{' '}
                  <Text style={styles.verifMessageStrong}>
                    “{store.name || 'Sans nom'}”
                  </Text>{' '}
                  n’a pas pu être activée après examen de nos services de sécurité.
                </>
              ) : (
                <>
                  Bienvenue,{' '}
                  <Text style={styles.verifMessageStrong}>
                    “{store.name || 'Sans nom'}”
                  </Text>
                  . Votre boutique est en cours de validation. Pour accélérer le processus,
                  veuillez compléter les informations ci-dessous.
                </>
              )}
            </Text>
          </View>

          {!isRejected && !infoComplete ? (
            <View style={styles.stepsWrap}>
              {/* Indicateur d'étapes */}
              <View style={styles.stepBars}>
                {[1, 2, 3, 4].map((step) => (
                  <View
                    key={step}
                    style={[
                      styles.stepBar,
                      step <= activeStep && styles.stepBarActive,
                    ]}
                  />
                ))}
              </View>

              {activeStep === 1 ? (
                <View style={styles.stepBody}>
                  <Text style={styles.stepLabel}>Email professionnel</Text>
                  <View style={styles.stepField}>
                    <Mail size={14} color="#CBD5E1" />
                    <TextInput
                      value={formData.email}
                      onChangeText={(value) =>
                        setFormData((prev) => ({ ...prev, email: value }))
                      }
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="contact@boutique.com"
                      placeholderTextColor="#94A3B8"
                      style={styles.stepInput}
                    />
                  </View>
                </View>
              ) : null}

              {activeStep === 2 ? (
                <View style={styles.stepBody}>
                  <Text style={styles.stepLabel}>Numéro WhatsApp</Text>
                  <PhoneField
                    value={formData.phone}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, phone: value }))
                    }
                  />
                </View>
              ) : null}

              {activeStep === 3 ? (
                <View style={styles.stepBody}>
                  <Text style={styles.stepLabel}>Pays de résidence</Text>
                  <TextInput
                    value={formData.address}
                    onChangeText={(value) =>
                      setFormData((prev) => ({ ...prev, address: value }))
                    }
                    placeholder="Bénin"
                    placeholderTextColor="#94A3B8"
                    style={styles.stepInputStandalone}
                  />
                </View>
              ) : null}

              {activeStep === 4 ? (
                <View style={styles.stepBody}>
                  <Text style={styles.stepLabel}>Description courte</Text>
                  <View style={styles.stepField}>
                    <FileText size={14} color="#CBD5E1" />
                    <TextInput
                      value={formData.description}
                      onChangeText={(value) =>
                        setFormData((prev) => ({ ...prev, description: value }))
                      }
                      placeholder="Votre activité..."
                      placeholderTextColor="#94A3B8"
                      style={styles.stepInput}
                    />
                  </View>
                </View>
              ) : null}

              <View style={styles.stepActions}>
                {activeStep > 1 ? (
                  <Pressable
                    onPress={() => setActiveStep((prev) => prev - 1)}
                    style={styles.stepBackBtn}
                  >
                    <Text style={styles.stepBackText}>Retour</Text>
                  </Pressable>
                ) : null}
                {activeStep < 4 ? (
                  <Pressable
                    onPress={() => setActiveStep((prev) => prev + 1)}
                    style={styles.stepNextBtn}
                  >
                    <Text style={styles.stepNextText}>Suivant</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleFinalize}
                    disabled={saving}
                    style={[styles.stepNextBtn, styles.stepFinalizeBtn, saving && styles.stepFinalizeSaving]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Save size={16} color="#FFFFFF" />
                    )}
                    <Text style={styles.stepNextText}>Finaliser</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}

          {infoComplete && !isRejected ? (
            <View style={styles.doneCard}>
              <View style={styles.doneHeader}>
                <CheckCircle2 size={18} color={COLORS.brand} strokeWidth={2.5} />
                <Text style={styles.doneTitle}>Dossier finalisé</Text>
              </View>
              <Text style={styles.doneText}>
                Informations bien reçues. Votre boutique apparaîtra sur la marketplace dès sa
                validation par un modérateur.
              </Text>
              <View style={styles.doneDivider} />
              <Pressable onPress={onOpenSettings} style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>Paramètres complets</Text>
                <ArrowRight size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : null}

          {!isRejected ? (
            <View style={styles.verifFooter}>
              <View style={styles.verifFooterDot} />
              <Text style={styles.verifFooterText}>
                Demande transmise, en attente de validation
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Abonnement requis ──────────────────────────────────────────
  subScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  subCard: {
    width: '100%',
    maxWidth: 448,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 40,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 8,
  },
  subTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  subIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  subTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.4,
    marginBottom: 12,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 32,
  },
  subTextStrong: {
    color: '#EF4444',
    fontWeight: '600',
  },
  subButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: '#FED7AA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 3,
  },
  subButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Vérification de compte ─────────────────────────────────────
  verifScreen: {
    flex: 1,
    backgroundColor: '#FCFDFE',
  },
  verifScroll: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  verifCard: {
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.04,
    shadowRadius: 50,
    elevation: 4,
  },
  verifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 40,
  },
  verifIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifIconBoxRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  verifIconBoxPending: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FFEDD5',
  },
  verifHeaderText: {
    flexShrink: 1,
  },
  verifTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  verifStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  verifStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  verifMessageWrap: {
    marginBottom: 48,
  },
  verifMessage: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
  },
  verifMessageStrong: {
    color: '#0F172A',
    fontWeight: '600',
  },
  stepsWrap: {
    gap: 24,
  },
  stepBars: {
    flexDirection: 'row',
    gap: 6,
  },
  stepBar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  stepBarActive: {
    backgroundColor: COLORS.brand,
  },
  stepBody: {
    gap: 16,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
  },
  stepField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
  },
  stepInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ink,
  },
  stepInputStandalone: {
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    fontSize: 14,
    color: COLORS.ink,
  },
  stepActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
  },
  stepBackBtn: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBackText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  stepNextBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stepFinalizeBtn: {
    backgroundColor: COLORS.brand,
  },
  stepFinalizeSaving: {
    backgroundColor: 'rgba(245,107,42,0.5)',
  },
  stepNextText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  doneCard: {
    backgroundColor: 'rgba(255,247,237,0.3)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    padding: 32,
    gap: 16,
  },
  doneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  doneTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.brand,
  },
  doneText: {
    fontSize: 13,
    color: 'rgba(245,107,42,0.8)',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  doneDivider: {
    height: 1,
    backgroundColor: '#FFEDD5',
    marginTop: 4,
  },
  doneBtn: {
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  doneBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  verifFooter: {
    paddingTop: 32,
    marginTop: 48,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifFooterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  verifFooterText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
});
