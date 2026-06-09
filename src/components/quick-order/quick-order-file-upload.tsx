'use client';

import { useCallback, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FileDown, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/ui/useToast';
import { fetchProductPrices } from '@/lib/client/prices';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Product } from '@/platform/services/model/product';
import { useSessionStore } from '@/providers/StoreProvider';
import { EmptyFileError, FileTooLargeError, UnsupportedFormatError, parseUploadedFile } from './utils/parse-file';
import { fetchAvailabilityBatch, resolveProductsBatch } from './utils/resolve-product';

interface QuickOrderFileUploadProps {
  onAddProducts: (entries: Array<{ product: Product; quantity: number }>) => void;
}

export function QuickOrderFileUpload({ onAddProducts }: QuickOrderFileUploadProps) {
  const t = useTranslations('quick-order');
  const locale = useLocale();
  const { toast } = useToast();
  const logger = getLogger();
  const sessionCurrency = useSessionStore().session?.currency;

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setIsProcessing(true);
      setSelectedFile(file);

      try {
        const entries = await parseUploadedFile(file);

        const { resolved, notFound } = await resolveProductsBatch(entries, locale, logger);
        const notFoundCodes = notFound.map((e) => e.code);

        // Check prices for resolved products
        const withPrice: Array<{ product: Product; quantity: number; code: string }> = [];
        const noPriceCodes: string[] = [];

        if (resolved.length > 0) {
          const ids = resolved.map((r) => r.product.id);
          try {
            const priceMap = await fetchProductPrices(ids, sessionCurrency);
            for (const r of resolved) {
              const price = priceMap[r.product.id];
              if (price) {
                withPrice.push({ product: { ...r.product, price }, quantity: r.quantity, code: r.code });
              } else {
                noPriceCodes.push(r.code);
              }
            }
          } catch {
            for (const r of resolved) {
              noPriceCodes.push(r.code);
            }
          }
        }

        // Check availability for products with prices
        const availableProducts: Array<{ product: Product; quantity: number }> = [];
        const insufficientStockEntries: Array<{ code: string; requestedQty: number; availableQty: number }> = [];

        if (withPrice.length > 0) {
          const availabilityResults = await fetchAvailabilityBatch(withPrice);

          for (const { entry, availability } of availabilityResults) {
            if (!availability || !availability.isAvailable || availability.availableQuantity <= 0) {
              insufficientStockEntries.push({ code: entry.code, requestedQty: entry.quantity, availableQty: 0 });
            } else if (availability.availableQuantity < entry.quantity) {
              availableProducts.push({ product: entry.product, quantity: availability.availableQuantity });
              insufficientStockEntries.push({
                code: entry.code,
                requestedQty: entry.quantity,
                availableQty: availability.availableQuantity,
              });
            } else {
              availableProducts.push({ product: entry.product, quantity: entry.quantity });
            }
          }
        }

        if (availableProducts.length > 0) {
          onAddProducts(availableProducts);
          toast({
            title: t('notifications.productsAdded', { count: availableProducts.length }),
            variant: 'success',
          });
        }

        const allFailedCodes = [...notFoundCodes, ...noPriceCodes];

        if (insufficientStockEntries.length > 0) {
          for (const stock of insufficientStockEntries) {
            toast({
              title: t('notifications.insufficientStock', {
                code: stock.code,
                requested: stock.requestedQty,
                available: stock.availableQty,
              }),
              variant: 'warning',
            });
          }
          // Zero-stock entries count as failed
          const zeroStockCodes = insufficientStockEntries.filter((s) => s.availableQty <= 0).map((s) => s.code);
          allFailedCodes.push(...zeroStockCodes);
        }

        if (allFailedCodes.length > 0) {
          toast({
            title: t('notifications.productsCouldNotBeAdded', { count: allFailedCodes.length }),
            description: allFailedCodes.join(', '),
            variant: 'destructive',
            persistent: true,
          });
        }
      } catch (err) {
        if (err instanceof FileTooLargeError) {
          toast({
            title: t('validation.fileTooLarge'),
            variant: 'destructive',
            persistent: true,
          });
        } else if (err instanceof EmptyFileError) {
          toast({
            title: t('validation.emptyFile'),
            variant: 'destructive',
            persistent: true,
          });
        } else if (err instanceof UnsupportedFormatError) {
          toast({
            title: t('validation.unsupportedFormat'),
            variant: 'destructive',
            persistent: true,
          });
        } else {
          logger.error({ err }, 'Failed to parse uploaded file');
          toast({
            title: t('notifications.uploadError'),
            variant: 'destructive',
            persistent: true,
          });
        }
        setSelectedFile(null);
      } finally {
        setIsProcessing(false);
        // Reset input so the same file can be re-selected
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [locale, onAddProducts, toast, t, logger, sessionCurrency],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="rounded-sm bg-surface-page shadow-sm p-6 flex flex-col gap-4" data-testid="quick-order-file-upload">
      <h5 className="text-xl font-bold leading-6 text-text-headings">{t('fileUpload.title')}</h5>

      <div className="flex flex-col gap-4">
        <p className="text-base leading-6 text-text-body">{t('fileUpload.description')}</p>

        <a
          href="/templates/quick-order-template.csv"
          download="quick-order-template.csv"
          className="inline-flex items-center gap-1 text-base font-bold leading-6 text-text-action underline hover:text-text-action-hover w-fit"
          data-testid="quick-order-download-template"
        >
          {t('fileUpload.downloadTemplate')}
          <FileDown className="size-6 shrink-0" />
        </a>

        <div className="flex items-center gap-6 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileChange}
            className="hidden"
            aria-label={t('fileUpload.selectFile')}
            data-testid="quick-order-file-input"
          />

          <Button
            onClick={handleUploadClick}
            disabled={isProcessing}
            className="w-full sm:w-auto sm:min-w-[144px] h-12"
            data-testid="quick-order-upload-button"
          >
            {isProcessing ? (
              <>
                <Spinner variant="sm" color="white" />
                <span className="ml-2">{t('fileUpload.uploadButton')}</span>
              </>
            ) : (
              <>
                {t('fileUpload.uploadButton')}
                <Upload className="size-6 shrink-0" />
              </>
            )}
          </Button>

          {selectedFile && !isProcessing && (
            <div
              className="inline-flex items-center gap-2 rounded-sm border border-border-primary bg-surface-page px-2 py-1 h-8"
              data-testid="quick-order-active-file"
            >
              <span className="text-sm leading-6 text-text-body truncate max-w-[120px]">{selectedFile.name}</span>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="shrink-0 text-text-body hover:text-text-headings cursor-pointer"
                aria-label={t('fileUpload.removeFile')}
                data-testid="quick-order-remove-file"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
