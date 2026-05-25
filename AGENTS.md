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
