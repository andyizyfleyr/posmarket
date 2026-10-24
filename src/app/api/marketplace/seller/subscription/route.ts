import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, subscriptionPayments } from '@/db/schema';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { subscriptionActionSchema } from '@/lib/schemas';
import { loadPaymentConfig } from '@/lib/paymentConfig';
import {
  activateSubscription,
  isPayableTier,
  subscriptionAmount,
} from '@/lib/subscription';
import { kkiapayConfigured, verifyKkiapayTransaction } from '@/lib/kkiapay';
import { fedapayConfigured, verifyFedapayTransaction } from '@/lib/fedapay';
import {
  feexpayConfigured,
  verifyFeexpayTransaction,
  isFeexpayApprovedStatus,
} from '@/lib/feexpay';
import { notify, getProfileEmail, getProfilePhone } from '@/lib/notifications';
import { SUBSCRIPTION_PLANS } from '@/constants';
import { refreshTag } from '@/lib/revalidate';
import type { SubscriptionDuration, SubscriptionTier } from '@/types';

export const dynamic = 'force-dynamic';

function durationLabel(d: string): string {
  if (d === 'monthly') return 'mensuel';
  if (d === 'quarterly') return 'trimestriel';
  if (d === 'annual') return 'annuel';
  return d;
}

/**
 * GET /api/marketplace/seller/subscription
 *
 * État de l'abonnement + configuration publique du fournisseur de paiement
 * (clés publiques uniquement) — mêmes données que `page.tsx` du web, lues
 * côté mobile (voir `SubscriptionClientWrapper`).
 */
export async function GET() {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const config = await loadPaymentConfig();
    const [profile] = await db
      .select({
        email: profiles.email,
        fullName: profiles.fullName,
        phone: profiles.phone,
        subscriptionTier: profiles.subscriptionTier,
        subscriptionDuration: profiles.subscriptionDuration,
        subscriptionStatus: profiles.subscriptionStatus,
        subscriptionStartDate: profiles.subscriptionStartDate,
        subscriptionEndDate: profiles.subscriptionEndDate,
      })
      .from(profiles)
      .where(eq(profiles.id, guard.userId))
      .limit(1);

    const subscription = {
      tier: profile?.subscriptionTier || 'NONE',
      duration: profile?.subscriptionDuration || 'monthly',
      startDate:
        profile?.subscriptionStartDate?.toISOString() || new Date().toISOString(),
      endDate:
        profile?.subscriptionEndDate?.toISOString() || new Date().toISOString(),
      status: profile?.subscriptionStatus || 'NONE',
    };

    const email = profile?.email || (await getProfileEmail(guard.userId)) || '';

    return NextResponse.json({
      success: true,
      provider: config.provider,
      kkiapayPublicKey: config.kkiapayPublicKey || '',
      kkiapayEnv: config.kkiapayEnv || 'sandbox',
      fedapayPublicKey: config.fedapayPublicKey || '',
      fedapayEnv: config.fedapayEnv || 'sandbox',
      feexpayShopId: config.feexpayShopId || '',
      feexpayApiKey: config.feexpayApiKey || '',
      feexpayEnv: config.feexpayEnv || 'sandbox',
      userName: profile?.fullName || '',
      userEmail: email,
      userPhone: profile?.phone || '',
      subscription,
    });
  } catch (error) {
    console.error('[API] seller/subscription GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Chargement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/marketplace/seller/subscription
 *
 * `{ action: 'create', tier, duration }` : facture PENDING (comme
 * `createSubscriptionPaymentAction`).
 * `{ action: 'confirm', transactionId, reference }` : vérification et
 * activation (comme `confirmKkiapayPaymentAction` / FedaPay / FeexPay).
 * `{ action: 'update', tier, duration }` : activation directe.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, subscriptionActionSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const action = body.action;
    const config = await loadPaymentConfig();

    if (action === 'create') {
      const tier = body.tier as SubscriptionTier;
      const duration = (body.duration || 'monthly') as SubscriptionDuration;

      if (config.provider === 'fedapay') {
        if (!fedapayConfigured()) {
          return NextResponse.json({
            success: false,
            code: 'NOT_CONFIGURED',
            error: "Le paiement FedaPay n'est pas encore configuré.",
          });
        }
      } else if (config.provider === 'feexpay') {
        if (!feexpayConfigured()) {
          return NextResponse.json({
            success: false,
            code: 'NOT_CONFIGURED',
            error: "Le paiement FeexPay n'est pas encore configuré.",
          });
        }
      } else {
        if (!kkiapayConfigured()) {
          return NextResponse.json({
            success: false,
            code: 'NOT_CONFIGURED',
            error: "Le paiement en ligne n'est pas encore configuré.",
          });
        }
      }

      const plan = isPayableTier(tier) ? SUBSCRIPTION_PLANS[tier] : undefined;
      const amount = subscriptionAmount(tier, duration);
      if (!plan || !amount || amount <= 0) {
        return NextResponse.json({
          success: false,
          error: `Formule d'abonnement ${tier} invalide`,
        });
      }

      const transactionId = randomUUID();
      await db
        .insert(subscriptionPayments)
        .values({
          userId: guard.userId,
          tier,
          duration,
          amount,
          currency: 'XOF',
          transactionId,
          reference: '',
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing({ target: subscriptionPayments.transactionId });

      return NextResponse.json({ success: true, transactionId, amount });
    }

    if (action === 'update') {
      const tier = body.tier as SubscriptionTier;
      const duration = (body.duration || 'monthly') as SubscriptionDuration;
      if (!isPayableTier(tier)) {
        return NextResponse.json({
          success: false,
          error: `Formule d'abonnement ${tier} invalide`,
        });
      }
      await activateSubscription(guard.userId, tier, duration);
      await notify({
        userId: guard.userId,
        phone: await getProfilePhone(guard.userId),
        email: await getProfileEmail(guard.userId),
        eventType: 'ABONNEMENT_ACTIVE',
        title: 'Abonnement activé',
        body: `Votre abonnement ${tier} (${duration}) est actif. Bienvenue parmi les commerçants PosMarket !`,
        templateParams: [String(tier), durationLabel(duration)],
        emailData: { tier, duration: durationLabel(duration) },
      });
      refreshTag('marketplace');
      return NextResponse.json({ success: true });
    }

    if (action !== 'confirm') {
      return NextResponse.json({ success: false, error: 'Action inconnue.' });
    }

    const transactionId = String(body.transactionId || '').trim();
    const reference = String(body.reference || '').trim();
    if (!transactionId) {
      return NextResponse.json({
        success: false,
        error: 'Facture de paiement manquante.',
      });
    }

    const [payment] = await db
      .select()
      .from(subscriptionPayments)
      .where(
        and(
          eq(subscriptionPayments.transactionId, transactionId),
          eq(subscriptionPayments.userId, guard.userId),
        ),
      )
      .limit(1);

    if (!payment || payment.status !== 'PENDING') {
      return NextResponse.json({
        success: false,
        error: 'Facture introuvable ou déjà traitée.',
      });
    }

    const expectedAmount = Number(payment.amount);

    if (config.provider === 'fedapay') {
      if (!fedapayConfigured()) {
        return NextResponse.json({
          success: false,
          error: "Le paiement FedaPay n'est pas encore configuré.",
        });
      }
      if (!reference) {
        return NextResponse.json({
          success: false,
          error: 'Référence de transaction FedaPay manquante.',
        });
      }

      const tx = await verifyFedapayTransaction(reference);
      const status = String(tx.status || '').toLowerCase();
      const isApproved = ['approved', 'success', 'transferred', 'completed'].includes(status);
      if (!isApproved) {
        return NextResponse.json({
          success: false,
          error: `Le paiement n'a pas abouti (statut FedaPay : ${status || 'inconnu'}).`,
        });
      }

      const paidAmount = Number(tx.amount);
      if (paidAmount && expectedAmount && Math.abs(paidAmount - expectedAmount) > 1) {
        return NextResponse.json({
          success: false,
          error: `Le montant payé (${paidAmount}) ne correspond pas à la facture (${expectedAmount}).`,
        });
      }

      await db
        .update(subscriptionPayments)
        .set({ status: 'APPROVED', reference, updatedAt: new Date() })
        .where(
          and(
            eq(subscriptionPayments.transactionId, transactionId),
            eq(subscriptionPayments.status, 'PENDING'),
          ),
        );

      await activateSubscription(
        payment.userId,
        payment.tier as SubscriptionTier,
        payment.duration as SubscriptionDuration,
      );

      await notify({
        userId: guard.userId,
        phone: await getProfilePhone(guard.userId),
        email: await getProfileEmail(guard.userId),
        eventType: 'ABONNEMENT_ACTIVE',
        title: 'Abonnement activé',
        body: `Votre abonnement ${payment.tier} (${payment.duration}) a été validé avec succès via FedaPay.`,
        templateParams: [String(payment.tier), durationLabel(payment.duration)],
        emailData: {
          tier: payment.tier,
          duration: durationLabel(payment.duration),
        },
      });

      await notify({
        userId: guard.userId,
        phone: await getProfilePhone(guard.userId),
        email: await getProfileEmail(guard.userId),
        eventType: 'FACTURE_PAYEE',
        title: 'Facture payée',
        body: `Votre paiement de ${Number(payment.amount) || expectedAmount} FCFA a été confirmé.`,
        templateParams: [String(Number(payment.amount) || expectedAmount)],
        emailData: { amount: Number(payment.amount) || expectedAmount, tier: payment.tier },
      });

      refreshTag('marketplace');
      return NextResponse.json({
        success: true,
        message: 'Paiement FedaPay vérifié. Abonnement activé.',
      });
    }

    if (config.provider === 'feexpay') {
      if (!feexpayConfigured()) {
        return NextResponse.json({
          success: false,
          error: "Le paiement FeexPay n'est pas encore configuré.",
        });
      }
      if (!reference) {
        return NextResponse.json({
          success: false,
          error: 'Référence de transaction FeexPay manquante.',
        });
      }

      const tx = await verifyFeexpayTransaction(reference);
      if (!isFeexpayApprovedStatus(tx.status)) {
        return NextResponse.json({
          success: false,
          error: `Le paiement n'a pas abouti (statut FeexPay : ${tx.status || 'inconnu'}).`,
        });
      }

      const paidAmount = Number(tx.amount);
      if (paidAmount && expectedAmount && Math.abs(paidAmount - expectedAmount) > 1) {
        return NextResponse.json({
          success: false,
          error: `Le montant payé (${paidAmount}) ne correspond pas à la facture (${expectedAmount}).`,
        });
      }

      await db
        .update(subscriptionPayments)
        .set({ status: 'APPROVED', reference, updatedAt: new Date() })
        .where(
          and(
            eq(subscriptionPayments.transactionId, transactionId),
            eq(subscriptionPayments.status, 'PENDING'),
          ),
        );

      await activateSubscription(
        payment.userId,
        payment.tier as SubscriptionTier,
        payment.duration as SubscriptionDuration,
      );

      await notify({
        userId: guard.userId,
        phone: await getProfilePhone(guard.userId),
        email: await getProfileEmail(guard.userId),
        eventType: 'ABONNEMENT_ACTIVE',
        title: 'Abonnement activé',
        body: `Votre abonnement ${payment.tier} (${payment.duration}) a été validé avec succès via FeexPay.`,
        templateParams: [String(payment.tier), durationLabel(payment.duration)],
        emailData: {
          tier: payment.tier,
          duration: durationLabel(payment.duration),
        },
      });

      await notify({
        userId: guard.userId,
        phone: await getProfilePhone(guard.userId),
        email: await getProfileEmail(guard.userId),
        eventType: 'FACTURE_PAYEE',
        title: 'Facture payée',
        body: `Votre paiement de ${Number(payment.amount) || expectedAmount} FCFA a été confirmé.`,
        templateParams: [String(Number(payment.amount) || expectedAmount)],
        emailData: { amount: Number(payment.amount) || expectedAmount, tier: payment.tier },
      });

      refreshTag('marketplace');
      return NextResponse.json({
        success: true,
        message: 'Paiement FeexPay vérifié. Abonnement activé.',
      });
    }

    if (!kkiapayConfigured()) {
      return NextResponse.json({
        success: false,
        error: "Le paiement Kkiapay n'est pas encore configuré.",
      });
    }
    if (!reference) {
      return NextResponse.json({
        success: false,
        error: 'Référence de transaction Kkiapay manquante.',
      });
    }

    const tx = await verifyKkiapayTransaction(reference);
    if (tx.status !== 'SUCCESS') {
      const msg = tx.failureMessage || tx.reason || "Le paiement n'a pas abouti.";
      return NextResponse.json({ success: false, error: msg });
    }

    const paidAmount = Number(tx.amount);
    if (paidAmount !== expectedAmount) {
      return NextResponse.json({
        success: false,
        error: 'Le montant payé ne correspond pas à la facture.',
      });
    }

    await db
      .update(subscriptionPayments)
      .set({ status: 'APPROVED', reference, updatedAt: new Date() })
      .where(
        and(
          eq(subscriptionPayments.transactionId, transactionId),
          eq(subscriptionPayments.status, 'PENDING'),
        ),
      );

    await activateSubscription(
      payment.userId,
      payment.tier as SubscriptionTier,
      payment.duration as SubscriptionDuration,
    );

    await notify({
      userId: guard.userId,
      phone: await getProfilePhone(guard.userId),
      email: await getProfileEmail(guard.userId),
      eventType: 'ABONNEMENT_ACTIVE',
      title: 'Abonnement activé',
      body: `Votre abonnement ${payment.tier} (${payment.duration}) a été validé avec succès via Kkiapay.`,
      templateParams: [String(payment.tier), durationLabel(payment.duration)],
      emailData: { tier: payment.tier, duration: durationLabel(payment.duration) },
    });

    await notify({
      userId: guard.userId,
      phone: await getProfilePhone(guard.userId),
      email: await getProfileEmail(guard.userId),
      eventType: 'FACTURE_PAYEE',
      title: 'Facture payée',
      body: `Votre paiement de ${Number(payment.amount) || expectedAmount} FCFA a été confirmé.`,
      templateParams: [String(Number(payment.amount) || expectedAmount)],
      emailData: { amount: Number(payment.amount) || expectedAmount, tier: payment.tier },
    });

    refreshTag('marketplace');
    return NextResponse.json({
      success: true,
      message: 'Paiement vérifié. Abonnement activé.',
    });
  } catch (error) {
    console.error('[API] seller/subscription POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
