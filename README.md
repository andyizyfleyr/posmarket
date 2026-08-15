Phase 1 : Configuration de la Connexion Neon & Drizzle
1. Installation des dépendances :
- drizzle-orm et @neondatabase/serverless (pour des requêtes HTTP/WebSocket ultra-rapides sans bloquer les connexions TCP).
- drizzle-kit (pour la gestion des migrations).
2. Variables d'environnement (.env.local) :
- Remplacer l'URL Supabase par l'URL de connexion Neon (DATABASE_URL="postgresql://...").
3. Client Drizzle (src/db/index.ts) :
- Configurer le client Neon avec @neondatabase/serverless et l'instance Drizzle.
Phase 2 : Modélisation du Schéma (src/db/schema.ts)
Traduire toutes les tables actuelles de Supabase en schémas Drizzle typés en TypeScript :
- profiles (utilisateurs / propriétaires)
- stores (boutiques / restaurants - en respectant la règle des business types shopping et food)
- products (produits, prix, stock)
- categories (catégories de produits)
- customers (clients)
- orders & order_items (commandes et détails)
- invoices & invoice_items (factures)
- product_stats (statistiques)
Phase 3 : Gestion de l'Authentification
Puisque @clerk/nextjs est déjà présent dans le package.json (ou en optant pour un système de sessions JWT custom en base avec des cookies httpOnly) :
- Remplacer les appels supabase.auth par le nouveau système d'authentification pour identifier l'utilisateur et récupérer son user_id.
Phase 4 : Migration du Stockage (Storage)
- Remplacer supabase.storage pour l'upload d'images de produits/stores par Vercel Blob, Cloudinary ou un stockage S3-compatible.
Phase 5 : Réécriture des Server Actions & Hooks (src/app/actions/*)
Remplacer les appels supabase.from('table').select(...) par les requêtes Drizzle optimisées :
- Ex : db.select().from(products).where(eq(products.storeId, storeId))
- Remplacer les fonctions RPC complexes par des requêtes SQL natives Drizzle (sql template) ou des transactions SQL (db.transaction(...)).
Phase 6 : Optimisation de la Performance ("Ultra Rapide")
- Indexation SQL : Ajouter des index sur les clés étrangères (store_id, customer_id, etc.) dans Drizzle.
- Requêtes groupées & Joins : Remplacer les multiples requêtes imbriquées par des leftJoin / innerJoin propres en une seule requête SQL.
- Mise en cache : Tirer parti du cache de Next.js et de React Query (@tanstack/react-query déjà installé) pour des affichages instantanés.