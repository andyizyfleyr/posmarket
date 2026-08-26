-- fix-orphan-stores.sql
-- Crée des profils pour chaque user_id orphelin dans stores
-- qui n'a pas de correspondance dans profiles.
-- Les emails fictifs seront à mettre à jour manuellement après coup.

-- 1. Voir les user_id orphelins
SELECT s.user_id, COUNT(*) AS store_count
FROM stores s
LEFT JOIN profiles p ON p.id = s.user_id
WHERE p.id IS NULL
GROUP BY s.user_id;

-- 2. Créer les profils manquants
INSERT INTO profiles (id, email, full_name, subscription_tier, subscription_status)
SELECT DISTINCT
  s.user_id,
  'user-' || SUBSTRING(s.user_id::text, 1, 8) || '@a-renseigner.local' AS email,
  'Utilisateur à configurer' AS full_name,
  'PRO' AS subscription_tier,
  'ACTIVE' AS subscription_status
FROM stores s
LEFT JOIN profiles p ON p.id = s.user_id
WHERE p.id IS NULL
ON CONFLICT (email) DO NOTHING;

-- 3. Vérification : plus d'orphelins
SELECT s.user_id, p.email, p.full_name
FROM stores s
LEFT JOIN profiles p ON p.id = s.user_id
WHERE p.id IS NULL;
