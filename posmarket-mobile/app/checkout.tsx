/**
 * Écran Checkout — Validation de commande native.
 * Formulaire adresse client, mode de paiement, récapitulatif et confirmation.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle,
  ShieldCheck,
  CreditCard,
  Banknote,
  MapPin,
  User,
  Phone,
  Building,
  AlertCircle,
} from 'lucide-react-native';
import { useCart } from '@/context/CartContext';
import { submitCheckout } from '@/api/client';
import { formatCurrency, getEffectiveItemPrice } from '@/utils';
import {
  notifyOrderConfirmed,
  requestNotificationPermissions,
} from '@/utils/notifications';

/** Codes de paiement attendus côté serveur/rapports (mêmes valeurs que le storefront web). */
const PAYMENT_METHOD_CODES: Record<'cod' | 'wave' | 'om', string> = {
  cod: 'ESPECES',
  wave: 'MOBILE_MONEY',
  om: 'MOBILE_MONEY',
};

export default function CheckoutScreen() {
  const router = useRouter();
  const { cart, cartTotal, clearCart } = useCart();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Dakar');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'wave' | 'om'>('cod');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successOrderIds, setSuccessOrderIds] = useState<string[] | null>(null);

  // Demande l'autorisation de notification (crée aussi le canal Android « Commandes »).
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Regroupe les lignes du panier par boutique pour l'API.
  // Le serveur relit les prix en base : ces montants servent de récapitulatif client.
  const ordersPayload = useMemo(() => {
    const payload: Record<
      string,
      {
        items: Array<{
          product: { id: string; price: number };
          quantity: number;
          variantId: string | null;
        }>;
        subtotal: number;
        discountAmount: number;
        shippingCost: number;
        total: number;
        paymentMethod: string;
      }
    > = {};

    cart.forEach((item) => {
      const storeId = item.product.storeId;
      if (!storeId) return;

      if (!payload[storeId]) {
        payload[storeId] = {
          items: [],
          subtotal: 0,
          discountAmount: 0,
          shippingCost: 0,
          total: 0,
          paymentMethod: PAYMENT_METHOD_CODES.cod,
        };
      }

      const unitPrice = getEffectiveItemPrice(item);
      payload[storeId].items.push({
        product: { id: item.product.id, price: unitPrice },
        quantity: item.quantity,
        variantId: item.variantId || null,
      });
    });

    Object.values(payload).forEach((storeOrder) => {
      storeOrder.subtotal = storeOrder.items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      );
      storeOrder.total = storeOrder.subtotal;
    });

    return payload;
  }, [cart]);

  const handleConfirmOrder = useCallback(async () => {
    if (!fullName.trim()) {
      setErrorMessage('Veuillez renseigner votre nom complet.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Veuillez renseigner votre numéro de téléphone.');
      return;
    }
    if (!address.trim()) {
      setErrorMessage('Veuillez renseigner votre adresse de livraison.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const idempotencyKey = `mobile_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      // Le code paiement choisi s'applique à toutes les commandes du panier.
      const orders = Object.fromEntries(
        Object.entries(ordersPayload).map(([storeId, storeOrder]) => [
          storeId,
          { ...storeOrder, paymentMethod: PAYMENT_METHOD_CODES[paymentMethod] },
        ]),
      );

      const res = await submitCheckout({
        orders,
        customer: {
          name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
        },
        idempotencyKey,
      });

      if (res.success) {
        clearCart();
        const ids = res.orderIds || (res.orderId ? [res.orderId] : ['OK']);
        setSuccessOrderIds(ids);
        notifyOrderConfirmed(ids);
      } else {
        setErrorMessage(res.error || 'Erreur lors de la validation de la commande.');
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Impossible de joindre le serveur. Vérifiez votre connexion.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [fullName, phone, address, city, paymentMethod, ordersPayload, clearCart]);

  if (cart.length === 0 && !successOrderIds) {
    return (
      <SafeAreaView style={styles.emptySafe}>
        <Text style={styles.emptyTitle}>Votre panier est vide</Text>
        <Pressable style={styles.backHomeBtn} onPress={() => router.replace('/')}>
          <Text style={styles.backHomeText}>Découvrir les boutiques</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={styles.topBarTitle}>Validation de commande</Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Error alert */}
        {Boolean(errorMessage) && (
          <View style={styles.errorAlert}>
            <AlertCircle size={18} color="#dc2626" />
            <Text style={styles.errorAlertText}>{errorMessage}</Text>
          </View>
        )}

        {/* Section 1: Customer details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Informations de livraison</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nom & Prénom *</Text>
            <View style={styles.inputWrapper}>
              <User size={16} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="Ex: Fatou Ndiaye"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Numéro de téléphone *</Text>
            <View style={styles.inputWrapper}>
              <Phone size={16} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="Ex: 77 123 45 67"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Adresse de livraison *</Text>
            <View style={styles.inputWrapper}>
              <MapPin size={16} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="Quartier, rue, repère..."
                value={address}
                onChangeText={setAddress}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Ville</Text>
            <View style={styles.inputWrapper}>
              <Building size={16} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="Dakar"
                value={city}
                onChangeText={setCity}
              />
            </View>
          </View>
        </View>

        {/* Section 2: Payment method */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Mode de paiement</Text>

          <Pressable
            style={[
              styles.paymentOption,
              paymentMethod === 'cod' ? styles.paymentOptionActive : null,
            ]}
            onPress={() => setPaymentMethod('cod')}
          >
            <Banknote size={20} color={paymentMethod === 'cod' ? '#059669' : '#6b7280'} />
            <View style={styles.paymentCol}>
              <Text style={styles.paymentName}>Paiement à la livraison</Text>
              <Text style={styles.paymentSub}>Payez en espèces à réception du colis</Text>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.paymentOption,
              paymentMethod === 'wave' ? styles.paymentOptionActive : null,
            ]}
            onPress={() => setPaymentMethod('wave')}
          >
            <CreditCard size={20} color={paymentMethod === 'wave' ? '#059669' : '#6b7280'} />
            <View style={styles.paymentCol}>
              <Text style={styles.paymentName}>Wave Mobile Money</Text>
              <Text style={styles.paymentSub}>Paiement direct via Wave</Text>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.paymentOption,
              paymentMethod === 'om' ? styles.paymentOptionActive : null,
            ]}
            onPress={() => setPaymentMethod('om')}
          >
            <CreditCard size={20} color={paymentMethod === 'om' ? '#059669' : '#6b7280'} />
            <View style={styles.paymentCol}>
              <Text style={styles.paymentName}>Orange Money</Text>
              <Text style={styles.paymentSub}>Paiement sécurisé via Orange Money</Text>
            </View>
          </Pressable>
        </View>

        {/* Section 3: Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Récapitulatif</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Articles ({cart.length})</Text>
            <Text style={styles.summaryValue}>{formatCurrency(cartTotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frais de livraison</Text>
            <Text style={styles.summaryValueFree}>Gratuit / À convenir</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.totalLabel}>Total à payer</Text>
            <Text style={styles.totalValue}>{formatCurrency(cartTotal)}</Text>
          </View>
        </View>

        <View style={styles.guaranteeRow}>
          <ShieldCheck size={16} color="#059669" />
          <Text style={styles.guaranteeText}>
            Commande sécurisée avec notification directe au vendeur
          </Text>
        </View>
      </ScrollView>

      {/* Bottom confirmation action */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <Pressable
          style={[styles.submitBtn, isSubmitting ? styles.submitBtnDisabled : null]}
          onPress={handleConfirmOrder}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitBtnText}>
              Confirmer la commande • {formatCurrency(cartTotal)}
            </Text>
          )}
        </Pressable>
      </SafeAreaView>

      {/* Success Modal */}
      <Modal visible={Boolean(successOrderIds)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <CheckCircle size={56} color="#059669" />
            <Text style={styles.modalTitle}>Commande confirmée !</Text>
            <Text style={styles.modalSub}>
              Votre commande a bien été enregistrée. Les commerçants préparent votre colis.
            </Text>
            {successOrderIds && successOrderIds[0] !== 'OK' && (
              <View style={styles.orderIdBadge}>
                <Text style={styles.orderIdText}>
                  Réf : {successOrderIds.join(', ')}
                </Text>
              </View>
            )}
            <Pressable
              style={styles.modalBtn}
              onPress={() => {
                setSuccessOrderIds(null);
                router.replace('/(tabs)/account');
              }}
            >
              <Text style={styles.modalBtnText}>Voir mes commandes</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
    gap: 16,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 12,
    borderRadius: 8,
  },
  errorAlertText: {
    fontSize: 13,
    color: '#dc2626',
    flex: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  paymentOptionActive: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  paymentCol: {
    flex: 1,
  },
  paymentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  paymentSub: {
    fontSize: 11,
    color: '#6b7280',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  summaryValueFree: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  summaryTotalRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669',
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  guaranteeText: {
    fontSize: 11,
    color: '#6b7280',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
  },
  submitBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptySafe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  backHomeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#059669',
    borderRadius: 8,
  },
  backHomeText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginTop: 8,
  },
  modalSub: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  orderIdBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  orderIdText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  modalBtn: {
    marginTop: 12,
    width: '100%',
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
