<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# IMPORTANT: Business Types Cleanup

Le code a été nettoyé pour ne supporter que **`shopping`** et **`food`** comme business types.
Les types `stay` (Airbnb) et `digital` ont été supprimés du code.

- Ne jamais générer de code référençant `'stay'`, `'digital'`, `is_digital`, `digital_url`, `amenities`, `max_guests`, `bedrooms`, `location`, `check_in`, `check_out`, `guests` (au niveau order_item), `availability_slots`.
- La migration `20250525_cleanup_stay_digital.sql` supprime ces colonnes et tables en base.
- Les fichiers de migration historiques (20240409_airbnb_engine, etc.) sont conservés pour l'historique mais leur code n'est plus utilisé.

# Espace utilisateur (mon-compte)

L'espace acheteur (`/mon-compte`, rendu par `src/views/BuyerView.tsx` + `src/components/buyer/*`) repose sur des tables/colonnes ajoutées par la migration **`drizzle/0001_buyer_account.sql`** (à appliquer avec `npm run db:migrate`) :

- `profiles.phone` (téléphone du compte).
- `orders.buyer_user_id` / `orders.buyer_email` (lien commande → profil acheteur).
- `product_reviews.user_id` (lien avis → profil).
- table `buyer_addresses` (adresses de livraison de l'acheteur).

Contrats importants à respecter :
- Le cache client est stocké sous la clé `buyer_data_cache_v2` (ancienne clé `buyer_data_cache` ignorée).
- Les server actions acheteur (`fetchBuyerOrdersAction`, `fetchBuyerAddressesAction`, … de `src/app/actions/marketplace.ts`) renvoient `{ success: boolean, error?: string | undefined }` ; `error === 'Unauthorized'` doit déclencher le toast « Session expirée » côté UI.
- Le login/logout n'utilise **jamais** de `window.confirm` (les confirmations sont des modales React).
