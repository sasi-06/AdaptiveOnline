import { AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-react';
import { motion } from 'framer-motion';

const types = {
  danger: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  success: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' }
};

export default function AlertBanner({ type = 'info', message, onDismiss }) {
  const config = types[type] || types.info;
  const Icon = config.icon;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${config.bg} ${config.border} transition-all`}
    >
      <Icon size={16} className={`${config.color} shrink-0`} />
      <span className="text-xs font-black uppercase tracking-tight text-white flex-1">{message}</span>
      {onDismiss && (
        <button 
          onClick={onDismiss} 
          className="text-gray-500 hover:text-white transition-colors p-1"
        >
          <X size={14} />
        </button>
      )}
    </motion.div>
  );
}
