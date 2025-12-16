import { useTranslations } from 'next-intl';
import { Binary, NotepadText } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';

export function CheckoutNotes() {
  const t = useTranslations('checkout');

  return (
    <Card className="p-0 border-none mb-6">
      <CardHeader className="p-0 mt-6 mx-6 border-b flex justify-between">
        <p className="col-start-1 font-bold text-lg">3. {t('step3')}</p>
        {/* <Button
          variant="link"
          size="default"
          className="normal-case text-base tracking-normal p-0 gap-1 underline"
          onClick={() => (isNotesEdit ? setIsNoteEdit(false) : setIsNoteEdit(true))}
        >
          {t('change')}
          <Pencil />
        </Button> */}
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {!false ? (
          <>
            <div className="pb-flex flex-col">
              <p className="font-bold mb-1">{t('personalOrderNumber')}</p>
              <div className="flex align-center">
                <div>
                  <Binary className="h-4 w-4 mt-1.5 mr-1.5" />
                </div>
                <div>
                  <p>-</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col">
                <p className="font-bold mb-1">{t('orderNotes')}</p>
                <div className="flex align-center">
                  <div>
                    <NotepadText className="h-4 w-4 mt-1.5 mr-1.5" />
                  </div>
                  <div>
                    <p>-</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="col-span-2 flex flex-col gap-4">folgt</div>
        )}
      </CardContent>
    </Card>
  );
}
