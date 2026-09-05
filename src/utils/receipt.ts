import { formatCurrency } from '@/utils';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
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
 * Génère le HTML autonome et stylisé pour le ticket thermique 80mm.
 */
function buildReceiptHtml(data: ReceiptData): string {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 4px 0; text-align: left; vertical-align: top; word-break: break-word;">${item.name}</td>
      <td style="padding: 4px 0; text-align: center; vertical-align: top; white-space: nowrap;">x${item.quantity}${item.unit && item.unit !== 'pièce' ? ` ${item.unit}` : ''}</td>
      <td style="padding: 4px 0; text-align: right; vertical-align: top; white-space: nowrap;">${formatCurrency(item.total)}</td>
    </tr>
  `).join('');

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

/**
 * Imprime le ticket de caisse thermique 80mm via un iframe isolé.
 * L'iframe est dimensionné avec une vraie largeur (80mm) et placé hors-écran
 * pour que le moteur de rendu de Chrome ne produise pas de page blanche.
 */
export function printPosReceipt(data: ReceiptData): void {
  // Nettoyer les anciens iframes d'impression
  document.querySelectorAll('iframe[data-pos-receipt]').forEach(el => el.remove());

  const iframe = document.createElement('iframe');
  iframe.setAttribute('data-pos-receipt', 'true');
  // Dimensions réelles avec positionnement hors-écran (évite page blanche sous Chrome)
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '80mm';
  iframe.style.height = '800px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    console.error('[printPosReceipt] Cannot access iframe document');
    iframe.remove();
    return;
  }

  const html = buildReceiptHtml(data);
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('[printPosReceipt] Print failed:', e);
    }
    // Nettoyer après la fermeture du dialogue d'impression
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        iframe.remove();
      }
    }, 4000);
  };

  // Délai pour que le document soit complètement peint
  setTimeout(triggerPrint, 400);
}

/**
 * Génère et télécharge un reçu PDF au format thermique 80mm vectoriel.
 * Ultra rapide, fiable, fonctionne sur mobile et ordinateur sans dépendre de html2canvas.
 */
export async function downloadPosReceiptPdf(data: ReceiptData): Promise<void> {
  const jspdfModule = await import('jspdf');
  const jsPDF = jspdfModule.jsPDF || (jspdfModule as any).default || jspdfModule;

  const itemHeight = 6;
  const baseHeight = 85 + (data.discount ? 8 : 0) + (data.customerName ? 6 : 0);
  const calculatedHeight = Math.max(110, baseHeight + data.items.length * itemHeight);
  const pdfWidth = 80;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pdfWidth, calculatedHeight]
  });

  let y = 8;
  const leftX = 5;
  const rightX = pdfWidth - 5;
  const centerX = pdfWidth / 2;

  // Header: Nom de la boutique
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.text(data.storeName.toUpperCase(), centerX, y, { align: 'center' });
  y += 5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  if (data.storeAddress) {
    doc.text(data.storeAddress, centerX, y, { align: 'center' });
    y += 3.5;
  }
  const contact = [data.storePhone, data.storeEmail].filter(Boolean).join(' • ');
  if (contact) {
    doc.text(contact, centerX, y, { align: 'center' });
    y += 3.5;
  }

  // Ligne de séparation
  doc.text('------------------------------------------', centerX, y, { align: 'center' });
  y += 4.5;

  // Informations Commande
  doc.setFontSize(7.5);
  doc.text(`DATE:     ${data.date}`, leftX, y);
  y += 3.5;
  doc.text(`CMD:      #${data.orderId}`, leftX, y);
  y += 3.5;
  doc.text(`TYPE:     ${data.orderType === 'PICKUP' ? 'CLICK & COLLECT' : 'EN MAGASIN'}`, leftX, y);
  y += 3.5;
  doc.text(`PAIEMENT: ${data.paymentMethod}`, leftX, y);
  y += 3.5;
  if (data.customerName) {
    doc.text(`CLIENT:   ${data.customerName}`, leftX, y);
    y += 3.5;
  }

  // Ligne de séparation
  doc.text('------------------------------------------', centerX, y, { align: 'center' });
  y += 4.5;

  // En-tête du tableau articles
  doc.setFont('courier', 'bold');
  doc.text('ARTICLE', leftX, y);
  doc.text('QTE', centerX + 4, y, { align: 'center' });
  doc.text('TOTAL', rightX, y, { align: 'right' });
  y += 4;
  doc.setFont('courier', 'normal');

  // Liste des articles
  data.items.forEach((item) => {
    const maxLen = 18;
    const name = item.name.length > maxLen ? item.name.substring(0, maxLen) + '..' : item.name;
    doc.text(name, leftX, y);
    doc.text(`x${item.quantity}`, centerX + 4, y, { align: 'center' });
    doc.text(formatCurrency(item.total), rightX, y, { align: 'right' });
    y += 4.5;
  });

  // Ligne de séparation
  doc.text('------------------------------------------', centerX, y, { align: 'center' });
  y += 4.5;

  // Totaux
  doc.setFontSize(7.5);
  doc.text('SOUS-TOTAL:', leftX, y);
  doc.text(formatCurrency(data.subtotal), rightX, y, { align: 'right' });
  y += 3.5;

  if (data.discount) {
    doc.text(`REMISE (${data.discount.code}):`, leftX, y);
    doc.text(`-${formatCurrency(data.discount.amount)}`, rightX, y, { align: 'right' });
    y += 3.5;
  }

  y += 1.5;
  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.text('TOTAL:', leftX, y);
  doc.text(formatCurrency(data.total), rightX, y, { align: 'right' });
  y += 7;

  // Footer
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.text('MERCI DE VOTRE VISITE !', centerX, y, { align: 'center' });

  doc.save(`Recu-${data.orderId}.pdf`);
}
