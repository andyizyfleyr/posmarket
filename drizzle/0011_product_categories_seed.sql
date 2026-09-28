-- Seed de la taxonomie produit : reprend les categories historiquement
-- codees en dur dans src/constants.ts (MAIN_CATEGORIES + CATEGORY_MAPPING).
-- products.main_category <- categorie parente, products.category <- sous-categorie.

INSERT INTO "product_categories" (name, slug, business_type, position) VALUES
  ('Cosmétique & Emballage', 'cosmetique-emballage', 'shopping', 0),
  ('Électronique & High-Tech', 'electronique-high-tech', 'shopping', 1),
  ('Mode & Accessoires', 'mode-accessoires', 'shopping', 2),
  ('Épicerie & Supermarché', 'epicerie-supermarche', 'shopping', 3),
  ('Restauration & Livraison Rapide', 'restauration-livraison-rapide', 'food', 4),
  ('Mobilier & Décoration', 'mobilier-decoration', 'shopping', 5),
  ('Beauté, Santé & Bien-être', 'beaute-sante-bien-etre', 'shopping', 6),
  ('Auto & Moto', 'auto-moto', 'shopping', 7),
  ('Sport & Loisirs', 'sport-loisirs', 'shopping', 8),
  ('Bricolage & Jardin', 'bricolage-jardin', 'shopping', 9),
  ('Livres & Papeterie', 'livres-papeterie', 'shopping', 10),
  ('Jouets & Enfants', 'jouets-enfants', 'shopping', 11),
  ('Divers', 'divers', 'shopping', 12)
ON CONFLICT (name) DO NOTHING;

-- Sous-categories rattachees a leur categorie parente.
INSERT INTO "product_categories" (name, slug, business_type, position, parent_id)
SELECT v.name, v.slug, p.business_type, v.position, p.id
FROM (VALUES
    ('Boîtes pour Crème de Visage', 'boites-pour-creme-de-visage', 'shopping', 0, 'Cosmétique & Emballage'),
    ('Boîtes pour Savon', 'boites-pour-savon', 'shopping', 1, 'Cosmétique & Emballage'),
    ('Boîtes pour Gel Douche', 'boites-pour-gel-douche', 'shopping', 2, 'Cosmétique & Emballage'),
    ('Boîtes pour Poudre', 'boites-pour-poudre', 'shopping', 3, 'Cosmétique & Emballage'),
    ('Boîtes pour Parfum', 'boites-pour-parfum', 'shopping', 4, 'Cosmétique & Emballage'),
    ('Boîtes pour Lotion', 'boites-pour-lotion', 'shopping', 5, 'Cosmétique & Emballage'),
    ('Boîtes pour Huile', 'boites-pour-huile', 'shopping', 6, 'Cosmétique & Emballage'),
    ('Boîtes pour Sérum', 'boites-pour-serum', 'shopping', 7, 'Cosmétique & Emballage'),
    ('Matière Première', 'matiere-premiere', 'shopping', 8, 'Cosmétique & Emballage'),
    ('Outils Professionnels', 'outils-professionnels', 'shopping', 9, 'Cosmétique & Emballage'),
    ('Électronique', 'electronique', 'shopping', 10, 'Électronique & High-Tech'),
    ('Téléphones & Tablettes', 'telephones-tablettes', 'shopping', 11, 'Électronique & High-Tech'),
    ('Audio', 'audio', 'shopping', 12, 'Électronique & High-Tech'),
    ('Gaming', 'gaming', 'shopping', 13, 'Électronique & High-Tech'),
    ('Télévision', 'television', 'shopping', 14, 'Électronique & High-Tech'),
    ('Beauté', 'beaute', 'shopping', 15, 'Beauté, Santé & Bien-être'),
    ('Maquillage & Soins', 'maquillage-soins', 'shopping', 16, 'Beauté, Santé & Bien-être'),
    ('Santé', 'sante', 'shopping', 17, 'Beauté, Santé & Bien-être'),
    ('Vêtements', 'vetements', 'shopping', 18, 'Mode & Accessoires'),
    ('Chaussures', 'chaussures', 'shopping', 19, 'Mode & Accessoires'),
    ('Montres', 'montres', 'shopping', 20, 'Mode & Accessoires'),
    ('Sacs & Bagages', 'sacs-bagages', 'shopping', 21, 'Mode & Accessoires'),
    ('Alimentation', 'alimentation', 'shopping', 22, 'Épicerie & Supermarché'),
    ('Boissons', 'boissons', 'shopping', 23, 'Épicerie & Supermarché'),
    ('Légumes & Fruits', 'legumes-fruits', 'shopping', 24, 'Épicerie & Supermarché'),
    ('Petit Déjeuner Resto', 'petit-dejeuner-resto', 'food', 25, 'Restauration & Livraison Rapide'),
    ('Déjeuner Resto', 'dejeuner-resto', 'food', 26, 'Restauration & Livraison Rapide'),
    ('Dîner Resto', 'diner-resto', 'food', 27, 'Restauration & Livraison Rapide'),
    ('Plats Cuisinés', 'plats-cuisines', 'food', 28, 'Restauration & Livraison Rapide'),
    ('Fast-Food & Snacks', 'fast-food-snacks', 'food', 29, 'Restauration & Livraison Rapide'),
    ('Desserts & Douceurs', 'desserts-douceurs', 'food', 30, 'Restauration & Livraison Rapide'),
    ('Boissons Resto', 'boissons-resto', 'food', 31, 'Restauration & Livraison Rapide'),
    ('Mobilier', 'mobilier', 'shopping', 32, 'Mobilier & Décoration'),
    ('Sport', 'sport', 'shopping', 33, 'Sport & Loisirs'),
    ('Loisirs', 'loisirs', 'shopping', 34, 'Sport & Loisirs'),
    ('Auto', 'auto', 'shopping', 35, 'Auto & Moto'),
    ('Moto', 'moto', 'shopping', 36, 'Auto & Moto'),
    ('Bricolage', 'bricolage', 'shopping', 37, 'Bricolage & Jardin'),
    ('Jardin', 'jardin', 'shopping', 38, 'Bricolage & Jardin'),
    ('Livres Physique', 'livres-physique', 'shopping', 39, 'Livres & Papeterie'),
    ('Papeterie', 'papeterie', 'shopping', 40, 'Livres & Papeterie'),
    ('Jouets', 'jouets', 'shopping', 41, 'Jouets & Enfants'),
    ('Bébés', 'bebes', 'shopping', 42, 'Jouets & Enfants'),
    ('Général', 'general', 'shopping', 43, 'Divers')
) AS v(name, slug, business_type, position, parent_name)
JOIN "product_categories" p ON p.name = v.parent_name AND p.parent_id IS NULL
ON CONFLICT (name) DO NOTHING;
