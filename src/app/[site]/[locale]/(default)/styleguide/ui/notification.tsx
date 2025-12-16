'use client';

import { Button } from '@/components/ui/button';
import { H4, H5 } from '@/components/ui/h';
import { ToastType, notify, toast } from '@/components/ui/toast-notification';

export default function NotificationStyleguide() {
  const description =
    'Message - Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua.';
  const title = 'Title';
  const message = 'Message';

  return (
    <div className="py-12">
      <H4 className="mb-3">Notifications</H4>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col">
          <H5 className="mb-3">Toasts</H5>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="secondary"
              className="text-text-success border-border-success bg-surface-success border-width-notification rounded-notification"
              onClick={() =>
                toast({
                  title: title,
                  description: description,
                  button: { label: 'BUTTON', onClick: () => console.log('Button clicked') },
                  type: ToastType.Success,
                })
              }
            >
              Alert Success Toast
            </Button>
            <Button
              variant="secondary"
              className="text-text-warning border-border-warning bg-surface-warning border-width-notification rounded-notification"
              onClick={() =>
                toast({
                  title: title,
                  description: description,
                  button: { label: 'BUTTON', onClick: () => console.log('Button clicked') },
                  type: ToastType.Warning,
                })
              }
            >
              Alert Warning Toast
            </Button>
            <Button
              variant="secondary"
              className="text-text-error border-border-error bg-surface-error border-width-notification rounded-notification"
              onClick={() =>
                toast({
                  title: title,
                  description: description,
                  button: { label: 'BUTTON', onClick: () => console.log('Button clicked') },
                  type: ToastType.Error,
                })
              }
            >
              Alert Error Toast
            </Button>
            <Button
              variant="secondary"
              className="text-text-information border-border-information bg-surface-information border-width-notification rounded-notification"
              onClick={() =>
                toast({
                  title: title,
                  description: description,
                  button: { label: 'BUTTON', onClick: () => console.log('Button clicked') },
                  type: ToastType.Info,
                })
              }
            >
              Alert Info Toast
            </Button>
          </div>
        </div>
        <div className="flex flex-col">
          <H5 className="mb-3">Globals</H5>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="secondary"
              className="text-text-success border-border-success bg-surface-success border-width-notification rounded-notification"
              onClick={() =>
                notify({
                  title: message,
                  button: { label: 'Undo', onClick: () => console.log('Button clicked') },
                  type: ToastType.Success,
                })
              }
            >
              Alert Success Global
            </Button>
            <Button
              variant="secondary"
              className="text-text-warning border-border-warning bg-surface-warning border-width-notification rounded-notification"
              onClick={() =>
                notify({
                  title: message,
                  button: { label: 'Undo', onClick: () => console.log('Button clicked') },
                  type: ToastType.Warning,
                })
              }
            >
              Alert Warning Global
            </Button>
            <Button
              variant="secondary"
              className="text-text-error border-border-error bg-surface-error border-width-notification rounded-notification"
              onClick={() =>
                notify({
                  title: message,
                  button: { label: 'Undo', onClick: () => console.log('Button clicked') },
                  type: ToastType.Error,
                })
              }
            >
              Alert Error Global
            </Button>
            <Button
              variant="secondary"
              className="text-text-information border-border-information bg-surface-information border-width-notification rounded-notification"
              onClick={() =>
                notify({
                  title: message,
                  button: { label: 'Undo', onClick: () => console.log('Button clicked') },
                  type: ToastType.Info,
                })
              }
            >
              Alert Info Global
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
