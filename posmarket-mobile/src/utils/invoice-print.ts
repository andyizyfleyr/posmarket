/**
 * Impression / PDF de la facture — équivalent mobile de `handlePrint` et
 * `handleDownloadPDF` de `src/views/InvoicesView.tsx` du web.
 *
 * Le web imprime le nœud `#invoice-print` via `window.print()` et génère un
 * PDF avec html2canvas + jsPDF (inexistants en React Native). Ici on
 * reconstruit le même document (facture A4, `#f56b2a`) en HTML autonome et on
 * le confie à `expo-print` — même patron que `pos-receipt.ts` :
 * `printAsync` ouvre le dialogue d'impression système, `printToFileAsync`
 * génère le PDF partagé ensuite via la feuille de partage.
 *
 * HTML : toutes les valeurs saisies (client, notes, descriptions) sont
 * échappées avant insertion.
 */

import { printAsync, printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { formatCurrency } from '@/utils';
import type {
  InvoiceStoreSettings,
  SellerInvoice,
  SellerInvoiceItem,
} from '@/api/seller-invoices';

/** Échappe le HTML (valeurs client/notes/descriptions saisies ou importées). */
function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Date au format fr-FR (« jj/mm/aaaa »), comme `toLocaleDateString` au web. */
function formatFrDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR');
}

/** Description par défaut d'une ligne d'article (comme l'aperçu web). */
function itemDescription(item: SellerInvoiceItem): string {
  return item.description || '';
}

/**
 * Document de facture autonome — reproduction de l'aperçu `#invoice-print`
 * du web (mis en page pour l'A4, comme le CSS d'impression du site).
 */
export function buildInvoiceHtml(
  invoice: SellerInvoice,
  items: SellerInvoiceItem[],
  storeSettings?: InvoiceStoreSettings | null,
): string {
  const storeName = storeSettings?.name || 'Boutique';
  const storeAddress = storeSettings?.address || '';
  const storePhone = storeSettings?.phone || '';
  const storeEmail = storeSettings?.email || '';

  const rowsHtml = items
    .map(
      (item) => `
      <tr>
        <td class="desc">${escHtml(itemDescription(item))}</td>
        <td class="qty">${item.quantity}</td>
        <td class="num">${formatCurrency(item.unitPrice)}</td>
        <td class="num strong">${formatCurrency(item.total)}</td>
      </tr>`,
    )
    .join('');

  const customerName = invoice.customerName || 'Client';
  const customerAddress = invoice.customerAddress || '';
  const customerEmail = invoice.customerEmail || '';
  const notes = invoice.notes || '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Facture-${escHtml(invoice.invoiceNumber || invoice.id)}</title>
    <style>
      @page {
        size: A4;
        margin: 12mm;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
        color: #111827;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .doc {
        max-width: 794px;
        margin: 0 auto;
        border: 1px solid #e5e7eb;
        padding: 48px;
        position: relative;
        min-height: 500px;
      }
      .bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 8px;
        background: #f56b2a;
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        margin-top: 16px;
        margin-bottom: 48px;
      }
      h1 {
        font-size: 36px;
        font-weight: 700;
        letter-spacing: -1px;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .meta {
        color: #6b7280;
        font-size: 14px;
        line-height: 1.7;
      }
      .meta-label {
        font-weight: 600;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        display: inline-block;
        width: 96px;
      }
      .meta-value {
        color: #111827;
      }
      .mono {
        font-family: 'Courier New', Courier, monospace;
        font-weight: 700;
      }
      .store {
        text-align: right;
        font-size: 14px;
      }
      .store h2 {
        font-size: 20px;
        font-weight: 700;
        color: #f56b2a;
        margin-bottom: 8px;
      }
      .store-address {
        color: #6b7280;
        white-space: pre-line;
        line-height: 1.6;
      }
      .store-phone {
        color: #374151;
        font-weight: 600;
        margin-top: 8px;
      }
      .store-email {
        color: #6b7280;
      }
      .client {
        background: #f9fafb;
        border: 1px solid #f3f4f6;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 48px;
      }
      .client h3 {
        font-size: 10px;
        font-weight: 700;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        padding-bottom: 8px;
        margin-bottom: 8px;
        border-bottom: 1px solid #e5e7eb;
      }
      .client-name {
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .client-address {
        font-size: 14px;
        color: #4b5563;
        font-style: italic;
        white-space: pre-line;
        margin-bottom: 4px;
      }
      .client-email {
        font-size: 14px;
        color: #f56b2a;
        font-weight: 600;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 32px;
      }
      thead tr {
        border-bottom: 2px solid #111827;
      }
      th {
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        text-align: left;
        padding: 12px 0;
      }
      th.center,
      td.qty {
        text-align: center;
      }
      th.right,
      td.num {
        text-align: right;
      }
      tbody tr {
        border-bottom: 1px solid #f3f4f6;
      }
      td {
        padding: 16px 0;
        font-size: 14px;
      }
      td.desc {
        font-weight: 600;
        color: #1f2937;
      }
      td.qty {
        color: #4b5563;
      }
      td.num {
        color: #4b5563;
      }
      td.strong {
        color: #111827;
        font-weight: 700;
      }
      .totals {
        display: flex;
        justify-content: flex-end;
        border-top: 1px solid #e5e7eb;
        padding-top: 24px;
      }
      .totals-inner {
        width: 288px;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        color: #6b7280;
      }
      .total-row span:first-child {
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .grand-total {
        display: flex;
        justify-content: space-between;
        font-size: 20px;
        font-weight: 700;
        color: #f56b2a;
        border-top: 2px solid #111827;
        padding-top: 12px;
        margin-top: 12px;
      }
      .grand-total span:first-child {
        text-transform: uppercase;
        letter-spacing: -0.5px;
      }
      .notes {
        margin-top: 64px;
        padding-top: 24px;
        border-top: 1px solid #f3f4f6;
      }
      .notes h3 {
        font-size: 10px;
        font-weight: 700;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        margin-bottom: 8px;
      }
      .notes p {
        font-size: 14px;
        color: #4b5563;
        white-space: pre-line;
      }
      .footer {
        margin-top: 80px;
        text-align: center;
        font-size: 12px;
        color: #9ca3af;
      }
    </style>
  </head>
  <body>
    <div class="doc">
      <div class="bar"></div>

      <div class="head">
        <div>
          <h1>Facture</h1>
          <div class="meta">
            <p><span class="meta-label">Numéro :</span> <span class="meta-value mono">${escHtml(invoice.invoiceNumber || '')}</span></p>
            <p><span class="meta-label">Date :</span> <span class="meta-value">${formatFrDate(invoice.date)}</span></p>
            <p><span class="meta-label">Échéance :</span> <span class="meta-value">${formatFrDate(invoice.dueDate)}</span></p>
          </div>
        </div>
        <div class="store">
          <h2>${escHtml(storeName)}</h2>
          ${storeAddress ? `<p class="store-address">${escHtml(storeAddress)}</p>` : ''}
          ${storePhone ? `<p class="store-phone">${escHtml(storePhone)}</p>` : ''}
          ${storeEmail ? `<p class="store-email">${escHtml(storeEmail)}</p>` : ''}
        </div>
      </div>

      <div class="client">
        <h3>Client</h3>
        <div class="client-name">${escHtml(customerName)}</div>
        ${customerAddress ? `<div class="client-address">${escHtml(customerAddress)}</div>` : ''}
        ${customerEmail ? `<div class="client-email">${escHtml(customerEmail)}</div>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="center" style="width: 64px;">Qté</th>
            <th class="right" style="width: 96px;">Prix Un.</th>
            <th class="right" style="width: 96px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-inner">
          <div class="total-row">
            <span>Sous-total</span>
            <span class="mono">${formatCurrency(Number(invoice.subtotal) || 0)}</span>
          </div>
          <div class="grand-total">
            <span>Total</span>
            <span class="mono">${formatCurrency(Number(invoice.total) || 0)}</span>
          </div>
        </div>
      </div>

      ${
        notes
          ? `<div class="notes">
              <h3>Conditions &amp; Notes</h3>
              <p>${escHtml(notes)}</p>
            </div>`
          : ''
      }

      <div class="footer">Merci pour votre confiance. En cas de question concernant cette facture, merci de nous contacter.</div>
    </div>
  </body>
</html>`;
}

/** Imprime la facture (dialogue d'impression du système). */
export async function printInvoice(
  invoice: SellerInvoice,
  items: SellerInvoiceItem[],
  storeSettings?: InvoiceStoreSettings | null,
): Promise<void> {
  await printAsync({ html: buildInvoiceHtml(invoice, items, storeSettings) });
}

/** Génère le PDF de la facture puis ouvre la feuille de partage. */
export async function downloadInvoicePdf(
  invoice: SellerInvoice,
  items: SellerInvoiceItem[],
  storeSettings?: InvoiceStoreSettings | null,
): Promise<void> {
  const { uri } = await printToFileAsync({ html: buildInvoiceHtml(invoice, items, storeSettings) });
  if (await isAvailableAsync()) {
    await shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Facture-${invoice.invoiceNumber || invoice.id}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
