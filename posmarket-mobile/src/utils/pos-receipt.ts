/**
 * Reçu de caisse du POS — équivalent mobile de `src/utils/receipt.ts` du web.
 *
 * Le web écrit le ticket dans une iframe puis appelle `window.print()` (et
 * jsPDF pour le PDF). En natif, on réutilise exactement le même HTML
 * (ticket thermique 80 mm, Courier New) et on le confie à `expo-print` :
 * `printAsync` ouvre le dialogue d'impression système, `printToFileAsync`
 * génère le PDF partagé ensuite via la feuille de partage.
 */

import { formatCurrency } from '@/utils';
import { printAsync, printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
  /** Variante vendue (« Rouge / M »), affichée sous le nom du produit. */
  variantLabel?: string | null;
}

export interface ReceiptData {
  orderId: string;
  date: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  orderType: 'IN_STORE' | 'PICKUP';
  paymentMethod: string;
  customerName?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: {
    code: string;
    amount: number;
  };
  total: number;
}

/**
 * Échappe le HTML : le libellé de variante est saisi par le vendeur et
 * recopié tel quel dans le ticket.
 */
function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Génère le HTML autonome et stylisé pour le ticket thermique 80mm. */
export function buildPosReceiptHtml(data: ReceiptData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 4px 0; text-align: left; vertical-align: top; word-break: break-word;">${item.name}${item.variantLabel ? `<br><span style="font-size: 9px; color: #555;">${escHtml(item.variantLabel)}</span>` : ''}</td>
      <td style="padding: 4px 0; text-align: center; vertical-align: top; white-space: nowrap;">x${item.quantity}${item.unit && item.unit !== 'pièce' ? ` ${item.unit}` : ''}</td>
      <td style="padding: 4px 0; text-align: right; vertical-align: top; white-space: nowrap;">${formatCurrency(item.total)}</td>
    </tr>
  `,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Recu-${data.orderId}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 2mm;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        margin: 0;
        padding: 6mm 4mm;
        font-family: 'Courier New', Courier, monospace;
        font-size: 10pt;
        color: #000;
        background: #fff;
        width: 80mm;
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .border-b { border-bottom: 1px dashed #333; padding-bottom: 6px; margin-bottom: 6px; }
      .border-t { border-top: 1px dashed #333; padding-top: 6px; margin-top: 6px; }
      table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 9.5pt; }
      .row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 9pt; }
      .total-row { display: flex; justify-content: space-between; font-size: 12pt; font-weight: bold; margin-top: 6px; }

      @media print {
        body {
          width: 80mm !important;
          margin: 0 !important;
          padding: 4mm !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="center border-b">
      <div class="bold" style="font-size: 13pt; text-transform: uppercase;">${data.storeName}</div>
      ${data.storeAddress ? `<div style="font-size: 8.5pt; margin-top: 2px;">${data.storeAddress}</div>` : ''}
      ${data.storePhone || data.storeEmail ? `<div style="font-size: 8pt; margin-top: 2px;">${[data.storePhone, data.storeEmail].filter(Boolean).join(' • ')}</div>` : ''}
    </div>

    <div class="border-b">
      <div class="row"><span>DATE:</span><span>${data.date}</span></div>
      <div class="row"><span>CMD:</span><span class="bold">#${data.orderId}</span></div>
      <div class="row"><span>TYPE:</span><span>${data.orderType === 'PICKUP' ? 'CLICK & COLLECT' : 'EN MAGASIN'}</span></div>
      <div class="row"><span>PAIEMENT:</span><span>${data.paymentMethod}</span></div>
      ${data.customerName ? `<div class="row"><span>CLIENT:</span><span>${data.customerName}</span></div>` : ''}
    </div>

    <table>
      <thead>
        <tr style="border-bottom: 1px dashed #333;">
          <th style="text-align: left; padding-bottom: 4px;">ARTICLE</th>
          <th style="text-align: center; padding-bottom: 4px;">QTE</th>
          <th style="text-align: right; padding-bottom: 4px;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="border-t">
      <div class="row"><span>SOUS-TOTAL:</span><span>${formatCurrency(data.subtotal)}</span></div>
      ${data.discount ? `<div class="row"><span>REMISE (${data.discount.code}):</span><span>-${formatCurrency(data.discount.amount)}</span></div>` : ''}
      <div class="total-row border-t"><span>TOTAL:</span><span>${formatCurrency(data.total)}</span></div>
    </div>

    <div class="center" style="margin-top: 14px; font-size: 8.5pt;">
      MERCI DE VOTRE VISITE !
    </div>
  </body>
</html>`;
}

/** Imprime le ticket de caisse (dialogue d'impression du système). */
export async function printPosReceipt(data: ReceiptData): Promise<void> {
  await printAsync({ html: buildPosReceiptHtml(data) });
}

/** Génère le reçu PDF puis ouvre la feuille de partage (téléchargement). */
export async function downloadPosReceiptPdf(data: ReceiptData): Promise<void> {
  const { uri } = await printToFileAsync({ html: buildPosReceiptHtml(data) });
  if (await isAvailableAsync()) {
    await shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Recu-${data.orderId}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
