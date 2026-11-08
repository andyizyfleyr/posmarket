/**
 * Motif d'échec / d'annulation d'un guichet de paiement (Kkiapay, FedaPay,
 * FeexPay), affichable tel quel à l'acheteur. Les hooks appellent
 * `onFailed(err)` soit avec une `Error`, soit avec un objet
 * `{ reason?: string; message?: string }` (annulation ou réponse fournisseur).
 */
export function widgetErrorReason(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  const obj = err as { reason?: unknown; message?: unknown } | null | undefined;
  if (obj && obj.reason === 'dismissed') {
    return 'Paiement annulé — aucune commande n’a été créée.';
  }
  const message = obj?.message;
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}
