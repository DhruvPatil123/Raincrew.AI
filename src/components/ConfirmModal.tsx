import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Content container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="relative w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl z-10 space-y-4"
        >
          {/* Close button top right */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon and title header */}
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl shrink-0 ${isDanger ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1 pr-6">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                {title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          {/* Actions button group */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-lg transition-all cursor-pointer ${
                isDanger
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-205/30'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-205/30'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
