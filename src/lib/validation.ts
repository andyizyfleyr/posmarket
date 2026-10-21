import { NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';

/**
 * Validation des entrées de l'API — source unique, basée sur Zod.
 *
 * Toutes les routes qui reçoivent une requête (JSON ou query string)
 * passent par ces helpers : un schéma invalide produit une réponse 400
 * explicite au lieu d'une erreur serveur ou d'un `undefined` glissé en base.
 */

/** Détails d'une erreur de validation, prêts pour le client. */
export function formatIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/** Réponse 400 normalisée. */
export function invalidRequest(error: z.ZodError) {
  return NextResponse.json(
    { error: 'Données invalides.', details: formatIssues(error) },
    { status: 400 },
  );
}

export type ParseResult<T extends ZodType> =
  | { ok: true; data: z.infer<T> }
  | { ok: false; response: NextResponse };

/** Valide le corps JSON d'une requête. */
export async function parseBody<T extends ZodType>(
  request: Request,
  schema: T,
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Corps de requête JSON invalide.' },
        { status: 400 },
      ),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: invalidRequest(parsed.error) };
  return { ok: true, data: parsed.data };
}

/** Valide les paramètres de requête d'une URL. */
export function parseQuery<T extends ZodType>(
  url: URL,
  schema: T,
): ParseResult<T> {
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: invalidRequest(parsed.error) };
  return { ok: true, data: parsed.data };
}

/** Valide les paramètres d'un segment dynamique (`/route/[id]`). */
export function parseParams<T extends ZodType>(
  params: Record<string, string | string[] | undefined>,
  schema: T,
): ParseResult<T> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) raw[key] = value[0];
    else raw[key] = value;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: invalidRequest(parsed.error) };
  return { ok: true, data: parsed.data };
}

/* ── Primitives réutilisables ─────────────────────────────────────────── */

export const uuidSchema = z.uuid('Identifiant invalide.');
export const idSchema = z.string().trim().min(1, 'Identifiant requis.').max(64);
export const emailSchema = z.email('Adresse e-mail invalide.');
export const shortText = (max = 120) =>
  z.string().trim().min(1, 'Valeur requise.').max(max);
export const optionalText = (max = 500) =>
  z.string().trim().max(max).nullish().transform((v) => (v ? v : null));
export const pageSchema = z.coerce
  .number()
  .int('Page invalide.')
  .min(1)
  .max(10_000)
  .catch(1);
export const limitSchema = z.coerce
  .number()
  .int('Limite invalide.')
  .min(1)
  .max(500)
  .catch(50);

/** Corps JSON facultatif : renvoie `{}` si le corps est vide. */
export async function readOptionalJson(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const raw = await request.json();
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Validation côté server action : renvoie le résultat typé ou `null`.
 * L'action transforme alors `null` en réponse d'erreur métier, comme avant.
 */
export function validate<T extends ZodType>(
  schema: T,
  value: unknown,
): z.infer<T> | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
