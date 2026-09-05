import { jsPDF } from "jspdf";
import { formatCurrency } from "@/utils";

export interface ProformaItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ProformaData {
  reference: string;
  date: string;
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  buyerName?: string;
  buyerPhone?: string;
  buyerCompany?: string;
  buyerNinea?: string;
  items: ProformaItem[];
  subtotal: number;
  discount?: number;
  shipping?: number;
  total: number;
}

export function generateProformaPdf(data: ProformaData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header Banner / Logo Accent
  doc.setFillColor(245, 107, 42); // #f56b2a (PosMarket Orange)
  doc.rect(0, 0, pageWidth, 8, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  doc.text("DEVIS PROFORMA", 16, y);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Réf : ${data.reference}`, 16, y + 6);
  doc.text(`Date : ${data.date}`, 16, y + 11);
  doc.text("Validité de l'offre : 15 jours", 16, y + 16);

  // Store Information (Right aligned)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(data.storeName, pageWidth - 16, y, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  let storeY = y + 5;
  if (data.storePhone) {
    doc.text(`Tél : ${data.storePhone}`, pageWidth - 16, storeY, { align: "right" });
    storeY += 5;
  }
  if (data.storeAddress) {
    doc.text(data.storeAddress, pageWidth - 16, storeY, { align: "right" });
    storeY += 5;
  }
  doc.text("Plateforme : PosMarket", pageWidth - 16, storeY, { align: "right" });

  y += 30;

  // Buyer Information Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(16, y, pageWidth - 32, 26, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("DESTINATAIRE (CLIENT / GROSSISTE)", 22, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  let buyerLine = data.buyerName || "Client Professionnel";
  if (data.buyerCompany) buyerLine += ` — ${data.buyerCompany}`;
  doc.text(buyerLine, 22, y + 12);

  let buyerDetails = "";
  if (data.buyerPhone) buyerDetails += `Tél : ${data.buyerPhone}   `;
  if (data.buyerNinea) buyerDetails += `NINEA/RCCM : ${data.buyerNinea}`;
  if (buyerDetails) {
    doc.setTextColor(100, 116, 139);
    doc.text(buyerDetails, 22, y + 18);
  }

  y += 36;

  // Table Header
  const colX = {
    desc: 16,
    qty: 110,
    unitPrice: 140,
    total: pageWidth - 16,
  };

  doc.setFillColor(241, 245, 249);
  doc.rect(16, y, pageWidth - 32, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("DÉSIGNATION DU PRODUIT", colX.desc + 4, y + 5.5);
  doc.text("QTÉ", colX.qty, y + 5.5, { align: "center" });
  doc.text("P.U (CFA)", colX.unitPrice, y + 5.5, { align: "right" });
  doc.text("TOTAL (CFA)", colX.total - 4, y + 5.5, { align: "right" });

  y += 10;

  // Table Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  data.items.forEach((item, index) => {
    // Check if new page needed
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    // Row alternating background
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(16, y - 4, pageWidth - 32, 7, "F");
    }

    doc.setTextColor(30, 41, 59);
    const truncatedName = item.name.length > 50 ? item.name.substring(0, 47) + "..." : item.name;
    doc.text(truncatedName, colX.desc + 4, y + 1);
    doc.text(String(item.quantity), colX.qty, y + 1, { align: "center" });
    doc.text(formatCurrency(item.unitPrice), colX.unitPrice, y + 1, { align: "right" });
    doc.text(formatCurrency(item.total), colX.total - 4, y + 1, { align: "right" });

    y += 7;
  });

  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(16, y, pageWidth - 16, y);
  y += 6;

  // Totals Section (Right side)
  const totalLabelX = pageWidth - 70;
  const totalValX = pageWidth - 20;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Sous-total :", totalLabelX, y);
  doc.text(formatCurrency(data.subtotal), totalValX, y, { align: "right" });
  y += 6;

  if (data.discount && data.discount > 0) {
    doc.text("Remise commerciale :", totalLabelX, y);
    doc.text(`-${formatCurrency(data.discount)}`, totalValX, y, { align: "right" });
    y += 6;
  }

  if (data.shipping && data.shipping > 0) {
    doc.text("Frais de livraison :", totalLabelX, y);
    doc.text(formatCurrency(data.shipping), totalValX, y, { align: "right" });
    y += 6;
  }

  // Final Total Highlight
  doc.setFillColor(254, 242, 237); // Light orange
  doc.roundedRect(totalLabelX - 6, y - 4, 60, 10, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(217, 83, 24); // #d95318
  doc.text("NET À PAYER :", totalLabelX, y + 3);
  doc.text(formatCurrency(data.total), totalValX, y + 3, { align: "right" });

  // Footer notes
  const footerY = 280;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Ce devis proforma est généré électroniquement via PosMarket et ne constitue pas une facture définitive jusqu'au règlement complet.",
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  doc.save(`Devis-Proforma-${data.reference}.pdf`);
}
