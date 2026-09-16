-- Migration pour ne plus créer d'abonnement par défaut à l'inscription.
-- Un nouveau compte n'a pas d'abonnement actif tant qu'il n'a pas choisi un plan.
ALTER TABLE "profiles" ALTER COLUMN "subscription_tier" DROP DEFAULT;
ALTER TABLE "profiles" ALTER COLUMN "subscription_duration" DROP DEFAULT;
ALTER TABLE "profiles" ALTER COLUMN "subscription_status" DROP DEFAULT;
ALTER TABLE "profiles" ALTER COLUMN "subscription_start_date" DROP DEFAULT;