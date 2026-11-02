-- Le « Débooster » doit rendre le quota 24 h : les logs de la boutique sont
-- marqués `voided` au lieu d'être supprimés (l'audit reste consultable dans le
-- journal, mais ils ne sont plus comptés dans `boostQuotaLeft`).
ALTER TABLE "boost_logs" ADD COLUMN IF NOT EXISTS "voided" boolean DEFAULT false NOT NULL;
