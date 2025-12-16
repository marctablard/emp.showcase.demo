import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, FileText } from 'lucide-react';
import useAuthentication from '@/hooks/authentication/useAuthentication';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import QuoteRequestDialog from './quote-request-dialog';

export function CartRequest() {
  const t = useTranslations('cart');
  const { isAuthenticated } = useAuthentication();
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);

  return (
    <Card className="bg-surface-action-hover-2 p-6 border-none gap-4 shadow-sm text-text-heading">
      <Collapsible>
        <CollapsibleTrigger className="w-full group flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <FileText />
            <span className="flex items-center gap-2 font-headlines">{t('requestQuote')}</span>
          </div>
          <ChevronDown className="group-data-[state=open]:rotate-180 transition-transform" width={32} height={32} />
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn(
            'pt-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        >
          <span className="text-base mb-4">{t('requestQuoteTitle')}</span>
          <div className="flex flex-col gap-2 pt-4">
            <div className="flex gap-2">
              <p className={cn(!isAuthenticated && 'font-bold font-headlines')}>1.</p>
              {!isAuthenticated ? (
                <p className="font-bold font-headlines">{t('requestQuotestep1')}</p>
              ) : (
                <p>{t('requestQuotestep2')}</p>
              )}
            </div>
            <div className="flex gap-2">
              <p className={cn(!isAuthenticated && 'font-bold font-headlines')}>2.</p>
              {!isAuthenticated ? <p>{t('requestQuotestep2')}</p> : <p>{t('requestQuotestep3')}</p>}
            </div>
            {!isAuthenticated && (
              <div className="flex gap-2">
                <p className="font-bold font-headlines">3.</p>
                <p>{t('requestQuotestep3')}</p>
              </div>
            )}
          </div>
          <Button
            className="w-full mt-4"
            variant="secondary"
            disabled={!isAuthenticated}
            onClick={() => setIsQuoteOpen(true)}
          >
            {t('requestQuoteButton')}
          </Button>
          <QuoteRequestDialog open={isQuoteOpen} onOpenChange={setIsQuoteOpen} />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
