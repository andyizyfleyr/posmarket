import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BULK_PRODUCTS,
  applyPriceOperation,
  applyStockOperation,
  sanitizeBulkPatch,
  validateBulkPatch,
} from '../../src/utils/bulk-product-edit.ts';

/**
 * Modification en masse - calculs et validation.
 *
 * La modale cliente et la server action partagent ces fonctions : une erreur
 * ici s'écrirait en base pour toute une sélection. Les cas limites (prix qui
 * tomberait à 0, stock négatif, patch vide) sont donc verrouillés.
 */

test('prix : un prix fixe remplace la valeur', () => {
  assert.equal(applyPriceOperation(2500, { mode: 'set', value: 1800 }), 1800);
});

test('prix : une variation en pourcentage est arrondie au centime', () => {
  assert.equal(applyPriceOperation(2500, { mode: 'percent', value: 10 }), 2750);
  assert.equal(applyPriceOperation(1999, { mode: 'percent', value: 7 }), 2138.93);
  assert.equal(applyPriceOperation(2500, { mode: 'percent', value: -20 }), 2000);
});

test('prix : une variation en montant reste positive', () => {
  assert.equal(applyPriceOperation(2500, { mode: 'amount', value: 500 }), 3000);
  assert.equal(applyPriceOperation(2500, { mode: 'amount', value: -1000 }), 1500);
  // -100 % ou un montant supérieur au prix ne doivent jamais écrire 0.
  assert.equal(applyPriceOperation(2500, { mode: 'percent', value: -100 }), 0.01);
  assert.equal(applyPriceOperation(100, { mode: 'amount', value: -500 }), 0.01);
});

test('prix : une valeur source invalide repart de zéro', () => {
  assert.equal(applyPriceOperation(Number.NaN, { mode: 'amount', value: 100 }), 100);
  assert.equal(applyPriceOperation(Number.NaN, { mode: 'set', value: 900 }), 900);
});

test('stock : définir, ajouter et retirer', () => {
  assert.equal(applyStockOperation(12, { mode: 'set', value: 50 }), 50);
  assert.equal(applyStockOperation(12, { mode: 'add', value: 8 }), 20);
  assert.equal(applyStockOperation(12, { mode: 'remove', value: 5 }), 7);
});

test('stock : le retrait est plafonné à zéro', () => {
  assert.equal(applyStockOperation(3, { mode: 'remove', value: 10 }), 0);
  assert.equal(applyStockOperation(0, { mode: 'remove', value: 1 }), 0);
});

test('patch vide : refusé', () => {
  assert.equal(validateBulkPatch({}), 'Cochez au moins un champ à modifier.');
  assert.equal(validateBulkPatch(null), 'Aucune modification demandée.');
});

test('patch prix : les valeurs invalides sont refusées', () => {
  assert.match(
    validateBulkPatch({ price: { mode: 'set', value: 0 } }) ?? '',
    /supérieur à 0/,
  );
  assert.match(
    validateBulkPatch({ price: { mode: 'percent', value: -100 } }) ?? '',
    /-100/,
  );
  assert.match(
    validateBulkPatch({ price: { mode: 'amount', value: 0 } }) ?? '',
    /différente de 0/,
  );
  assert.equal(validateBulkPatch({ price: { mode: 'percent', value: 15 } }), null);
});

test('patch stock : entier positif exigé', () => {
  assert.match(
    validateBulkPatch({ stock: { mode: 'set', value: -1 } }) ?? '',
    /négatif/,
  );
  assert.match(
    validateBulkPatch({ stock: { mode: 'set', value: 1.5 } }) ?? '',
    /entier/,
  );
  assert.match(
    validateBulkPatch({ stock: { mode: 'add', value: 0 } }) ?? '',
    /supérieure à 0/,
  );
  assert.equal(validateBulkPatch({ stock: { mode: 'add', value: 10 } }), null);
});

test('patch catégorie : au moins un niveau, longueur bornée', () => {
  assert.match(validateBulkPatch({ category: {} }) ?? '', /catégorie/);
  assert.match(
    validateBulkPatch({ category: { mainCategory: 'x'.repeat(121) } }) ?? '',
    /trop long/,
  );
  assert.equal(validateBulkPatch({ category: { mainCategory: 'Mode' } }), null);
  assert.equal(
    validateBulkPatch({ category: { mainCategory: 'Mode', category: 'Chaussures' } }),
    null,
  );
});

test('patch unité et canal', () => {
  assert.match(validateBulkPatch({ unit: '   ' }) ?? '', /ne peut pas être vide/);
  assert.match(validateBulkPatch({ unit: 'x'.repeat(31) }) ?? '', /trop longue/);
  assert.equal(validateBulkPatch({ unit: 'kg' }), null);
  assert.match(
    validateBulkPatch({ isOnline: 'oui' }) ?? '',
    /canal de vente est invalide/,
  );
  assert.equal(validateBulkPatch({ isOnline: false }), null);
});

test('sanitize : seules les clés connues traversent', () => {
  const patch = sanitizeBulkPatch({
    price: { mode: 'percent', value: '10', hacked: true },
    stock: null,
    unit: '  kg  ',
    isOnline: false,
    storeId: 'autre-boutique',
    __proto__: { polluted: true },
  });

  assert.deepEqual(patch, {
    price: { mode: 'percent', value: 10 },
    unit: 'kg',
    isOnline: false,
  });
});

test('sanitize : une catégorie vide ne crée pas de patch', () => {
  assert.deepEqual(sanitizeBulkPatch({ category: { mainCategory: '  ', category: '' } }), {});
});

test('plafond de sélection', () => {
  assert.equal(MAX_BULK_PRODUCTS, 500);
});
