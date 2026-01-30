import { cn } from '@/lib/utils';

export interface AlertProps {
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  message: string;
  onAction?: () => void;
  actionLabel?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function Alert({
  severity,
  title,
  message,
  onAction,
  actionLabel,
  dismissible = true,
  onDismiss,
}: AlertProps) {
  const severityStyles = {
    info: 'bg-blue-900/40 border-l-4 border-blue-600 text-blue-100',
    warning: 'bg-amber-900/40 border-l-4 border-amber-600 text-amber-100',
    critical: 'bg-red-900/40 border-l-4 border-red-600 text-red-100',
    success: 'bg-emerald-900/40 border-l-4 border-emerald-600 text-emerald-100',
  };

  const titleStyles = {
    info: 'text-blue-200 font-semibold',
    warning: 'text-amber-200 font-semibold',
    critical: 'text-red-200 font-semibold',
    success: 'text-emerald-200 font-semibold',
  };

  return (
    <div className={cn('p-4 rounded-lg mb-4', severityStyles[severity])}>
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <h3 className={titleStyles[severity]}>{title}</h3>
          <p className="text-sm mt-1 opacity-90">{message}</p>
          {onAction && actionLabel && (
            <button
              onClick={onAction}
              className="mt-3 text-sm font-medium underline hover:opacity-75 transition"
            >
              {actionLabel}
            </button>
          )}
        </div>
        {dismissible && (
          <button
            onClick={onDismiss}
            className="text-lg opacity-60 hover:opacity-100 transition flex-shrink-0"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
    </div>
  );
}
