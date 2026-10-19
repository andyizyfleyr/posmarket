/**
 * Factures vendeur — copie fidèle de `src/views/InvoicesView.tsx` du web
 * (rendu mobile < 768 px) : en-tête (titre + bouton « Filtrer » inerte +
 * bouton « Nouveau »), liste de cartes (icône, numéro, date fr, client,
 * total, pastille de statut en icône seule), état vide, modale de création en
 * 3 étapes (Client / Dates / Articles) et modale détail (aperçu facture +
 * panneau d'actions « Imprimer » / « PDF »).
 *
 * Écarts assumés :
 * - l'accès aux données passe par la route `/api/marketplace/seller/invoices`
 *   (le web rend la page côté serveur) : un indicateur de chargement couvre le
 *   premier appel, absent du rendu web ;
 * - les toasts sont branchés sur le système global (`useToast`) là où la page
 *   web ne fournit pas `notify` (validations, stock, statut, erreurs) ;
 * - les dates du formulaire utilisent un champ texte masqué « jj/mm/aaaa »
 *   (pas de date picker natif), avec les défauts du web (aujourd'hui / +14 j) ;
 * - impression et PDF natifs via expo-print / expo-sharing
 *   (`@/utils/invoice-print`), à la place de `window.print()` + jsPDF.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  Plus,
  Printer,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useToast, ToastViewport } from '@/components/ToastProvider';
import { COLORS } from '@/theme';
import { formatCurrency, getEffectiveWholesaleUnitPrice } from '@/utils';
import { downloadInvoicePdf, printInvoice } from '@/utils/invoice-print';
import type { Product } from '@/types';
import {
  fetchSellerInvoiceItems,
  fetchSellerInvoices,
  saveSellerInvoice,
  updateSellerInvoiceStatus,
  type InvoiceStoreSettings,
  type SellerInvoice,
  type SellerInvoiceItem,
  type SellerInvoiceItemInput,
  type SellerInvoicesResponse,
  type SellerInvoiceStatus,
} from '@/api/seller-invoices';

const MONO_FONT = Platform.select({
  ios: 'Courier',
  android: 'monospace',
  default: 'monospace',
});

/** Erreurs de chargement volontairement silencieuses (mêmes règles que les autres vues). */
const SILENT_ERRORS = new Set(['Forbidden', 'NoStore', 'UnauthorizedStale']);

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Date locale (année, mois, jour) au format ISO « AAAA-MM-JJ ». */
function toIsoDay(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Valeur brute du formulaire (AAAA-MM-JJ) → « jj/mm/aaaa ». */
function isoDayToFr(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Date sérialisée (ISO ou Date) → fr-FR, comme `toLocaleDateString` au web. */
function formatFrDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR');
}

/** Masque de saisie « jj/mm/aaaa » (chiffres uniquement, 8 max). */
function maskFrDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** « jj/mm/aaaa » → ISO (AAAA-MM-JJ), null si la date n'existe pas. */
function parseFrDate(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${match[3]}-${pad2(month)}-${pad2(day)}`;
}

/** Couleurs des statuts — mêmes tons Tailwind que `getStatusColor` du web. */
const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; label: string; Icon: LucideIcon }
> = {
  PAID: {
    bg: '#DCFCE7',
    text: '#15803D',
    border: '#BBF7D0',
    label: 'Payée',
    Icon: CheckCircle2,
  },
  SENT: {
    bg: '#FFEDD5',
    text: '#D55A20',
    border: '#FED7AA',
    label: 'Envoyée',
    Icon: Send,
  },
  DRAFT: {
    bg: '#F3F4F6',
    text: '#374151',
    border: '#E5E7EB',
    label: 'Brouillon',
    Icon: FileText,
  },
  OVERDUE: {
    bg: '#FEE2E2',
    text: '#B91C1C',
    border: '#FECACA',
    label: 'En retard',
    Icon: Clock,
  },
};

const getStatusConfig = (status?: string | null) =>
  STATUS_CONFIG[status || ''] || STATUS_CONFIG.DRAFT;

/** Libellé français du statut (`getStatusLabel` du web). */
function getStatusLabel(status?: string | null): string {
  switch (status) {
    case 'PAID':
      return 'Payée';
    case 'SENT':
      return 'Envoyée';
    case 'OVERDUE':
      return 'En retard';
    case 'DRAFT':
      return 'Brouillon';
    default:
      return status || '';
  }
}

/** Statuts du formulaire de création (« En retard » est exclu, comme au web). */
type FormStatus = 'DRAFT' | 'SENT' | 'PAID';

interface InvoiceFormState {
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  /** ISO AAAA-MM-JJ, comme les `<input type="date">` du web. */
  date: string;
  dueDate: string;
  status: FormStatus;
  notes: string;
  items: SellerInvoiceItemInput[];
}

/** Valeurs initiales du web : aujourd'hui / aujourd'hui + 14 jours / Brouillon. */
function defaultForm(): InvoiceFormState {
  return {
    customerName: '',
    customerEmail: '',
    customerAddress: '',
    date: toIsoDay(new Date()),
    dueDate: toIsoDay(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
    status: 'DRAFT',
    notes: '',
    items: [],
  };
}

interface SellerInvoicesViewProps {
  storeId: string;
  canManageInvoices: boolean;
  isSeller: boolean;
  /** Session expirée (réponse `Unauthorized`) : purge la session côté contexte. */
  onUnauthorized: () => void;
}

export function SellerInvoicesView({
  storeId,
  canManageInvoices,
  isSeller,
  onUnauthorized,
}: SellerInvoicesViewProps) {
  const { notify } = useToast();
  const insets = useSafeAreaInsets();

  const [invoices, setInvoices] = useState<SellerInvoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeSettings, setStoreSettings] = useState<InvoiceStoreSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedInvoice, setSelectedInvoice] = useState<SellerInvoice | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<SellerInvoiceItem[]>([]);
  const [loadingInvoiceItems, setLoadingInvoiceItems] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const [form, setForm] = useState<InvoiceFormState>(() => defaultForm());
  const [dateText, setDateText] = useState(() => isoDayToFr(defaultForm().date));
  const [dueDateText, setDueDateText] = useState(() => isoDayToFr(defaultForm().dueDate));
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState(1);

  const expiredRef = useRef(false);
  const handleUnauthorized = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    onUnauthorized();
  }, [onUnauthorized]);

  /** Applique une réponse de la route liste (succès, session, erreurs). */
  const applyInvoicesResponse = useCallback(
    (res: SellerInvoicesResponse) => {
      if (res.success) {
        setInvoices(res.invoices || []);
        setProducts(res.products || []);
        setStoreSettings(res.store?.settings || null);
      } else if (res.error === 'Unauthorized') {
        handleUnauthorized();
      } else if (res.error && !SILENT_ERRORS.has(res.error)) {
        notify(res.error, 'error');
      }
    },
    [handleUnauthorized, notify],
  );

  // Chargement initial (le web rend la page côté serveur).
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetchSellerInvoices(storeId)
      .then((res) => {
        if (active) applyInvoicesResponse(res);
      })
      .catch(() => {
        if (active) notify('Erreur lors du chargement des factures', 'error');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storeId, applyInvoicesResponse, notify]);

  /** Recharge silencieuse après une écriture (équivaut au `router.refresh()` web). */
  const reloadInvoices = useCallback(() => {
    void fetchSellerInvoices(storeId)
      .then(applyInvoicesResponse)
      .catch(() => {});
  }, [storeId, applyInvoicesResponse]);

  /** Tirer vers le bas pour recharger la liste des factures. */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchSellerInvoices(storeId).then(applyInvoicesResponse).catch(() => {});
    } finally {
      setRefreshing(false);
    }
  }, [storeId, applyInvoicesResponse]);

  // Articles de la facture sélectionnée (table `invoice_items`, comme le web).
  const selectedInvoiceId = selectedInvoice?.id;
  useEffect(() => {
    if (!selectedInvoiceId) {
      setSelectedInvoiceItems([]);
      return;
    }
    let cancelled = false;
    setSelectedInvoiceItems([]);
    setLoadingInvoiceItems(true);
    fetchSellerInvoiceItems(selectedInvoiceId)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.items) setSelectedInvoiceItems(res.items);
        else if (res.error === 'Unauthorized') handleUnauthorized();
      })
      .catch((err) => {
        if (!cancelled) console.error('Error loading invoice items:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingInvoiceItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedInvoiceId, handleUnauthorized]);

  /** Ouvre la modale de création à l'étape 1 (bouton « Nouveau » / état vide). */
  const openCreate = () => {
    setIsCreating(true);
    setStep(1);
  };

  const closeCreate = () => {
    setShowProductPicker(false);
    setIsCreating(false);
  };

  /** Réinitialise le formulaire (uniquement après un enregistrement réussi). */
  const resetForm = () => {
    const next = defaultForm();
    setForm(next);
    setDateText(isoDayToFr(next.date));
    setDueDateText(isoDayToFr(next.dueDate));
  };

  const handleDateTextChange = (text: string) => {
    const masked = maskFrDate(text);
    setDateText(masked);
    const iso = parseFrDate(masked);
    if (iso) setForm((prev) => ({ ...prev, date: iso }));
  };

  const handleDueDateTextChange = (text: string) => {
    const masked = maskFrDate(text);
    setDueDateText(masked);
    const iso = parseFrDate(masked);
    if (iso) setForm((prev) => ({ ...prev, dueDate: iso }));
  };

  /** Compteur de quantité : minimum 1, comme l'input `type="number"` du web. */
  const handleQuantityChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    const parsed = parseInt(digits, 10);
    setQuantity(Number.isFinite(parsed) ? Math.max(1, parsed) : 1);
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const stock = Number(product.stock ?? 0);
    if (stock > 0 && quantity > stock) {
      notify(
        `Stock insuffisant pour « ${product.name} » : ${stock} restant${stock > 1 ? 's' : ''}.`,
        'error',
        'Quantité limitée',
      );
      setQuantity(stock);
      return;
    }

    const unitPrice = getEffectiveWholesaleUnitPrice(product, quantity);
    const newItem: SellerInvoiceItemInput = {
      description: product.name,
      quantity,
      unitPrice,
      total: unitPrice * quantity,
    };

    setForm((prev) => ({ ...prev, items: [...prev.items, newItem] }));
    setSelectedProduct('');
    setQuantity(1);
  };

  const handleRemoveItem = (index: number) => {
    setForm((prev) => {
      const items = [...prev.items];
      items.splice(index, 1);
      return { ...prev, items };
    });
  };

  const handleSaveInvoice = async () => {
    if (isSavingInvoice) return;
    if (!form.customerName.trim()) {
      notify('Entrez le nom du client.', 'warning');
      setStep(1);
      return;
    }
    if (form.items.length === 0) {
      notify('Ajoutez au moins un article.', 'warning');
      setStep(3);
      return;
    }

    const subtotal = form.items.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal;
    const now = new Date();
    const invoiceNumber = `FAC-${now.getFullYear()}${pad2(now.getMonth() + 1)}-${String(
      invoices.length + 1,
    ).padStart(4, '0')}`;

    try {
      setIsSavingInvoice(true);
      const res = await saveSellerInvoice(storeId, {
        id: `temp-${Date.now()}`,
        invoiceNumber,
        date: form.date,
        dueDate: form.dueDate,
        items: form.items,
        subtotal,
        total,
        status: form.status,
        customerName: form.customerName || 'Client',
        customerEmail: form.customerEmail || '',
        customerAddress: form.customerAddress || '',
        notes: form.notes,
      });
      if (!res.success) {
        if (res.error === 'Unauthorized') {
          handleUnauthorized();
          return;
        }
        notify("Erreur lors de l'enregistrement de la facture", 'error');
        return;
      }
      setIsCreating(false);
      setStep(1);
      resetForm();
      reloadInvoices();
      notify('Facture enregistrée', 'success');
    } catch {
      notify("Erreur lors de l'enregistrement de la facture", 'error');
    } finally {
      setIsSavingInvoice(false);
    }
  };

  /** Select « Statut » de la modale détail (masqué pour un vendeur). */
  const handleStatusChange = async (status: SellerInvoiceStatus) => {
    if (!selectedInvoice || status === selectedInvoice.status) return;
    const invoiceId = selectedInvoice.id;
    try {
      const res = await updateSellerInvoiceStatus(invoiceId, status);
      if (!res.success) {
        if (res.error === 'Unauthorized') {
          handleUnauthorized();
          return;
        }
        notify('Erreur lors de la mise à jour', 'error');
        return;
      }
      setSelectedInvoice((prev) => (prev ? { ...prev, status } : prev));
      setInvoices((prev) =>
        prev.map((invoice) => (invoice.id === invoiceId ? { ...invoice, status } : invoice)),
      );
      notify('Statut de la facture mis à jour', 'success');
    } catch {
      notify('Erreur lors de la mise à jour', 'error');
    }
  };

  /** Impression native (dialogue d'impression du système). */
  const handlePrint = () => {
    if (!selectedInvoice) return;
    try {
      void printInvoice(selectedInvoice, selectedInvoiceItems, storeSettings).catch((err) => {
        console.error('Print error:', err);
        notify("Erreur lors de l'impression de la facture", 'error');
      });
    } catch (err) {
      console.error('Print error:', err);
      notify("Erreur lors de l'impression de la facture", 'error');
    }
  };

  /** Export PDF natif (fichier partagé via la feuille de partage). */
  const handleDownloadPDF = async () => {
    if (!selectedInvoice || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      await downloadInvoicePdf(selectedInvoice, selectedInvoiceItems, storeSettings);
    } catch (err) {
      console.error('Error generating invoice PDF:', err);
      notify('Erreur lors de la génération du PDF', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Totaux du formulaire (total = sous-total, pas de remise ni TVA).
  const formSubtotal = form.items.reduce((sum, item) => sum + item.total, 0);
  const formTotal = formSubtotal;

  const renderStatusPill = (status?: string | null) => {
    const config = getStatusConfig(status);
    return (
      <View
        style={[
          styles.statusPill,
          { backgroundColor: config.bg, borderColor: config.border },
        ]}
      >
        <config.Icon size={12} color={config.text} />
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* En-tête */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Factures</Text>
          <Text style={styles.subtitle}>Gérez et générez vos factures professionnelles.</Text>
        </View>
        <View style={styles.headerActions}>
          {/* Champ recherche « hidden md:flex » : exclu mobile. */}
          <View style={styles.filterBtn}>
            <Filter size={16} color="#9CA3AF" />
          </View>
          {canManageInvoices ? (
            <Pressable
              onPress={openCreate}
              style={({ pressed }) => [styles.newBtn, pressed ? styles.pressed : null]}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.newBtnText}>Nouveau</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Carte liste */}
      <View style={styles.card}>
        {isLoading ? (
          <View style={styles.listLoader}>
            <ActivityIndicator size="large" color={COLORS.brand} />
          </View>
        ) : invoices.length > 0 ? (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.brand}
                colors={[COLORS.brand]}
              />
            }
          >
            {invoices.map((invoice, index) => (
              <Pressable
                key={invoice.id}
                onPress={() => setSelectedInvoice(invoice)}
                style={({ pressed }) => [
                  styles.invoiceRow,
                  index < invoices.length - 1 ? styles.invoiceRowBorder : null,
                  pressed ? styles.invoiceRowPressed : null,
                ]}
              >
                <View style={styles.invoiceRowTop}>
                  <View style={styles.invoiceRowLeft}>
                    <View style={styles.invoiceIcon}>
                      <FileText size={16} color={COLORS.brand} />
                    </View>
                    <View style={styles.invoiceBody}>
                      <View style={styles.invoiceNumberRow}>
                        <Text style={styles.invoiceNumber} numberOfLines={1}>
                          {invoice.invoiceNumber}
                        </Text>
                        <Text style={styles.invoiceDate}>{formatFrDate(invoice.date)}</Text>
                      </View>
                      <View style={styles.invoiceMetaRow}>
                        <Text style={styles.invoiceCustomer} numberOfLines={1}>
                          {invoice.customerName || 'Client'}
                        </Text>
                        <Text style={styles.invoiceDivider}>|</Text>
                        <Text style={styles.invoiceTotal}>
                          {formatCurrency(Number(invoice.total) || 0)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.invoiceRight}>
                    {renderStatusPill(invoice.status)}
                    <ChevronRight size={14} color="#D1D5DB" />
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyCircle}>
              <FileText size={40} color="#D1D5DB" />
            </View>
            <View style={styles.emptyTextBlock}>
              <Text style={styles.emptyTitle}>Aucune facture</Text>
              <Text style={styles.emptyText}>
                Créez votre première facture pour commencer.
              </Text>
            </View>
            {canManageInvoices ? (
              <Pressable
                onPress={openCreate}
                style={({ pressed }) => [styles.emptyButton, pressed ? styles.pressed : null]}
              >
                <Plus size={18} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Créer une facture</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      {/* ─── Modale « Nouvelle Facture » ─── */}
      <Modal
        visible={isCreating}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeCreate}
      >
        <View style={styles.overlay}>
          <View style={styles.createPanel}>
            {/* En-tête */}
            <View style={styles.createHeader}>
              <View style={styles.createTitleRow}>
                <View style={styles.createTitleLeft}>
                  <FileText size={20} color={COLORS.brand} />
                  <Text style={styles.createTitle}>Nouvelle Facture</Text>
                </View>
                <Pressable
                  onPress={closeCreate}
                  hitSlop={8}
                  style={styles.modalClose}
                  accessibilityLabel="Fermer"
                >
                  <X size={20} color="#9CA3AF" />
                </Pressable>
              </View>

              {/* Indicateur d'étapes */}
              <View style={styles.stepsWrap}>
                <View style={styles.stepsTrack} />
                <View
                  style={[
                    styles.stepsProgress,
                    { width: `${((step - 1) / 2) * 100}%` },
                  ]}
                />
                {[1, 2, 3].map((s) => (
                  <View key={s} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepCircle,
                        step >= s ? styles.stepCircleActive : styles.stepCircleIdle,
                      ]}
                    >
                      {step > s ? (
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      ) : (
                        <Text
                          style={[
                            styles.stepCircleText,
                            { color: step >= s ? '#FFFFFF' : '#9CA3AF' },
                          ]}
                        >
                          {s}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        step >= s ? styles.stepLabelActive : null,
                      ]}
                    >
                      {s === 1 ? 'Client' : s === 2 ? 'Dates' : 'Articles'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Corps */}
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {step === 1 ? (
                <View style={styles.stepBody}>
                  <Text style={styles.sectionTitle}>Informations Client</Text>
                  <View style={styles.fields}>
                    <View>
                      <Text style={styles.fieldLabel}>Nom complet ou Société</Text>
                      <TextInput
                        value={form.customerName}
                        onChangeText={(value) =>
                          setForm((prev) => ({ ...prev, customerName: value }))
                        }
                        placeholder="Ex: Jean Dupont"
                        placeholderTextColor="#C4C9D1"
                        style={[styles.input, styles.inputStrong]}
                      />
                    </View>
                    <View>
                      <Text style={styles.fieldLabel}>Email</Text>
                      <TextInput
                        value={form.customerEmail}
                        onChangeText={(value) =>
                          setForm((prev) => ({ ...prev, customerEmail: value }))
                        }
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={styles.input}
                      />
                    </View>
                    <View>
                      <Text style={styles.fieldLabel}>Adresse</Text>
                      <TextInput
                        value={form.customerAddress}
                        onChangeText={(value) =>
                          setForm((prev) => ({ ...prev, customerAddress: value }))
                        }
                        style={styles.input}
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              {step === 2 ? (
                <View style={styles.stepBody}>
                  <Text style={styles.sectionTitle}>Détails & Échéances</Text>
                  <View style={styles.dateRow}>
                    <View style={styles.dateField}>
                      <Text style={styles.fieldLabel}>Date d’émission</Text>
                      <TextInput
                        value={dateText}
                        onChangeText={handleDateTextChange}
                        placeholder="jj/mm/aaaa"
                        placeholderTextColor="#C4C9D1"
                        keyboardType="number-pad"
                        maxLength={10}
                        style={[styles.input, styles.inputStrong]}
                      />
                    </View>
                    <View style={styles.dateField}>
                      <Text style={styles.fieldLabel}>Échéance</Text>
                      <TextInput
                        value={dueDateText}
                        onChangeText={handleDueDateTextChange}
                        placeholder="jj/mm/aaaa"
                        placeholderTextColor="#C4C9D1"
                        keyboardType="number-pad"
                        maxLength={10}
                        style={[styles.input, styles.inputStrong]}
                      />
                    </View>
                  </View>
                  <View style={styles.fields}>
                    <View>
                      <Text style={styles.fieldLabel}>Statut Initial</Text>
                      <View style={styles.statusSelect}>
                        {(['DRAFT', 'SENT', 'PAID'] as const).map((status) => {
                          const active = form.status === status;
                          const config = getStatusConfig(status);
                          return (
                            <Pressable
                              key={status}
                              onPress={() => setForm((prev) => ({ ...prev, status }))}
                              style={[
                                styles.statusOption,
                                active
                                  ? {
                                      backgroundColor: config.bg,
                                      borderColor: config.border,
                                    }
                                  : null,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusOptionText,
                                  active ? { color: config.text } : null,
                                ]}
                              >
                                {config.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View>
                      <Text style={styles.fieldLabel}>Notes internes</Text>
                      <TextInput
                        value={form.notes}
                        onChangeText={(value) =>
                          setForm((prev) => ({ ...prev, notes: value }))
                        }
                        placeholder="Ex: Confiance"
                        placeholderTextColor="#C4C9D1"
                        style={styles.input}
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              {step === 3 ? (
                <View style={styles.stepBody}>
                  <View style={styles.itemsHeader}>
                    <Text style={styles.itemsTitle}>Articles de la facture</Text>
                    <View style={styles.itemsBadge}>
                      <Text style={styles.itemsBadgeText}>{form.items.length} Articles</Text>
                    </View>
                  </View>

                  {/* Encart d'ajout */}
                  <View style={styles.addBox}>
                    <View>
                      <Text style={styles.addLabel}>Choisir un produit</Text>
                      <Pressable
                        onPress={() => setShowProductPicker(true)}
                        style={styles.productSelect}
                      >
                        <Text
                          style={
                            selectedProduct
                              ? styles.productSelectText
                              : styles.productSelectPlaceholder
                          }
                          numberOfLines={1}
                        >
                          {selectedProduct
                            ? (() => {
                                const product = products.find(
                                  (p) => p.id === selectedProduct,
                                );
                                return product
                                  ? `${product.name} — ${formatCurrency(product.price)}`
                                  : 'Sélectionner un produit...';
                              })()
                            : 'Sélectionner un produit...'}
                        </Text>
                        <ChevronDown size={16} color="#9CA3AF" />
                      </Pressable>
                    </View>

                    <View>
                      <Text style={styles.addLabel}>Quantité</Text>
                      <View style={styles.quantityBox}>
                        <Pressable
                          onPress={() => setQuantity(Math.max(1, quantity - 1))}
                          style={[styles.quantityBtn, styles.quantityBtnLeft]}
                        >
                          <Text style={styles.quantityBtnText}>−</Text>
                        </Pressable>
                        <TextInput
                          value={String(quantity)}
                          onChangeText={handleQuantityChange}
                          keyboardType="number-pad"
                          style={styles.quantityInput}
                        />
                        <Pressable
                          onPress={() => setQuantity(quantity + 1)}
                          style={[styles.quantityBtn, styles.quantityBtnRight]}
                        >
                          <Text style={styles.quantityBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    <Pressable
                      onPress={handleAddItem}
                      disabled={!selectedProduct}
                      style={[
                        styles.addItemBtn,
                        !selectedProduct ? styles.addItemBtnDisabled : null,
                      ]}
                    >
                      <Plus size={16} color="#FFFFFF" />
                      <Text style={styles.addItemBtnText}>Ajouter</Text>
                    </Pressable>
                  </View>

                  {/* Tableau des articles (min-w 500 px → défilement horizontal) */}
                  {form.items.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.tableScroll}
                    >
                      <View style={styles.itemsTable}>
                        <View style={styles.itemsTableHead}>
                          <View style={[styles.tdCell, styles.colDesc]}>
                            <Text style={styles.thText}>Description</Text>
                          </View>
                          <View style={[styles.tdCell, styles.colQtyCreate]}>
                            <Text style={[styles.thText, styles.alignCenter]}>Qté</Text>
                          </View>
                          <View style={[styles.tdCell, styles.colUnit]}>
                            <Text style={[styles.thText, styles.alignRight]}>Prix Un.</Text>
                          </View>
                          <View style={[styles.tdCell, styles.colTotal]}>
                            <Text style={[styles.thText, styles.alignRight]}>Total</Text>
                          </View>
                          <View style={[styles.tdCell, styles.colTrash]} />
                        </View>
                        {form.items.map((item, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.itemsTableRow,
                              idx < form.items.length - 1
                                ? styles.itemsTableRowBorder
                                : null,
                            ]}
                          >
                            <View style={[styles.tdCell, styles.colDesc]}>
                              <Text style={styles.tdDesc} numberOfLines={1}>
                                {item.description}
                              </Text>
                            </View>
                            <View style={[styles.tdCell, styles.colQtyCreate, styles.tdQtyCell]}>
                              <Text style={styles.tdQtyText}>{item.quantity}</Text>
                            </View>
                            <View style={[styles.tdCell, styles.colUnit]}>
                              <Text style={styles.tdUnitText}>
                                {formatCurrency(item.unitPrice)}
                              </Text>
                            </View>
                            <View style={[styles.tdCell, styles.colTotal]}>
                              <Text style={styles.tdTotalText}>
                                {formatCurrency(item.total)}
                              </Text>
                            </View>
                            <View style={[styles.tdCell, styles.colTrash]}>
                              <Pressable
                                onPress={() => handleRemoveItem(idx)}
                                hitSlop={6}
                                style={styles.trashBtn}
                                accessibilityLabel="Retirer l'article"
                              >
                                <Trash2 size={16} color="#D1D5DB" />
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  ) : (
                    <View style={styles.emptyItems}>
                      <View style={styles.emptyItemsCircle}>
                        <Search size={24} color="#E5E7EB" />
                      </View>
                      <Text style={styles.emptyItemsTitle}>Aucun article ajouté</Text>
                      <Text style={styles.emptyItemsText}>
                        Sélectionnez un produit ci-dessus pour commencer.
                      </Text>
                    </View>
                  )}

                  {/* Totaux */}
                  <View style={styles.totalsWrap}>
                    <View style={styles.totalsCard}>
                      <View style={styles.totalsRow}>
                        <Text style={styles.totalsLabel}>Sous-total</Text>
                        <Text style={styles.totalsValue}>{formatCurrency(formSubtotal)}</Text>
                      </View>
                      <View style={styles.totalsTotalRow}>
                        <Text style={styles.totalsTotalLabel}>Total</Text>
                        <Text style={styles.totalsTotalValue}>{formatCurrency(formTotal)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {/* Pied */}
            <View style={styles.createFooter}>
              {step > 1 ? (
                <Pressable
                  onPress={() => setStep(step - 1)}
                  style={({ pressed }) => [
                    styles.footerSecondary,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.footerSecondaryText}>Précédent</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={closeCreate}
                  style={({ pressed }) => [
                    styles.footerSecondary,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.footerSecondaryText}>Annuler</Text>
                </Pressable>
              )}

              {step < 3 ? (
                <Pressable
                  onPress={() => setStep(step + 1)}
                  style={({ pressed }) => [
                    styles.footerPrimary,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.footerPrimaryText}>Continuer</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleSaveInvoice}
                  disabled={isSavingInvoice}
                  style={[styles.footerSave, isSavingInvoice ? styles.disabled : null]}
                >
                  {isSavingInvoice ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : null}
                  <Text style={styles.footerSaveText}>
                    {isSavingInvoice ? 'Enregistrement...' : 'Enregistrer la Facture'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Sélecteur de produit — overlay dans la modale (pas de Modal imbriquée). */}
          {showProductPicker ? (
            <View style={styles.pickerOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setShowProductPicker(false)}
                accessibilityLabel="Fermer"
              />
              <View style={styles.pickerPanel}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Choisir un produit</Text>
                  <Pressable
                    onPress={() => setShowProductPicker(false)}
                    hitSlop={8}
                    accessibilityLabel="Fermer"
                  >
                    <X size={18} color="#9CA3AF" />
                  </Pressable>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <Pressable
                    onPress={() => {
                      setSelectedProduct('');
                      setShowProductPicker(false);
                    }}
                    style={styles.pickerOption}
                  >
                    <Text style={styles.pickerOptionMuted}>Sélectionner un produit...</Text>
                  </Pressable>
                  {products.map((product) => {
                    const active = selectedProduct === product.id;
                    return (
                      <Pressable
                        key={product.id}
                        onPress={() => {
                          setSelectedProduct(product.id);
                          setShowProductPicker(false);
                        }}
                        style={[styles.pickerOption, active ? styles.pickerOptionActive : null]}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            active ? styles.pickerOptionTextActive : null,
                          ]}
                          numberOfLines={1}
                        >
                          {product.name} — {formatCurrency(product.price)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {products.length === 0 ? (
                    <Text style={styles.pickerEmpty}>Aucun produit</Text>
                  ) : null}
                </ScrollView>
              </View>
            </View>
          ) : null}

          <ToastViewport />
        </View>
      </Modal>

      {/* ─── Modale « Détail & PDF » ─── */}
      <Modal
        visible={selectedInvoice !== null && !isCreating}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelectedInvoice(null)}
      >
        <View style={styles.detailOverlay}>
          <View style={styles.detailPanel}>
            {/* En-tête mobile */}
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailNumber}>{selectedInvoice?.invoiceNumber}</Text>
                <Text style={styles.detailStatus}>
                  {getStatusLabel(selectedInvoice?.status)}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedInvoice(null)}
                hitSlop={8}
                style={styles.detailClose}
                accessibilityLabel="Fermer"
              >
                <X size={20} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Aperçu facture */}
            <ScrollView
              style={styles.previewScroll}
              contentContainerStyle={styles.previewContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedInvoice ? (
                <View style={styles.document}>
                  <View style={styles.documentBar} />

                  <Text style={styles.documentTitle}>Facture</Text>
                  <View style={styles.documentMeta}>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Numéro :</Text>
                      <Text style={styles.metaValueMono}>{selectedInvoice.invoiceNumber}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Date :</Text>
                      <Text style={styles.metaValue}>{formatFrDate(selectedInvoice.date)}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Échéance :</Text>
                      <Text style={styles.metaValue}>
                        {formatFrDate(selectedInvoice.dueDate)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.storeBox}>
                    <Text style={styles.storeName}>{storeSettings?.name || 'Boutique'}</Text>
                    <Text style={styles.storeAddress}>{storeSettings?.address || ''}</Text>
                    {storeSettings?.phone ? (
                      <Text style={styles.storePhone}>{storeSettings.phone}</Text>
                    ) : null}
                    {storeSettings?.email ? (
                      <Text style={styles.storeEmail}>{storeSettings.email}</Text>
                    ) : null}
                  </View>

                  <View style={styles.clientBox}>
                    <Text style={styles.clientBoxTitle}>Client</Text>
                    <Text style={styles.clientName}>
                      {selectedInvoice.customerName}
                    </Text>
                    {selectedInvoice.customerAddress ? (
                      <Text style={styles.clientAddress}>
                        {selectedInvoice.customerAddress}
                      </Text>
                    ) : null}
                    {selectedInvoice.customerEmail ? (
                      <Text style={styles.clientEmail}>{selectedInvoice.customerEmail}</Text>
                    ) : null}
                  </View>

                  {loadingInvoiceItems ? (
                    <View style={styles.itemsLoader}>
                      <ActivityIndicator size="small" color={COLORS.brand} />
                    </View>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.previewTableScroll}
                    >
                      <View style={styles.previewTable}>
                        <View style={styles.previewTableHead}>
                          <View style={[styles.ptCell, styles.colDesc]}>
                            <Text style={styles.ptHeadText}>Description</Text>
                          </View>
                          <View style={[styles.ptCell, styles.colQty]}>
                            <Text style={[styles.ptHeadText, styles.alignCenter]}>Qté</Text>
                          </View>
                          <View style={[styles.ptCell, styles.colUnit]}>
                            <Text style={[styles.ptHeadText, styles.alignRight]}>
                              Prix Un.
                            </Text>
                          </View>
                          <View style={[styles.ptCell, styles.colTotal]}>
                            <Text style={[styles.ptHeadText, styles.alignRight]}>Total</Text>
                          </View>
                        </View>
                        {selectedInvoiceItems.map((item, idx) => (
                          <View
                            key={item.id || idx}
                            style={[
                              styles.previewTableRow,
                              idx < selectedInvoiceItems.length - 1
                                ? styles.previewTableRowBorder
                                : null,
                            ]}
                          >
                            <View style={[styles.ptCell, styles.colDesc]}>
                              <Text style={styles.ptDescText}>{item.description}</Text>
                            </View>
                            <View style={[styles.ptCell, styles.colQty]}>
                              <Text style={[styles.ptQtyText, styles.alignCenter]}>
                                {item.quantity}
                              </Text>
                            </View>
                            <View style={[styles.ptCell, styles.colUnit]}>
                              <Text style={[styles.ptUnitText, styles.alignRight]}>
                                {formatCurrency(item.unitPrice)}
                              </Text>
                            </View>
                            <View style={[styles.ptCell, styles.colTotal]}>
                              <Text style={[styles.ptTotalText, styles.alignRight]}>
                                {formatCurrency(item.total)}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  )}

                  <View style={styles.docTotals}>
                    <View style={styles.docSubtotalRow}>
                      <Text style={styles.docSubtotalLabel}>Sous-total</Text>
                      <Text style={styles.docSubtotalValue}>
                        {formatCurrency(Number(selectedInvoice.subtotal) || 0)}
                      </Text>
                    </View>
                    <View style={styles.docTotalRow}>
                      <Text style={styles.docTotalLabel}>Total</Text>
                      <Text style={styles.docTotalValue}>
                        {formatCurrency(Number(selectedInvoice.total) || 0)}
                      </Text>
                    </View>
                  </View>

                  {selectedInvoice.notes ? (
                    <View style={styles.notesBlock}>
                      <Text style={styles.notesTitle}>Conditions & Notes</Text>
                      <Text style={styles.notesText}>{selectedInvoice.notes}</Text>
                    </View>
                  ) : null}

                  <Text style={styles.docFooter}>
                    Merci pour votre confiance. En cas de question concernant cette facture,
                    merci de nous contacter.
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            {/* Panneau d'actions */}
            <View style={styles.actionsPanel}>
              {!isSeller ? (
                <View style={styles.statusBlock}>
                  <Text style={styles.fieldLabel}>Statut</Text>
                  <View style={styles.statusSelect}>
                    {(['DRAFT', 'SENT', 'PAID', 'OVERDUE'] as const).map((status) => {
                      const active = selectedInvoice?.status === status;
                      const config = getStatusConfig(status);
                      return (
                        <Pressable
                          key={status}
                          onPress={() => handleStatusChange(status)}
                          style={[
                            styles.statusOption,
                            active
                              ? { backgroundColor: config.bg, borderColor: config.border }
                              : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusOptionText,
                              active ? { color: config.text } : null,
                            ]}
                          >
                            {config.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.actionsButtons}>
                <Pressable
                  onPress={handlePrint}
                  style={({ pressed }) => [styles.printBtn, pressed ? styles.pressed : null]}
                >
                  <Printer size={16} color="#6B7280" />
                  <Text style={styles.printBtnText}>Imprimer</Text>
                </Pressable>
                <Pressable
                  onPress={handleDownloadPDF}
                  disabled={isDownloadingPdf}
                  style={[styles.pdfBtn, isDownloadingPdf ? styles.disabled : null]}
                >
                  {isDownloadingPdf ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Download size={16} color="#FFFFFF" />
                  )}
                  <Text style={styles.pdfBtnText}>
                    {isDownloadingPdf ? 'Génération...' : 'PDF'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <ToastViewport />
        </View>
      </Modal>

      {/* Marge basse sûre sous la liste (barre de navigation de la coquille). */}
      <View style={{ height: insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FDFDFE',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },

  // ── En-tête ─────────────────────────────────────────────────────
  header: {
    gap: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  newBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Carte liste ─────────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  listLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  invoiceRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  invoiceRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  invoiceRowPressed: {
    backgroundColor: 'rgba(255,247,237,0.3)',
  },
  invoiceRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    overflow: 'hidden',
  },
  invoiceRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  invoiceIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  invoiceBody: {
    minWidth: 0,
    flexShrink: 1,
  },
  invoiceNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invoiceNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  invoiceDate: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  invoiceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  invoiceCustomer: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    maxWidth: 100,
  },
  invoiceDivider: {
    fontSize: 10,
    color: '#E5E7EB',
  },
  invoiceTotal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
  },
  invoiceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  statusPill: {
    padding: 4,
    // `mr-1` de l'icône du web (mr = 4 px en plus du padding droit).
    paddingRight: 8,
    borderRadius: 8,
    borderWidth: 1,
  },

  // ── État vide ───────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTextBlock: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Modale (commun) ─────────────────────────────────────────────
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  modalClose: {
    padding: 6,
  },

  // ── Modale « Nouvelle Facture » ─────────────────────────────────
  createPanel: {
    width: '100%',
    maxWidth: 896,
    maxHeight: '95%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 12,
  },
  createHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  createTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  createTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.4,
  },
  stepsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    position: 'relative',
    marginTop: 4,
  },
  stepsTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 15,
    height: 2,
    backgroundColor: '#F3F4F6',
  },
  stepsProgress: {
    position: 'absolute',
    left: 0,
    top: 15,
    height: 2,
    backgroundColor: COLORS.brand,
  },
  stepItem: {
    alignItems: 'center',
    zIndex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: COLORS.brand,
  },
  stepCircleIdle: {
    backgroundColor: '#F3F4F6',
  },
  stepCircleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#D1D5DB',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginTop: 8,
  },
  stepLabelActive: {
    color: COLORS.brand,
  },
  modalBody: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalBodyContent: {
    padding: 16,
  },
  stepBody: {
    gap: 24,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
  },
  fields: {
    gap: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  inputStrong: {
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: {
    flex: 1,
  },
  statusSelect: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    flexGrow: 1,
    flexBasis: '26%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
  },
  itemsTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    flexShrink: 1,
  },
  itemsBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  itemsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brand,
  },
  addBox: {
    backgroundColor: 'rgba(249,250,251,0.5)',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  addLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: 6,
    marginLeft: 4,
  },
  productSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  productSelectText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  productSelectPlaceholder: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  quantityBox: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  quantityBtn: {
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBtnLeft: {
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  quantityBtnRight: {
    borderLeftWidth: 1,
    borderLeftColor: '#F3F4F6',
  },
  quantityBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  quantityInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    padding: 0,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  addItemBtnDisabled: {
    opacity: 0.3,
  },
  addItemBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tableScroll: {
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  itemsTable: {
    minWidth: 500,
  },
  itemsTableHead: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemsTableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  itemsTableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  tdCell: {
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  colDesc: {
    flex: 1,
    minWidth: 160,
    paddingHorizontal: 16,
  },
  colQtyCreate: {
    width: 64,
  },
  colQty: {
    width: 64,
  },
  colUnit: {
    width: 96,
  },
  colTotal: {
    width: 96,
  },
  colTrash: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  alignCenter: {
    textAlign: 'center',
  },
  alignRight: {
    textAlign: 'right',
  },
  tdDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  tdQtyCell: {
    backgroundColor: 'rgba(255,247,237,0.3)',
    justifyContent: 'center',
  },
  tdQtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.brand,
    textAlign: 'center',
  },
  tdUnitText: {
    fontSize: 13,
    color: '#6B7280',
  },
  tdTotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  trashBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyItems: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#F3F4F6',
    borderRadius: 24,
  },
  emptyItemsCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyItemsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  emptyItemsText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  totalsWrap: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 24,
  },
  totalsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  totalsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  totalsValue: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  totalsTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  totalsTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  totalsTotalValue: {
    fontFamily: MONO_FONT,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.brand,
    letterSpacing: -0.5,
  },
  createFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  footerPrimary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#111827',
    borderRadius: 16,
    shadowColor: '#E5E7EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  footerPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerSave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: COLORS.brand,
    borderRadius: 16,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  footerSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Sélecteur de produit (overlay dans la modale) ───────────────
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  pickerPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    overflow: 'hidden',
    paddingBottom: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  pickerOptionActive: {
    backgroundColor: '#FFF7ED',
  },
  pickerOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  pickerOptionTextActive: {
    color: COLORS.brand,
  },
  pickerOptionMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  pickerEmpty: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    padding: 24,
  },

  // ── Modale « Détail & PDF » ─────────────────────────────────────
  detailOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  detailPanel: {
    width: '100%',
    maxWidth: 1024,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  detailNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  detailStatus: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  detailClose: {
    padding: 8,
    marginRight: -8,
  },
  previewScroll: {
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: 'rgba(249,250,251,0.5)',
  },
  previewContent: {
    padding: 8,
    alignItems: 'center',
  },
  document: {
    width: '100%',
    maxWidth: 800,
    minHeight: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  documentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: COLORS.brand,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: -0.8,
    marginTop: 4,
    marginBottom: 8,
  },
  documentMeta: {
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    width: 80,
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metaValue: {
    fontSize: 10,
    color: '#111827',
    flexShrink: 1,
  },
  metaValueMono: {
    fontSize: 10,
    fontWeight: '600',
    color: '#111827',
    fontFamily: MONO_FONT,
    flexShrink: 1,
  },
  storeBox: {
    marginTop: 24,
    marginBottom: 32,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.brand,
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  storePhone: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  storeEmail: {
    fontSize: 12,
    color: '#6B7280',
  },
  clientBox: {
    marginBottom: 32,
    backgroundColor: 'rgba(249,250,251,0.5)',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
  },
  clientBoxTitle: {
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
    marginBottom: 8,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  clientAddress: {
    fontSize: 12,
    color: '#4B5563',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  clientEmail: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.brand,
  },
  itemsLoader: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  previewTableScroll: {
    marginBottom: 32,
  },
  previewTable: {
    minWidth: 500,
  },
  previewTableHead: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 2,
    borderBottomColor: '#111827',
  },
  previewTableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  previewTableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  ptCell: {
    paddingVertical: 12,
    justifyContent: 'center',
  },
  ptHeadText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ptDescText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  ptQtyText: {
    fontSize: 12,
    color: '#4B5563',
  },
  ptUnitText: {
    fontSize: 12,
    color: '#4B5563',
  },
  ptTotalText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  docTotals: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 24,
  },
  docSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  docSubtotalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  docSubtotalValue: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: MONO_FONT,
  },
  docTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 2,
    borderTopColor: '#111827',
    paddingTop: 12,
    marginTop: 12,
  },
  docTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  docTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.brand,
    fontFamily: MONO_FONT,
    letterSpacing: -0.5,
  },
  notesBlock: {
    marginTop: 64,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  docFooter: {
    marginTop: 80,
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
  },
  actionsPanel: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 16,
  },
  statusBlock: {
    marginBottom: 16,
  },
  actionsButtons: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  printBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: 12,
  },
  printBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  pdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  pdfBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
