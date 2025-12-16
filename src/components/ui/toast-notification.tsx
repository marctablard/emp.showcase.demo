'use client';

import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { cn } from '@/lib/utils';

export enum ToastType {
  Success = 'success',
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
}

export interface ToastProps {
  id: string | number;
  title: string;
  description: string;
  button: {
    label: string;
    onClick: () => void;
  };
  type: ToastType;
}

export interface NotificationProps {
  id: string | number;
  title: string;
  duration?: number;
  button?: {
    label: string;
    onClick: () => void;
  };
  type: ToastType;
}

function toast(toast: Omit<ToastProps, 'id'>) {
  return sonnerToast.custom(
    (id) => (
      <Toast
        id={id}
        title={toast.title}
        description={toast.description}
        button={{
          label: toast.button.label,
          onClick: toast.button.onClick,
        }}
        type={toast.type}
      />
    ),
    {
      duration: 4000,
      position: 'bottom-center',
      className: 'w-full pb-15 sm:pb-2 sm:px-4 sm:flex sm:justify-end sm:[&>div]:max-w-[300px]',
    },
  );
}

function notify(toast: Omit<NotificationProps, 'id'>) {
  return sonnerToast.custom(
    (id) => <Notification id={id} title={toast.title} duration={toast.duration || 5000} type={toast.type} />,
    {
      position: 'top-center',
      duration: toast.duration || 5000,
      className: 'w-full mt-17 sm:mt-30 md:mt-44 sm:[&>div]:mx-4 md:[&>div]:mx-9',
    },
  );
}

function Toast(props: ToastProps) {
  const { title, description, button, id, type } = props;

  const icon = {
    success: <CircleCheck />,
    info: <Info />,
    warning: <TriangleAlert />,
    error: <CircleX />,
  };

  const className = {
    success: 'success',
    info: 'information',
    warning: 'warning',
    error: 'error',
  };
  return (
    <div
      className={cn(
        'rounded border shadow-lg w-full items-center p-4',
        'top-right border-width-notification rounded-notification',
        'bg-surface-' + className[type] + ' border-border-' + className[type],
      )}
    >
      <div className="flex flex-col gap-2 w-full">
        <div className="flex justify-between items-center">
          <div className={cn('flex items-center gap-2', 'text-text-' + className[type])}>
            {icon[type]}
            <p className="text-base font-bold text-text-headings m-0">{title}</p>
          </div>
          <div
            onClick={() => {
              button.onClick();
              sonnerToast.dismiss(id);
            }}
          >
            <X className="h-6 w-6" />
          </div>
        </div>
        <div className="">
          <p className="text-base text-text-headings">{description}</p>
        </div>
        <div className="flex">
          <div
            className="rounded-sm border border-border-black bg-transparent px-2 py-1 text-text-headings font-bold"
            onClick={() => {
              button.onClick();
              sonnerToast.dismiss(id);
            }}
          >
            {button.label}
          </div>
        </div>
      </div>
    </div>
  );
}

function Notification(props: NotificationProps) {
  const { title, button, id, type } = props;

  const icon = {
    success: <CircleCheck />,
    info: <Info />,
    warning: <TriangleAlert />,
    error: <CircleX />,
  };

  const className = {
    success: 'success',
    info: 'information',
    warning: 'warning',
    error: 'error',
  };
  return (
    <div
      className={cn(
        'flex rounded border shadow-lg w-full items-center sm:p-3 p-1',
        'top-right border-width-notification rounded-notification',
        'bg-surface-' + className[type] + ' border-border-' + className[type],
      )}
    >
      <div className="flex gap-2 w-full">
        <div className="flex w-full justify-center items-center">
          <div className={cn('flex items-center gap-2', 'text-text-' + className[type])}>
            {icon[type]}
            <p className="text-base font-bold text-text-headings m-0">{title}</p>
          </div>
        </div>
        <div
          className="flex justify-end items-center"
          onClick={() => {
            button?.onClick();
            sonnerToast.dismiss(id);
          }}
        >
          <X className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

export { Toast, toast, Notification, notify };
