import { sql } from 'drizzle-orm';

/** Une seule instruction PostgreSQL : la facture gagnante active son profil. */
export function saspayApprovalQuery(values: {
  rowId: string;
  checkoutId: string;
  paymentId: string;
  charged: string | null;
  net: string | null;
  feeMode: string | null;
}) {
  return sql`
    WITH approved AS (
      UPDATE subscription_payments
      SET status = 'APPROVED', reference = ${values.paymentId}, saspay_payment_id = ${values.paymentId},
          saspay_charged_amount = ${values.charged}, saspay_net_amount = ${values.net},
          saspay_fee_charge_mode = ${values.feeMode}, updated_at = NOW()
      WHERE id = ${values.rowId} AND provider = 'saspay' AND status = 'PENDING'
        AND saspay_checkout_id = ${values.checkoutId}
        AND EXISTS (SELECT 1 FROM profiles AS owner WHERE owner.id = subscription_payments.user_id)
      RETURNING user_id, tier, duration
    )
    UPDATE profiles AS p
    SET subscription_tier = approved.tier,
        subscription_duration = approved.duration,
        subscription_status = 'ACTIVE',
        subscription_start_date = NOW(),
        subscription_end_date = CASE approved.duration
          WHEN 'monthly' THEN NOW() + INTERVAL '1 month'
          WHEN 'quarterly' THEN NOW() + INTERVAL '3 months'
          WHEN 'annual' THEN NOW() + INTERVAL '1 year'
        END
    FROM approved WHERE p.id = approved.user_id
    RETURNING p.id
  `;
}
