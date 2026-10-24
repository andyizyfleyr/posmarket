import { NextRequest, NextResponse } from 'next/server';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseQuery } from '@/lib/validation';
import { sellerImagesQuerySchema } from '@/lib/schemas';
import { rateLimit, rateLimitMessage } from '@/lib/rate-limit';
import {
  buildImageArchivePath,
  buildImagesArchiveName,
  buildImagesManifestCsv,
  buildImagesReadme,
  fetchProductImage,
  IMAGE_EXPORT_LIMITS,
  type ImagesManifestRow,
} from '@/lib/product-images';
import {
  iterateStoreProductImageFolders,
  resolveImagesTarget,
  storeHasProductImages,
  type ProductImageFolder,
} from '@/lib/product-images-server';
import { ZipWriter } from '@/lib/zip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Un catalogue fourni (plusieurs centaines d'images) peut dépasser la minute.
export const maxDuration = 300;

const encoder = new TextEncoder();

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

interface ImageTask {
  folder: ProductImageFolder;
  slotIndex: number;
}



/**
 * GET /api/marketplace/seller/inventory/images/export?storeId=…&ids=a,b
 *
 * Télécharge en une requête toutes les images produits de la boutique (ou de
 * la sélection) dans une archive ZIP, avec un manifeste CSV.
 *
 * La réponse est **streamée** : les images sont récupérées et envoyées au fur
 * et à mesure, ce qui évite de garder toute l'archive en mémoire et contourne
 * la limite de 4,5 Mo de réponse des fonctions serverless.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = parseQuery(new URL(req.url), sellerImagesQuerySchema);
    if (!parsed.ok) return parsed.response;

    const target = await resolveImagesTarget(guard.userId, parsed.data);
    if (!target.ok) return jsonError(target.error, target.status);

    // Plusieurs exports complets coup sur coup = beaucoup de bande passante.
    // Limite par boutique, assez large pour un vendeur qui réessaie.
    const quota = rateLimit(`images-export:${target.storeId}`, 10, 5 * 60_000);
    if (!quota.ok) {
      return NextResponse.json(
        { success: false, error: rateLimitMessage(quota.retryAfterSeconds) },
        {
          status: 429,
          headers: { 'Retry-After': String(quota.retryAfterSeconds) },
        },
      );
    }

    if (!(await storeHasProductImages(target.storeId, target.productIds))) {
      return jsonError(
        'Aucune image produit à télécharger. Ajoutez des photos à vos produits puis réessayez.',
        404,
      );
    }

    const archiveName = buildImagesArchiveName(target.storeName);
    const writer = new ZipWriter();
    const manifestRows: ImagesManifestRow[] = [];
    const exportedProductIds = new Set<string>();
    const abortController = new AbortController();
    const iterator = iterateStoreProductImageFolders(target.storeId, target.productIds);

    let currentFolder: ProductImageFolder | null = null;
    let currentSlotIndex = 0;
    let iteratorDone = false;
    let closed = false;
    let cancelled = false;
    let filesWritten = 0;
    let failures = 0;
    let limitReached = false;

    /** Tâche suivante, en aplatissant les images d'un même produit. */
    const nextTask = async (): Promise<ImageTask | null> => {
      for (;;) {
        if (currentFolder && currentSlotIndex < currentFolder.slots.length) {
          const task: ImageTask = { folder: currentFolder, slotIndex: currentSlotIndex };
          currentSlotIndex += 1;
          return task;
        }
        if (iteratorDone) return null;
        const next = await iterator.next();
        if (next.done) {
          iteratorDone = true;
          return null;
        }
        currentFolder = next.value;
        currentSlotIndex = 0;
      }
    };

    const stream = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          if (cancelled || closed) return;

          const enqueueAll = (chunks: Uint8Array[]) => {
            if (cancelled) return;
            for (const chunk of chunks) controller.enqueue(chunk);
          };

          const finalizeArchive = () => {
            if (closed || cancelled) return;
            const readme = buildImagesReadme(target.storeName, {
              products: exportedProductIds.size,
              files: filesWritten,
              failures,
            });
            enqueueAll(
              writer.addFile(`${archiveName}/LISEZ-MOI.txt`, encoder.encode(readme)),
            );
            if (limitReached) {
              enqueueAll(
                writer.addFile(
                  `${archiveName}/LIMITE-ATTEINTE.txt`,
                  encoder.encode(
                    [
                      `L'archive a été arrêtée après ${filesWritten} image(s).`,
                      `Une archive est limitée à ${IMAGE_EXPORT_LIMITS.maxImages} images`,
                      `et ${Math.round(IMAGE_EXPORT_LIMITS.maxArchiveBytes / (1024 * 1024))} Mo.`,
                      '',
                      'Relancez l’export sur une sélection de produits pour récupérer le reste.',
                    ].join('\r\n'),
                  ),
                ),
              );
            }
            enqueueAll(
              writer.addFile(
                `${archiveName}/manifeste-images.csv`,
                encoder.encode(buildImagesManifestCsv(manifestRows, target.storeName)),
              ),
            );
            enqueueAll(writer.finalize());
            closed = true;
            controller.close();
          };

          try {
            if (limitReached) {
              finalizeArchive();
              return;
            }

            const tasks: ImageTask[] = [];
            while (tasks.length < IMAGE_EXPORT_LIMITS.concurrency) {
              const task = await nextTask();
              if (!task) break;
              tasks.push(task);
            }

            if (tasks.length === 0) {
              finalizeArchive();
              return;
            }

            const results = await Promise.all(
              tasks.map(async (task) => {
                const slot = task.folder.slots[task.slotIndex];
                const asset = await fetchProductImage(slot.source, {
                  signal: abortController.signal,
                });
                return { task, slot, asset };
              }),
            );

            if (cancelled) return;

            for (const { task, slot, asset } of results) {
              if (!asset) {
                failures += 1;
                manifestRows.push({
                  productId: task.folder.productId,
                  productName: task.folder.productName,
                  role: slot.role,
                  variantName: slot.variantName,
                  file: '',
                  source: slot.source,
                  status: 'indisponible',
                });
                continue;
              }

              const exceedsCount = filesWritten >= IMAGE_EXPORT_LIMITS.maxImages;
              const exceedsSize =
                writer.size + asset.bytes.length > IMAGE_EXPORT_LIMITS.maxArchiveBytes;
              if (exceedsCount || exceedsSize) {
                limitReached = true;
                manifestRows.push({
                  productId: task.folder.productId,
                  productName: task.folder.productName,
                  role: slot.role,
                  variantName: slot.variantName,
                  file: '',
                  source: slot.source,
                  status: exceedsCount ? 'limite-atteinte' : 'taille-depassee',
                  bytes: asset.bytes.length,
                });
                continue;
              }

              const path = buildImageArchivePath(
                archiveName,
                {
                  productName: task.folder.productName,
                  productIndex: task.folder.productIndex,
                  productImageCount: task.folder.slots.length,
                },
                slot,
                task.slotIndex,
                asset.extension,
              );
              enqueueAll(writer.addFile(path, asset.bytes));
              filesWritten += 1;
              exportedProductIds.add(task.folder.productId);
              manifestRows.push({
                productId: task.folder.productId,
                productName: task.folder.productName,
                role: slot.role,
                variantName: slot.variantName,
                file: path,
                source: slot.source,
                status: 'ok',
                bytes: asset.bytes.length,
              });
            }
          } catch (error) {
            console.error('[API] images export stream error:', error);
            if (!closed) {
              closed = true;
              controller.error(error);
            }
          }
        },
        cancel() {
          cancelled = true;
          abortController.abort();
          void iterator.return(undefined).catch(() => undefined);
        },
      },
      {
        // Rétro-pression : au plus ~4 Mo en file avant de récupérer d'autres
        // images. Les consommateurs lents n'accumulent donc pas l'archive.
        highWaterMark: 4 * 1024 * 1024,
        size: (chunk: Uint8Array) => chunk.byteLength,
      },
    );

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${archiveName}.zip"; filename*=UTF-8''${encodeURIComponent(
          `${archiveName}.zip`,
        )}`,
        'Cache-Control': 'no-store, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[API] seller/inventory/images/export error:', error);
    return jsonError(
      'Préparation de l’archive impossible pour le moment. Réessayez.',
      500,
    );
  }
}
