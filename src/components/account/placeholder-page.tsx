import type { FC } from 'react';
import AccountPreviewPage from './previews/account-preview-page';

interface PlaceholderPageProps {
  /** Retained for backwards compatibility; the preview derives its own title. */
  title?: string;
}

/**
 * Backwards-compatible wrapper for routes not yet mapped to a dedicated preview
 * category. Renders the generic on-brand account preview.
 */
export const PlaceholderPage: FC<PlaceholderPageProps> = () => <AccountPreviewPage category="default" />;

export default PlaceholderPage;
