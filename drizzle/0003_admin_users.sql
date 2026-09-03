-- ============================================================================
-- 0003_admin_users.sql
-- Espace admin dédié (/pam) : comptes d'administration indépendants des profils
-- vendeurs. Mot de passe haché (argon2id) ; tous les champs administrés via
-- l'espace PAM lui-même (aucun lien avec profiles / Supabase auth).
-- Idempotent : peut être ré-appliqué sans danger.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL UNIQUE,
	"email" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"display_name" text,
	"is_root" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_users_username_idx" ON "admin_users" ("username");
