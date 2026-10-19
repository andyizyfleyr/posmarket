/**
 * Écran « Aucune boutique » — copie fidèle de
 * `src/components/NoStoreFound.tsx` du web (rendu mobile) : bienvenue, nom de
 * la boutique, choix du modèle (SHOP / RESTO) et création.
 */

import React, { useCallback, useState } from 'react';
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
import { ArrowRight, CircleAlert, Check, ShoppingBag, Store, UtensilsCrossed } from 'lucide-react-native';
import { COLORS } from '@/theme';

interface SellerNoStoreProps {
  onSubmit: (
    name: string,
    businessType: 'shopping' | 'food',
  ) => Promise<{ ok: boolean; error?: string }>;
}

export function SellerNoStore({ onSubmit }: SellerNoStoreProps) {
  const [name, setName] = useState('');
  const [model, setModel] = useState<'shopping' | 'food'>('shopping');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = useCallback(async () => {
    const cleanName = name.trim();
    if (!cleanName || creating) return;
    setCreating(true);
    setError('');
    try {
      const res = await onSubmit(cleanName, model);
      if (!res.ok) {
        setError(res.error || 'Une erreur est survenue');
      }
    } catch {
      setError('Erreur de connexion serveur');
    } finally {
      setCreating(false);
    }
  }, [creating, model, name, onSubmit]);

  const canSubmit = name.trim().length > 0 && !creating;

  return (
    <View style={styles.screen}>
      {/* Décor : grille fine + halos (non interactif) */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.haloTopRight} />
        <View style={styles.haloBottomLeft} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Ligne marque */}
          <View style={styles.brandRow}>
            <LinearGradient
              colors={[COLORS.brand, '#E55A1B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.brandPill}
            >
              <Store size={17} color="#FFFFFF" strokeWidth={2.5} />
            </LinearGradient>
            <Text style={styles.brandWord}>PosMarket</Text>
            <Text style={styles.stepLabel}>Étape 1 / 1</Text>
          </View>

          <Text style={styles.title}>Bienvenue sur votre PDV !</Text>
          <Text style={styles.paragraph}>
            Pour commencer, donnez un nom à votre première boutique. C’est l’endroit où vous
            gérerez vos ventes et stocks.
          </Text>

          <View style={styles.form}>
            <View>
              <Text style={styles.label}>Nom de votre boutique</Text>
              <View style={styles.field}>
                <Store size={17} color="#94A3B8" />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="ex: Ma Boutique Pro"
                  placeholderTextColor="#94A3B8"
                  autoFocus
                  editable={!creating}
                  style={styles.input}
                />
              </View>
            </View>

            <View>
              <Text style={styles.label}>Modèle de boutique</Text>
              <View style={styles.models}>
                <ModelCard
                  type="shopping"
                  selected={model === 'shopping'}
                  onPress={() => setModel('shopping')}
                />
                <ModelCard
                  type="food"
                  selected={model === 'food'}
                  onPress={() => setModel('food')}
                />
              </View>
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <CircleAlert size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleCreate}
              disabled={!canSubmit}
              style={[styles.createBtn, !canSubmit && styles.createBtnDisabled]}
            >
              {creating ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.createText}>Création en cours...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.createText}>Créer ma boutique</Text>
                  <ArrowRight size={17} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function ModelCard({
  type,
  selected,
  onPress,
}: {
  type: 'shopping' | 'food';
  selected: boolean;
  onPress: () => void;
}) {
  const isShop = type === 'shopping';
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modelCard, selected && styles.modelCardSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.modelTop}>
        <View style={[styles.modelIcon, selected && styles.modelIconSelected]}>
          {isShop ? (
            <ShoppingBag size={18} color={selected ? '#FFFFFF' : '#64748B'} />
          ) : (
            <UtensilsCrossed size={18} color={selected ? '#FFFFFF' : '#64748B'} />
          )}
        </View>
        <View style={styles.modelBody}>
          <View style={styles.modelTitleRow}>
            <Text style={styles.modelTitle}>{isShop ? 'SHOP' : 'RESTO'}</Text>
            {selected ? (
              <View style={styles.chosenBadge}>
                <Check size={9} color={COLORS.brand} strokeWidth={3} />
                <Text style={styles.chosenText}>CHOISI</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.modelDescription}>
            {isShop ? 'Shopping & E-commerce' : 'Cuisine & Restauration'}
          </Text>
          <View style={styles.modelChips}>
            {(isShop ? ['Stocks', 'Livraison'] : ['Menu', 'Préparation']).map((chip) => (
              <Text key={chip} style={styles.modelChip}>
                {chip}
              </Text>
            ))}
          </View>
        </View>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <Check size={11} color="#FFFFFF" strokeWidth={3} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    overflow: 'hidden',
  },
  haloTopRight: {
    position: 'absolute',
    top: -140,
    right: -140,
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: 'rgba(245,107,42,0.22)',
    opacity: 0.55,
  },
  haloBottomLeft: {
    position: 'absolute',
    bottom: -160,
    left: -160,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(0,47,52,0.12)',
    opacity: 0.5,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF0F2',
    borderRadius: 28,
    padding: 20,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  brandPill: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    height: 18,
    width: 110,
  },
  brandWord: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ink,
  },
  stepLabel: {
    marginLeft: 'auto',
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: COLORS.ink,
  },
  paragraph: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
    maxWidth: 440,
  },
  form: {
    marginTop: 24,
    gap: 20,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#EEF0F2',
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.ink,
  },
  models: {
    gap: 10,
  },
  modelCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF0F2',
    backgroundColor: '#FFFFFF',
  },
  modelCardSelected: {
    borderColor: COLORS.brand,
    backgroundColor: 'rgba(255,243,237,0.6)',
  },
  modelTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  modelIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelIconSelected: {
    backgroundColor: COLORS.brand,
  },
  modelBody: {
    flex: 1,
  },
  modelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modelTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: COLORS.ink,
  },
  chosenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245,107,42,0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chosenText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: COLORS.brand,
  },
  modelDescription: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
  },
  modelChips: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  modelChip: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF0F2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brand,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 16,
    padding: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    color: '#DC2626',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: COLORS.brand,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  createBtnDisabled: {
    backgroundColor: '#F7C9B0',
    shadowOpacity: 0,
    elevation: 0,
  },
  createText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
