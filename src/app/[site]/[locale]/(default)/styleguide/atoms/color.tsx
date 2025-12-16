import { Star } from 'lucide-react';
import { H4, H5 } from '@/components/ui/h';

export default function ColorStyleGuide() {
  return (
    <div className="py-12">
      <H4 className="mb-3">Colors</H4>

      <div className="flex flex-col gap-8">
        <section>
          <H5>Text colors</H5>
          <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-text-headings">
              <span>text-text-headings</span>
              <span>Aa</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-text-body">
              <span>text-text-body</span>
              <span>Aa</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-text-action">
              <span>text-text-action</span>
              <span>Aa</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-text-action-hover">
              <span>text-text-action-hover</span>
              <span>Aa</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-text-disabled">
              <span>text-text-disabled</span>
              <span>Aa</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-text-information">
              <span>text-text-information</span>
              <span>Aa</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-text-success">
              <span>text-text-success</span>
              <span>Aa</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-text-warning">
              <span>text-text-warning</span>
              <span>Aa</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-text-error">
              <span>text-text-error</span>
              <span>Aa</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-action px-4 text-text-on-action">
              <span>text-text-on-action</span>
              <span>Aa</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-disabled px-4 text-text-on-disabled">
              <span>text-text-on-disabled</span>
              <span>Aa</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-text-placeholders">
              <span>text-text-placeholders</span>
              <span>Aa</span>
            </div>
          </div>
        </section>

        <section>
          <H5>Surface colors</H5>
          <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-page px-4 text-text-body">
              <span>bg-surface-page</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-text-body">
              <span>bg-surface-primary</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-secondary px-4 text-text-body">
              <span>bg-surface-secondary</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-action px-4 text-text-on-action">
              <span>bg-surface-action</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-action-hover px-4 text-text-on-action">
              <span>bg-surface-action-hover</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-action-hover-2 px-4 text-text-body">
              <span>bg-surface-action-hover-2</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-error px-4 text-text-error">
              <span>bg-surface-error</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-warning px-4 text-text-warning">
              <span>bg-surface-warning</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-success px-4 text-text-success">
              <span>bg-surface-success</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-information px-4 text-text-information">
              <span>bg-surface-information</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-disabled px-4 text-text-body">
              <span>bg-surface-disabled</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-hover-grey px-4 text-text-body">
              <span>bg-surface-hover-grey</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-disabled-selected px-4 text-text-body">
              <span>bg-surface-disabled-selected</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-neutral px-4 text-text-on-action">
              <span>bg-surface-neutral</span>
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-image-background px-4 text-text-body">
              <span>bg-surface-image-background</span>
            </div>
          </div>
        </section>

        <section>
          <H5>Icon colors</H5>
          <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-icon-action">
              <span>text-icon-action</span>
              <Star width={24} height={24} aria-hidden="true" />
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-icon-primary-dark">
              <span>text-icon-primary-dark</span>
              <Star width={24} height={24} aria-hidden="true" />
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-icon-action-hover">
              <span>text-icon-action-hover</span>
              <Star width={24} height={24} aria-hidden="true" />
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-action px-4 text-icon-on-action">
              <span>text-icon-on-action</span>
              <Star width={24} height={24} aria-hidden="true" />
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-disabled px-4 text-icon-on-disabled">
              <span>text-icon-on-disabled</span>
              <Star width={24} height={24} aria-hidden="true" />
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-icon-neutral">
              <span>text-icon-neutral</span>
              <Star width={24} height={24} aria-hidden="true" />
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-primary px-4 text-icon-secondary">
              <span>text-icon-secondary</span>
              <Star width={24} height={24} aria-hidden="true" />
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-information px-4 text-icon-information">
              <span>text-icon-information</span>
              <Star width={24} height={24} aria-hidden="true" />
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-success px-4 text-icon-success">
              <span>text-icon-success</span>
              <Star width={24} height={24} aria-hidden="true" />
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-warning px-4 text-icon-warning">
              <span>text-icon-warning</span>
              <Star width={24} height={24} aria-hidden="true" />
            </div>
            <div className="flex h-20 items-center justify-between rounded-md border border-border-primary bg-surface-error px-4 text-icon-error">
              <span>text-icon-error</span>
              <Star width={24} height={24} aria-hidden="true" />
            </div>
          </div>
        </section>

        <section>
          <H5>Border colors</H5>
          <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex h-20 items-center justify-center rounded-md border-4 border-border-primary bg-surface-primary text-sm text-text-body">
              border-border-primary
            </div>
            <div className="flex h-20 items-center justify-center rounded-md border-4 border-border-secondary bg-surface-primary text-sm text-text-body">
              border-border-secondary
            </div>
            <div className="flex h-20 items-center justify-center rounded-md border-4 border-border-information bg-surface-primary text-sm text-text-body">
              border-border-information
            </div>
            <div className="flex h-20 items-center justify-center rounded-md border-4 border-border-success bg-surface-primary text-sm text-text-body">
              border-border-success
            </div>
            <div className="flex h-20 items-center justify-center rounded-md border-4 border-border-warning bg-surface-primary text-sm text-text-body">
              border-border-warning
            </div>
            <div className="flex h-20 items-center justify-center rounded-md border-4 border-border-error bg-surface-primary text-sm text-text-body">
              border-border-error
            </div>
            <div className="flex h-20 items-center justify-center rounded-md border-4 border-border-disabled bg-surface-primary text-sm text-text-body">
              border-border-disabled
            </div>
            <div className="flex h-20 items-center justify-center rounded-md border-4 border-border-action bg-surface-primary text-sm text-text-body">
              border-border-action
            </div>
            <div className="flex h-20 items-center justify-center rounded-md border-4 border-border-action-hover bg-surface-primary text-sm text-text-body">
              border-border-action-hover
            </div>
            <div className="flex h-20 items-center justify-center rounded-md border-4 border-border-focus bg-surface-primary text-sm text-text-body">
              border-border-focus
            </div>
            <div className="flex h-20 items-center justify-center rounded-md border-4 border-border-black bg-surface-primary text-sm text-text-body">
              border-border-black
            </div>
            <div className="flex h-20 items-center justify-center rounded-md border-4 border-border-white bg-surface-primary text-sm text-text-body">
              border-border-white
            </div>
          </div>
        </section>

        <section>
          <H5>Gradients</H5>
          <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex h-32 items-center justify-center rounded-md bg-gradient-to-t from-gradient-secondary-end to-gradient-secondary-start text-center text-sm text-text-on-action">
              gradient-secondary-end → gradient-secondary-start
            </div>
            <div className="flex h-32 items-center justify-center rounded-md bg-gradient-to-t from-gradient-primary-end to-gradient-primary-start text-center text-sm text-text-body">
              gradient-primary-end → gradient-primary-start
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
