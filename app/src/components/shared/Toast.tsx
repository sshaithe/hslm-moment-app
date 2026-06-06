import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import type { Toast as ToastType } from '@/hooks/useToast';

interface ToastProps {
  toasts: ToastType[];
  onRemove: (id: string) => void;
}

export default function ToastContainer({ toasts, onRemove }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-full shadow-elevated text-sm font-medium animate-slide-up ${
            toast.type === 'success'
              ? 'bg-charcoal text-ivory'
              : toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-ivory text-charcoal border border-accent-border'
          }`}
        >
          {toast.type === 'success' && <CheckCircle size={16} className="text-gold-light" />}
          {toast.type === 'error' && <AlertCircle size={16} />}
          {toast.type === 'info' && <Info size={16} className="text-gold" />}
          <span>{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
