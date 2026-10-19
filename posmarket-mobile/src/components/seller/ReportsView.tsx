/**
 * Rapports (Historique) vendeur — copie fidèle de `src/views/ReportsView.tsx`
 * du web (rendu mobile < 768 px) : en-tête (« Historique » + boutons
 * « Période » / « Filtrer » inertes comme au web), liste défilante des
 * 100 dernières commandes (pastille fichier, n° + heure, client | montant,
 * badge de paiement ESP/MM/CBE/VIR, chevron), état vide, et modale centrée
 * « Détails de commande » (client, paiement, articles, aperçu du reçu).
 *
 * Écarts assumés :
 * - « Imprimer » et « Télécharger PDF » passent par `expo-print` (dialogue
 *   d'impression système, PDF partagé via la feuille native) au lieu de
 *   `window.print()` / jsPDF + html2canvas du web ;
 * - les échecs d'impression/PDF déclenchent un toast d'erreur global (le web
 *   ne journalise qu'en console) ;
 * - « Période » et « Filtrer » restent décoratifs : le web n'a aucun onClick.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { printAsync, printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Filter,
  Printer,
  User,
  X,
} from 'lucide-react-native';
import { useToast } from '@/components/ToastProvider';
import { COLORS } from '@/theme';
import { formatCurrency } from '@/utils';
import { resolveImageUrl } from '@/api/client';
import type {
  ReportsOrder,
  ReportsOrderItem,
  ReportsStoreSettings,
} from '@/api/seller-reports';

/** Police du ticket (web : `font-mono`). */
const MONO_FONT = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

/** Libellé court du moyen de paiement dans la liste (web : ESP/MM/CBE/VIR). */
function paymentBadgeLabel(paymentMethod?: string): string {
  if (paymentMethod === 'CASH') return 'ESP';
  if (paymentMethod === 'MOBILE_MONEY') return 'MM';
  if (paymentMethod === 'CARD') return 'CBE';
  return 'VIR';
}

/** Libellé du moyen de paiement dans la modale (MOBILE_MONEY inclus dans « Virement »). */
function paymentFullLabel(paymentMethod?: string): string {
  if (paymentMethod === 'CASH') return 'Espèces';
  if (paymentMethod === 'CARD') return 'Carte B.';
  return 'Virement';
}

/** Quantité × prix de la section « Articles » : « 3 kg x 500 FCFA » ou « 2 x 500 FCFA ». */
function articleUnitMeta(item: ReportsOrderItem): string {
  const unit =
    item.product?.unit && item.product.unit !== 'pièce' ? ` ${item.product.unit}` : '';
  return `${item.quantity}${unit} x ${formatCurrency(item.product?.price || 0)}`;
}

/** Quantité × prix du ticket : « 3 kg 500 FCFA » ou « 2x 500 FCFA » (comme au web). */
function receiptUnitMeta(item: ReportsOrderItem): string {
  const unit = item.product?.unit && item.product.unit !== 'pièce' ? ` ${item.product.unit}` : 'x';
  return `${item.quantity}${unit} ${formatCurrency(item.product?.price || 0)}`;
}

/** Échappe le HTML du ticket (noms produits, variantes et réglages saisis). */
function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Ticket du reçu (équivalent HTML du bloc `#receipt-print` du web, 80 mm) :
 * même contenu que le ticket affiché dans la modale.
 */
function buildReceiptHtml(
  order: ReportsOrder,
  storeSettings?: ReportsStoreSettings | null,
): string {
  const settings = storeSettings || {};
  const contact = [settings.phone, settings.email].filter(Boolean).join(' • ');
  const itemsHtml = order.items
    .map(
      (item) => `
    <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;">
      <span style="flex-grow:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(item.product?.name || '')}${item.variantLabel ? ` (${escHtml(item.variantLabel)})` : ''}</span>
      <span style="flex-shrink:0;">${receiptUnitMeta(item)}</span>
    </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Recu-${order.id}</title>
    <style>
      @page { size: 80mm auto; margin: 2mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        margin: 0;
        padding: 6mm 4mm;
        font-family: 'Courier New', Courier, monospace;
        font-size: 9pt;
        line-height: 1.25;
        color: #000;
        background: #fff;
        width: 80mm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .ticket-header { text-align: center; margin-bottom: 16px; border-bottom: 1px dashed #D1D5DB; padding-bottom: 16px; }
      .store-name { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: -0.5px; }
      .address { font-size: 7pt; color: #4B5563; margin-top: 4px; }
      .contact { font-size: 7pt; color: #6B7280; margin-top: 2px; }
      .cmd { margin-top: 12px; font-size: 7pt; color: #6B7280; }
      .items { margin-bottom: 16px; }
      .total-wrap { border-top: 1px dashed #D1D5DB; padding-top: 12px; }
      .total-row {
        display: flex; justify-content: space-between;
        font-size: 16px; font-weight: bold; color: #F56B2A;
        margin-top: 8px; padding-top: 8px; border-top: 1px solid #E5E7EB;
      }
      .ticket-footer {
        margin-top: 24px; text-align: center;
        font-size: 7pt; font-weight: 600; color: #9CA3AF;
        border-top: 1px dashed #D1D5DB; padding-top: 16px;
      }
    </style>
  </head>
  <body>
    <div class="ticket-header">
      <div class="store-name">${escHtml(settings.name || 'Boutique')}</div>
      <div class="address">${escHtml(settings.address || '')}</div>
      <div class="contact">${escHtml(contact)}</div>
      <div class="cmd">
        CMD #${order.id.slice(-8).toUpperCase()}<br>
        ${escHtml(new Date(order.date).toLocaleString('fr-FR'))}
      </div>
    </div>
    <div class="items">${itemsHtml}</div>
    <div class="total-wrap">
      <div class="total-row"><span>TOTAL:</span><span>${formatCurrency(order.total)}</span></div>
    </div>
    <div class="ticket-footer">MERCI DE VOTRE VISITE !</div>
  </body>
</html>`;
}

interface SellerReportsViewProps {
  orders: ReportsOrder[];
  storeSettings?: ReportsStoreSettings | null;
  /** Tirer vers le bas : recharge les données de l'écran (route parente). */
  onRefresh?: () => Promise<void> | void;
}

export function SellerReportsView({ orders, storeSettings, onRefresh }: SellerReportsViewProps) {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);
  const { notify } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<ReportsOrder | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  /** Équivalent web : `window.print()` sur le ticket de la boutique. */
  const handlePrint = () => {
    if (!selectedOrder) return;
    try {
      void printAsync({ html: buildReceiptHtml(selectedOrder, storeSettings) }).catch((err) => {
        console.error('Error printing receipt:', err);
        notify("Erreur lors de l'impression du reçu", 'error');
      });
    } catch (err) {
      console.error('Error printing receipt:', err);
      notify("Erreur lors de l'impression du reçu", 'error');
    }
  };

  /** Équivalent web : capture html2canvas → PDF 80 mm nommé `Recu-{id}.pdf`. */
  const handleDownloadPDF = async () => {
    if (!selectedOrder || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const { uri } = await printToFileAsync({
        html: buildReceiptHtml(selectedOrder, storeSettings),
      });
      if (await isAvailableAsync()) {
        await shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Recu-${selectedOrder.id}`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (err) {
      console.error('Error generating receipt PDF:', err);
      notify('Erreur lors du téléchargement du PDF', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* En-tête */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Historique</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Consultez vos transactions passées.
          </Text>
        </View>
        {/* Boutons inertes comme au web (aucun onClick). */}
        <View style={styles.headerButtons}>
          <View style={styles.headerBtn}>
            <Calendar size={14} color="#4B5563" />
            <Text style={styles.headerBtnText}>Période</Text>
          </View>
          <View style={styles.headerBtn}>
            <Filter size={14} color="#4B5563" />
            <Text style={styles.headerBtnText}>Filtrer</Text>
          </View>
        </View>
      </View>

      {/* Carte liste */}
      <View style={styles.card}>
        {orders.length > 0 ? (
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
            {orders.map((order, index) => (
              <Pressable
                key={order.id}
                onPress={() => setSelectedOrder(order)}
                style={[
                  styles.orderRow,
                  index < orders.length - 1 ? styles.orderRowBorder : null,
                ]}
              >
                <View style={styles.orderRowTop}>
                  <View style={styles.orderRowLeft}>
                    <View style={styles.orderIconPill}>
                      <FileText size={14} color={COLORS.brand} />
                    </View>
                    <View style={styles.orderBody}>
                      <View style={styles.orderIdRow}>
                        <Text style={styles.orderId} numberOfLines={1}>
                          #{order.id.slice(-6).toUpperCase()}
                        </Text>
                        <Text style={styles.orderTime}>
                          {new Date(order.date).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <View style={styles.orderMetaRow}>
                        <Text style={styles.orderCustomer} numberOfLines={1}>
                          {order.customer?.name || 'Passage'}
                        </Text>
                        <Text style={styles.orderSeparator}>|</Text>
                        <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.orderRight}>
                    <View
                      style={[
                        styles.paymentBadge,
                        order.paymentMethod === 'CASH'
                          ? styles.paymentBadgeCash
                          : styles.paymentBadgeOther,
                      ]}
                    >
                      <Text
                        style={[
                          styles.paymentBadgeText,
                          order.paymentMethod === 'CASH'
                            ? styles.paymentBadgeTextCash
                            : styles.paymentBadgeTextOther,
                        ]}
                      >
                        {paymentBadgeLabel(order.paymentMethod)}
                      </Text>
                    </View>
                    <ChevronRight size={12} color="#D1D5DB" />
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <FileText size={64} color="#9CA3AF" />
            </View>
            <View style={styles.emptyStateTextWrap}>
              <Text style={styles.emptyStateTitle}>Aucune commande</Text>
              <Text style={styles.emptyStateSubtitle}>Les ventes apparaîtront ici.</Text>
            </View>
          </View>
        )}
      </View>

      {/* Modale Détails de commande (centrée, comme au web) */}
      <Modal
        visible={selectedOrder !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          {selectedOrder ? (
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    Commande #{selectedOrder.id.slice(-6).toUpperCase()}
                  </Text>
                  <Text style={styles.modalDate}>
                    {new Date(selectedOrder.date).toLocaleString('fr-FR')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedOrder(null)}
                  hitSlop={8}
                  style={styles.modalClose}
                  accessibilityLabel="Fermer"
                >
                  <X size={18} color="#9CA3AF" />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalInfoColumn}>
                  {/* Client + Paiement */}
                  <View style={styles.infoGrid}>
                    <View style={styles.infoSection}>
                      <Text style={styles.sectionLabel}>Client</Text>
                      <View style={styles.infoCard}>
                        {selectedOrder.customer ? (
                          <View style={styles.infoRow}>
                            <View style={styles.customerAvatar}>
                              <Text style={styles.customerAvatarText}>
                                {selectedOrder.customer.name?.[0]}
                              </Text>
                            </View>
                            <View style={styles.infoTextCol}>
                              <Text style={styles.customerName} numberOfLines={1}>
                                {selectedOrder.customer.name}
                              </Text>
                              <Text style={styles.customerEmail} numberOfLines={1}>
                                {selectedOrder.customer.email}
                              </Text>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.infoRow}>
                            <View style={styles.anonymousAvatar}>
                              <User size={18} color="#9CA3AF" />
                            </View>
                            <Text style={styles.anonymousText}>Passage</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.infoSection}>
                      <Text style={styles.sectionLabel}>Paiement</Text>
                      <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                          <View style={styles.paymentAvatar}>
                            <CreditCard size={18} color="#FFFFFF" />
                          </View>
                          <View style={styles.infoTextCol}>
                            <Text style={styles.paymentLabel} numberOfLines={1}>
                              {paymentFullLabel(selectedOrder.paymentMethod)}
                            </Text>
                            <View style={styles.paidRow}>
                              <CheckCircle2 size={8} color="#16A34A" />
                              <Text style={styles.paidText}>Payé</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Articles */}
                  <Text style={styles.articlesLabel}>Articles</Text>
                  <View style={styles.articlesList}>
                    {selectedOrder.items.map((item, idx) => (
                      <View key={idx} style={styles.articleRow}>
                        <View style={styles.articleThumb}>
                          {item.product?.image ? (
                            <Image
                              source={{ uri: resolveImageUrl(item.product.image) }}
                              style={styles.articleImage}
                              contentFit="cover"
                              alt=""
                            />
                          ) : null}
                        </View>
                        <View style={styles.articleBody}>
                          <Text style={styles.articleName} numberOfLines={1}>
                            {item.product?.name}
                          </Text>
                          {item.product?.sku ? (
                            <Text style={styles.articleSku} numberOfLines={1}>
                              {item.product.sku}
                            </Text>
                          ) : null}
                          {item.variantLabel ? (
                            <Text style={styles.articleVariant}>{item.variantLabel}</Text>
                          ) : null}
                        </View>
                        <View style={styles.articleRight}>
                          <Text style={styles.articleUnitMeta}>{articleUnitMeta(item)}</Text>
                          <Text style={styles.articleTotal}>
                            {formatCurrency(item.quantity * (item.product?.price || 0))}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Aperçu du Reçu */}
                <View style={styles.receiptSection}>
                  <Text style={styles.receiptSectionTitle}>Aperçu du Reçu</Text>

                  <View style={styles.receipt}>
                    <View style={styles.receiptHeader}>
                      <Text style={styles.receiptStoreName}>
                        {storeSettings?.name || 'Boutique'}
                      </Text>
                      {storeSettings?.address ? (
                        <Text style={styles.receiptAddress}>{storeSettings.address}</Text>
                      ) : null}
                      {[storeSettings?.phone, storeSettings?.email].filter(Boolean).length > 0 ? (
                        <Text style={styles.receiptContact}>
                          {[storeSettings?.phone, storeSettings?.email]
                            .filter(Boolean)
                            .join(' • ')}
                        </Text>
                      ) : null}
                      <View style={styles.receiptCmdBlock}>
                        <Text style={styles.receiptCmd}>
                          CMD #{selectedOrder.id.slice(-8).toUpperCase()}
                        </Text>
                        <Text style={styles.receiptCmd}>
                          {new Date(selectedOrder.date).toLocaleString('fr-FR')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.receiptItems}>
                      {selectedOrder.items.map((item, idx) => (
                        <View key={idx} style={styles.receiptItemRow}>
                          <Text style={styles.receiptItemName} numberOfLines={1}>
                            {item.product?.name}
                            {item.variantLabel ? ` (${item.variantLabel})` : ''}
                          </Text>
                          <Text style={styles.receiptItemPrice}>{receiptUnitMeta(item)}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.receiptTotalWrap}>
                      <View style={styles.receiptTotalRow}>
                        <Text style={styles.receiptTotalText}>TOTAL:</Text>
                        <Text style={styles.receiptTotalText}>
                          {formatCurrency(selectedOrder.total)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.receiptFooter}>
                      <Text style={styles.receiptFooterText}>MERCI DE VOTRE VISITE !</Text>
                    </View>
                  </View>

                  <View style={styles.receiptActions}>
                    <Pressable onPress={handlePrint} style={styles.printBtn}>
                      <Printer size={16} color="#4B5563" />
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
                        {isDownloadingPdf ? 'Génération...' : 'Télécharger PDF'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FDFDFE',
    padding: 12,
  },
  header: {
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  orderRow: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  orderRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  orderRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    overflow: 'hidden',
  },
  orderRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  orderIconPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  orderBody: {
    minWidth: 0,
    flexShrink: 1,
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  orderTime: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  orderCustomer: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    maxWidth: 70,
  },
  orderSeparator: {
    fontSize: 10,
    color: '#E5E7EB',
  },
  orderTotal: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brand,
  },
  orderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  paymentBadge: {
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 4,
  },
  paymentBadgeCash: {
    backgroundColor: '#F0FDF4',
  },
  paymentBadgeOther: {
    backgroundColor: '#EFF6FF',
  },
  paymentBadgeText: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  paymentBadgeTextCash: {
    color: '#16A34A',
  },
  paymentBadgeTextOther: {
    color: '#2563EB',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 80,
    gap: 16,
  },
  emptyStateIcon: {
    opacity: 0.1,
  },
  emptyStateTextWrap: {
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Modale Détails ──────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 896,
    maxHeight: '90%',
    flexShrink: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.25,
    shadowRadius: 50,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalHeaderText: {
    flexShrink: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  modalDate: {
    fontSize: 8,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  modalClose: {
    padding: 6,
    borderRadius: 999,
    marginLeft: 8,
  },
  modalBody: {
    flexShrink: 1,
  },
  modalBodyContent: {
    flexGrow: 0,
  },
  modalInfoColumn: {
    padding: 12,
  },
  infoGrid: {
    gap: 12,
    marginBottom: 16,
  },
  infoSection: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  infoCard: {
    backgroundColor: 'rgba(249,250,251,0.5)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F9FAFB',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoTextCol: {
    minWidth: 0,
    flexShrink: 1,
  },
  customerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  customerAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customerName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  customerEmail: {
    fontSize: 9,
    color: '#6B7280',
  },
  anonymousAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonymousText: {
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
    color: '#9CA3AF',
  },
  paymentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DCFCE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  paymentLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    lineHeight: 11,
  },
  paidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paidText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#16A34A',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  articlesLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  articlesList: {
    gap: 8,
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F9FAFB',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  articleThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    flexShrink: 0,
  },
  articleImage: {
    width: '100%',
    height: '100%',
  },
  articleBody: {
    flex: 1,
    minWidth: 0,
  },
  articleName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
  },
  articleSku: {
    fontSize: 8,
    color: '#9CA3AF',
    fontFamily: MONO_FONT,
  },
  articleVariant: {
    fontSize: 8,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  articleRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  articleUnitMeta: {
    fontSize: 8,
    fontWeight: '600',
    color: '#9CA3AF',
    lineHeight: 10,
  },
  articleTotal: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brand,
  },

  // ── Aperçu du Reçu ──────────────────────────────────────────────
  receiptSection: {
    width: '100%',
    backgroundColor: 'rgba(249,250,251,0.5)',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 16,
    alignItems: 'center',
  },
  receiptSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  receipt: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.25,
    shadowRadius: 50,
    elevation: 8,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: '#D1D5DB',
    paddingBottom: 16,
  },
  receiptStoreName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: -0.4,
    fontFamily: MONO_FONT,
    textAlign: 'center',
  },
  receiptAddress: {
    fontSize: 9,
    color: '#4B5563',
    marginTop: 4,
    fontFamily: MONO_FONT,
    textAlign: 'center',
  },
  receiptContact: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: MONO_FONT,
    textAlign: 'center',
  },
  receiptCmdBlock: {
    marginTop: 12,
  },
  receiptCmd: {
    fontSize: 9,
    color: '#6B7280',
    fontFamily: MONO_FONT,
    lineHeight: 11,
    textAlign: 'center',
  },
  receiptItems: {
    width: '100%',
    gap: 4,
    marginBottom: 16,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  receiptItemName: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
    fontFamily: MONO_FONT,
    lineHeight: 15,
  },
  receiptItemPrice: {
    flexShrink: 0,
    fontSize: 12,
    color: '#111827',
    fontFamily: MONO_FONT,
    lineHeight: 15,
  },
  receiptTotalWrap: {
    width: '100%',
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: '#D1D5DB',
    paddingTop: 12,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
    paddingTop: 8,
  },
  receiptTotalText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.brand,
    fontFamily: MONO_FONT,
  },
  receiptFooter: {
    width: '100%',
    marginTop: 24,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: '#D1D5DB',
    paddingTop: 16,
    alignItems: 'center',
  },
  receiptFooterText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
    fontFamily: MONO_FONT,
    textAlign: 'center',
  },
  receiptActions: {
    width: '100%',
    marginTop: 24,
    gap: 10,
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  printBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  pdfBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.6,
  },
});
