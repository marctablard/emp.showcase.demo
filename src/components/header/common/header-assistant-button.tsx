'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { useAssistantPanel } from '@/components/assistant/assistant-panel-context';
import { HeaderIconButton } from '@/components/header/common/header-icon-button';

export function HeaderAssistantButton({ className }: { className?: string }) {
  const t = useTranslations('layout.header');
  const { available, open, toggle } = useAssistantPanel();

  if (!available) return null;

  return (
    <HeaderIconButton
      className={className}
      icon={Sparkles}
      text={t('assistant')}
      ariaLabel={open ? t('closeAssistant') : t('openAssistant')}
      active={open}
      onClick={toggle}
      testId="header-assistantButton"
    />
  );
}
