import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Code2,
  Bell,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';

export default function CodingNavbar() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (user && Object.keys(user).length > 0) {
      const socket = getSocket();
      socket.on('notification', (notif) => {
        setNotifications(prev => [notif, ...prev]);
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-[#0B0F1A] border border-white/10 shadow-2xl rounded-2xl pointer-events-auto flex p-4 ring-1 ring-black ring-opacity-5`}>
            <div className="flex-1 w-0">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
                    <Zap className="text-white" size={20} />
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-black text-white">{notif.title}</p>
                  <p className="mt-1 text-xs font-medium text-gray-500">{notif.message}</p>
                </div>
              </div>
            </div>
          </div>
        ));
      });
      return () => socket.off('notification');
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <nav className={`fixed top-0 right-0 left-0 md:left-64 h-20 transition-all duration-300 z-30 px-8 flex items-center justify-between ${isScrolled ? 'bg-[#020817]/80 backdrop-blur-xl border-b border-white/5' : 'bg-transparent'
      }`}>
      <div className="flex items-center gap-6">
        {(!user || Object.keys(user).length === 0) && (
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Code2 size={18} className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tighter text-white uppercase italic">Adaptive<span className="text-blue-500">Exam</span></span>
          </Link>
        )}

        {user && Object.keys(user).length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot" />
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Network Secure</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        {user && Object.keys(user).length > 0 ? (
          <>
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-all relative"
              >
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-600 border-2 border-[#020817] rounded-full" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-4 w-80 bg-[#0B0F1A] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden"
                  >
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                      <h4 className="text-sm font-black text-white uppercase tracking-widest">Alerts center</h4>
                      <span className="text-[10px] font-bold text-gray-500">{notifications.length} New</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto py-2 custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="py-12 text-center text-gray-600 text-xs font-medium">No active notifications</div>
                      ) : (
                        notifications.map((n, i) => (
                          <div key={i} className="px-6 py-4 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/[0.02] last:border-0">
                            <div className="text-xs font-bold text-white mb-1">{n.title}</div>
                            <div className="text-[11px] text-gray-500 font-medium leading-relaxed">{n.message}</div>
                            <div className="text-[9px] text-blue-500 font-black uppercase mt-2">Just now</div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-8 w-px bg-white/10" />

            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(user.role === 'admin' ? '/admin' : '/student')}>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-black text-white uppercase tracking-tight">{user.name}</div>
                <div className="text-[10px] font-bold text-blue-500/80 uppercase tracking-widest">{user.role} Dashboard</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-black text-sm border border-white/10 select-none">
                {user.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-black text-gray-400 hover:text-white transition-colors uppercase tracking-widest">Sign In</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
