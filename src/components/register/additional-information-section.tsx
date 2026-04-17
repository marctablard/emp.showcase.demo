import type { Control } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { H2 } from '@/components/ui/h';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

interface AdditionalInformationSectionProps {
  control: Control<any>;
  number: number;
}

export default function AdditionalInformationSection({ control, number }: AdditionalInformationSectionProps) {
  const t = useTranslations('auth.register');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <H2 variant="h5">
          {number}. {t('additionalInformation')}
        </H2>
        <Separator />
      </div>
      <FormField
        control={control}
        name="additionalInformation"
        render={({ field }) => (
          <FormItem className="space-y-4">
            <FormLabel className="flex flex-nowrap">
              {t('additionalInformationDescription')}
              <span className="text-text-placeholders text-sm"> {t('optional')}</span>
            </FormLabel>
            <FormControl>
              <Textarea maxLength={500} className="min-h-[120px]" {...field} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
