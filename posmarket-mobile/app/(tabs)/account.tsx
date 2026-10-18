/**
 * Écran Espace Acheteur — Phase 4.3 du plan.
 * Suivi des commandes, gestion des adresses de livraison (buyer_addresses),
 * cache local avec la clé `buyer_data_cache_v2` et modales de confirmation.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  Package,
  MapPin,
  Clock,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
  Phone,
  Home,
  Check,
  ChevronRight,
  LogOut,
} from 'lucide-react-native';
import {
  fetchBuyerOrders,
  fetchBuyerAddresses,
  saveBuyerAddress,
  deleteBuyerAddress,
} from '@/api/client';
import { formatCurrency } from '@/utils';

const BUYER_CACHE_KEY = 'buyer_data_cache_v2';

interface Address {
  id?: string;
  name: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  is_default?: boolean;
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  products?: Array<{
    id: string;
    name: string;
    image?: string;
    business_type?: string;
  }>;
}

interface Order {
  id: string;
  date: string;
  total: number;
  subtotal: number;
  status: string;
  paymentMethod: string;
  stores?: Array<{ name: string }>;
  order_items?: OrderItem[];
}

export default function AccountScreen() {
  const [activeTab, setActiveTab] = useState<'orders' | 'addresses'>('orders');
  const [buyerEmail, setBuyerEmail] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [isEditingAuth, setIsEditingAuth] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Address Modal State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressName, setAddressName] = useState('');
  const [addressFullName, setAddressFullName] = useState('');
  const [addressPhone, setAddressPhone] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('Dakar');
  const [addressIsDefault, setAddressIsDefault] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Delete Confirm Modal State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Load from cache on startup
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(BUYER_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.email) setBuyerEmail(parsed.email);
          if (parsed.phone) setBuyerPhone(parsed.phone);
          if (Array.isArray(parsed.orders)) setOrders(parsed.orders);
          if (Array.isArray(parsed.addresses)) setAddresses(parsed.addresses);
        }
      } catch {}
    })();
  }, []);

  // Save to cache
  const updateCache = useCallback(
    async (patch: Partial<{ orders: Order[]; addresses: Address[]; email: string; phone: string }>) => {
      try {
        const raw = await AsyncStorage.getItem(BUYER_CACHE_KEY);
        const current = raw ? JSON.parse(raw) : {};
        const updated = { ...current, ...patch, timestamp: Date.now() };
        await AsyncStorage.setItem(BUYER_CACHE_KEY, JSON.stringify(updated));
      } catch {}
    },
    [],
  );

  const loadData = useCallback(async () => {
    if (!buyerEmail && !buyerPhone) return;
    setIsLoading(true);
    const identifier = buyerEmail || buyerPhone;

    try {
      const [ordersRes, addrRes] = await Promise.all([
        fetchBuyerOrders(identifier),
        fetchBuyerAddresses(identifier),
      ]);

      if (ordersRes.success && Array.isArray(ordersRes.orders)) {
        setOrders(ordersRes.orders as Order[]);
        updateCache({ orders: ordersRes.orders as Order[] });
      }

      if (addrRes.success && Array.isArray(addrRes.addresses)) {
        setAddresses(addrRes.addresses as Address[]);
        updateCache({ addresses: addrRes.addresses as Address[] });
      }
    } catch (e) {
      console.warn('Erreur chargement données acheteur', e);
    } finally {
      setIsLoading(false);
    }
  }, [buyerEmail, buyerPhone, updateCache]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSaveIdentifier = useCallback(() => {
    setIsEditingAuth(false);
    updateCache({ email: buyerEmail, phone: buyerPhone });
    loadData();
  }, [buyerEmail, buyerPhone, updateCache, loadData]);

  const handleCreateAddress = useCallback(async () => {
    if (!addressName || !addressFullName || !addressPhone || !addressStreet) return;

    setIsSavingAddress(true);
    try {
      const res = await saveBuyerAddress({
        name: addressName,
        fullName: addressFullName,
        phone: addressPhone,
        address: addressStreet,
        city: addressCity,
        isDefault: addressIsDefault,
        email: buyerEmail,
      });

      if (res.success) {
        setShowAddressModal(false);
        setAddressName('');
        setAddressFullName('');
        setAddressPhone('');
        setAddressStreet('');
        loadData();
      }
    } catch {} finally {
      setIsSavingAddress(false);
    }
  }, [
    addressName,
    addressFullName,
    addressPhone,
    addressStreet,
    addressCity,
    addressIsDefault,
    buyerEmail,
    loadData,
  ]);

  const handleDeleteAddress = useCallback(async () => {
    if (!deleteTargetId) return;
    try {
      await deleteBuyerAddress(deleteTargetId, buyerEmail);
      setDeleteTargetId(null);
      loadData();
    } catch {}
  }, [deleteTargetId, buyerEmail, loadData]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mon Compte</Text>
          <Text style={styles.headerSubtitle}>Espace Acheteur PosMarket</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F56B2A']} />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <User size={28} color="#F56B2A" />
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.profileName}>
              {buyerEmail || buyerPhone || 'Client PosMarket'}
            </Text>
            <Text style={styles.profilePhone}>
              {buyerPhone ? `Tél: ${buyerPhone}` : 'Numéro non renseigné'}
            </Text>
          </View>
          <Pressable
            style={styles.editBtn}
            onPress={() => setIsEditingAuth((prev) => !prev)}
          >
            <Text style={styles.editBtnText}>
              {isEditingAuth ? 'Fermer' : 'Modifier'}
            </Text>
          </Pressable>
        </View>

        {/* Edit Identity box */}
        {isEditingAuth && (
          <View style={styles.authBox}>
            <Text style={styles.authTitle}>Identité Acheteur</Text>
            <Text style={styles.authSub}>
              Renseignez votre e-mail ou téléphone pour synchroniser vos commandes et adresses.
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Adresse e-mail</Text>
              <TextInput
                style={styles.textInput}
                placeholder="client@exemple.com"
                value={buyerEmail}
                onChangeText={setBuyerEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Téléphone</Text>
              <TextInput
                style={styles.textInput}
                placeholder="77 123 45 67"
                value={buyerPhone}
                onChangeText={setBuyerPhone}
                keyboardType="phone-pad"
              />
            </View>
            <Pressable style={styles.saveAuthBtn} onPress={handleSaveIdentifier}>
              <Text style={styles.saveAuthBtnText}>Enregistrer & Synchroniser</Text>
            </Pressable>
          </View>
        )}

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabBtn, activeTab === 'orders' ? styles.tabBtnActive : null]}
            onPress={() => setActiveTab('orders')}
          >
            <Package
              size={18}
              color={activeTab === 'orders' ? '#F56B2A' : '#6b7280'}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'orders' ? styles.tabBtnTextActive : null,
              ]}
            >
              Commandes ({orders.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabBtn, activeTab === 'addresses' ? styles.tabBtnActive : null]}
            onPress={() => setActiveTab('addresses')}
          >
            <MapPin
              size={18}
              color={activeTab === 'addresses' ? '#F56B2A' : '#6b7280'}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'addresses' ? styles.tabBtnTextActive : null,
              ]}
            >
              Adresses ({addresses.length})
            </Text>
          </Pressable>
        </View>

        {/* Tab Content */}
        {isLoading && !refreshing ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color="#F56B2A" size="small" />
            <Text style={styles.loaderText}>Chargement des données...</Text>
          </View>
        ) : activeTab === 'orders' ? (
          /* Orders list */
          <View style={styles.sectionContainer}>
            {orders.length === 0 ? (
              <View style={styles.emptyCard}>
                <Package size={40} color="#9ca3af" />
                <Text style={styles.emptyTitle}>Aucune commande trouvée</Text>
                <Text style={styles.emptySub}>
                  Vos commandes passées apparaîtront ici avec leur état de livraison.
                </Text>
              </View>
            ) : (
              orders.map((order) => (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <View>
                      <Text style={styles.orderStore}>
                        {order.stores?.[0]?.name || 'PosMarket'}
                      </Text>
                      <Text style={styles.orderDate}>
                        {new Date(order.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        order.status === 'DELIVERED'
                          ? styles.statusDelivered
                          : styles.statusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          order.status === 'DELIVERED'
                            ? styles.statusTextDelivered
                            : styles.statusTextPending,
                        ]}
                      >
                        {order.status === 'DELIVERED'
                          ? 'Livrée'
                          : order.status === 'CONFIRMED'
                          ? 'Confirmée'
                          : 'En attente'}
                      </Text>
                    </View>
                  </View>

                  {/* Items list */}
                  <View style={styles.orderItemsList}>
                    {(order.order_items || []).map((it, idx) => (
                      <View key={idx} style={styles.orderItemRow}>
                        <Text style={styles.orderItemName} numberOfLines={1}>
                          {it.quantity}x {it.products?.[0]?.name || 'Article'}
                        </Text>
                        <Text style={styles.orderItemPrice}>
                          {formatCurrency(it.price * it.quantity)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.orderFooter}>
                    <Text style={styles.orderTotalLabel}>Total</Text>
                    <Text style={styles.orderTotalValue}>
                      {formatCurrency(order.total)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          /* Addresses list */
          <View style={styles.sectionContainer}>
            <Pressable
              style={styles.addAddressBtn}
              onPress={() => setShowAddressModal(true)}
            >
              <Plus size={18} color="#F56B2A" />
              <Text style={styles.addAddressText}>Ajouter une adresse de livraison</Text>
            </Pressable>

            {addresses.length === 0 ? (
              <View style={styles.emptyCard}>
                <MapPin size={40} color="#9ca3af" />
                <Text style={styles.emptyTitle}>Aucune adresse enregistrée</Text>
                <Text style={styles.emptySub}>
                  Enregistrez une adresse pour commander plus rapidement.
                </Text>
              </View>
            ) : (
              addresses.map((addr) => (
                <View key={addr.id} style={styles.addressCard}>
                  <View style={styles.addressHeader}>
                    <View style={styles.addressNameRow}>
                      <Home size={16} color="#F56B2A" />
                      <Text style={styles.addressName}>{addr.name}</Text>
                      {addr.is_default && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Par défaut</Text>
                        </View>
                      )}
                    </View>
                    <Pressable
                      style={styles.deleteIconBtn}
                      onPress={() => setDeleteTargetId(addr.id || null)}
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </Pressable>
                  </View>
                  <Text style={styles.addressDetails}>{addr.full_name}</Text>
                  <Text style={styles.addressDetails}>{addr.address}, {addr.city}</Text>
                  <Text style={styles.addressPhone}>{addr.phone}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Address Modal */}
      <Modal visible={showAddressModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.addressModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle adresse</Text>
              <Pressable onPress={() => setShowAddressModal(false)}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Intitulé (ex: Domicile, Bureau) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Domicile"
                  value={addressName}
                  onChangeText={setAddressName}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom complet du destinataire *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Fatou Ndiaye"
                  value={addressFullName}
                  onChangeText={setAddressFullName}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Téléphone du destinataire *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="77 123 45 67"
                  value={addressPhone}
                  onChangeText={setAddressPhone}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Adresse / Quartier *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Almadies, rue 12"
                  value={addressStreet}
                  onChangeText={setAddressStreet}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ville</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Dakar"
                  value={addressCity}
                  onChangeText={setAddressCity}
                />
              </View>
              <Pressable
                style={styles.checkboxRow}
                onPress={() => setAddressIsDefault((d) => !d)}
              >
                <View
                  style={[
                    styles.checkbox,
                    addressIsDefault ? styles.checkboxChecked : null,
                  ]}
                >
                  {addressIsDefault && <Check size={14} color="#ffffff" />}
                </View>
                <Text style={styles.checkboxLabel}>Définir comme adresse par défaut</Text>
              </Pressable>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowAddressModal(false)}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, isSavingAddress ? styles.btnDisabled : null]}
                onPress={handleCreateAddress}
                disabled={isSavingAddress}
              >
                {isSavingAddress ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Enregistrer</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal (no window.confirm) */}
      <Modal visible={Boolean(deleteTargetId)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmModal}>
            <AlertCircle size={44} color="#dc2626" />
            <Text style={styles.confirmTitle}>Supprimer cette adresse ?</Text>
            <Text style={styles.confirmSub}>
              Cette action est irréversible. L'adresse sera définitivement retirée de votre compte.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setDeleteTargetId(null)}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.deleteConfirmBtn} onPress={handleDeleteAddress}>
                <Text style={styles.deleteConfirmText}>Supprimer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF3ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  profilePhone: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  authBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  authTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  authSub: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFF3ED',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabBtnTextActive: {
    color: '#F56B2A',
  },
  sectionContainer: {
    gap: 12,
  },
  loaderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  loaderText: {
    fontSize: 13,
    color: '#6b7280',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 32,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  emptySub: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderStore: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  orderDate: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusDelivered: {
    backgroundColor: '#FFF3ED',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextPending: {
    color: '#d97706',
  },
  statusTextDelivered: {
    color: '#F56B2A',
  },
  orderItemsList: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
    gap: 4,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderItemName: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  orderItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  orderTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F56B2A',
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF3ED',
    borderWidth: 1,
    borderColor: '#FDE4D7',
    borderRadius: 10,
    paddingVertical: 12,
  },
  addAddressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F56B2A',
  },
  addressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 4,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  defaultBadge: {
    backgroundColor: '#FFF3ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    color: '#F56B2A',
    fontWeight: '600',
  },
  deleteIconBtn: {
    padding: 4,
  },
  addressDetails: {
    fontSize: 13,
    color: '#4b5563',
  },
  addressPhone: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    backgroundColor: '#ffffff',
    color: '#111827',
  },
  saveAuthBtn: {
    backgroundColor: '#F56B2A',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  saveAuthBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  addressModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  modalForm: {
    gap: 12,
    paddingBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#F56B2A',
    borderColor: '#F56B2A',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#374151',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#f3f4f6',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F56B2A',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  confirmModal: {
    backgroundColor: '#ffffff',
    margin: 24,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  confirmSub: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  deleteConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
