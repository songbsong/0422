/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, signInWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut } from 'lucide-react';
import DrawingCanvas from './components/DrawingCanvas';
import { cn } from './lib/utils';

type View = 'shared' | 'personal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>('shared');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] font-sans flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="border-b-4 border-black p-6 flex flex-col md:flex-row justify-between items-baseline bg-white sticky top-0 z-40">
        <div className="flex flex-col">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none uppercase tracking-[-0.05em]">Sketchbook</h1>
        </div>

        <nav className="flex gap-6 md:gap-8 text-xs font-black uppercase tracking-widest mt-4 md:mt-0">
          {[
            { id: 'shared', label: 'Global Mural' },
            { id: 'personal', label: 'My Studio' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as View)}
              className={cn(
                "transition-all decoration-4 underline-offset-8",
                view === item.id 
                  ? "underline decoration-[#FF3E11] text-[#1A1A1A]" 
                  : "text-gray-400 hover:text-[#1A1A1A]"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4 mt-4 md:mt-0">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-tighter">{user.displayName}</span>
                <span className="text-[8px] text-[#FF3E11] font-bold uppercase">Artist Active</span>
              </div>
              <img 
                src={user.photoURL || ''} 
                className="w-10 h-10 border-2 border-black"
                alt="Profile"
              />
              <button 
                onClick={logout}
                className="p-2 border-2 border-black hover:bg-black hover:text-white transition-colors"
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="bg-black text-white px-6 py-2 text-xs font-black uppercase tracking-widest brutalist-shadow hover:bg-[#FF3E11] transition-all"
            >
              Sign In to Paint
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        <AnimatePresence mode="wait">
          {(view === 'shared' || view === 'personal') && (
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col md:flex-row overflow-hidden"
            >
              <div className="flex-1 p-8 flex flex-col">
                <div className="flex-1 min-h-0 relative">
                  {!user && (
                    <div className="absolute top-4 left-4 z-10 bg-black text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest pointer-events-none">
                       Sign in to add strokes
                    </div>
                  )}
                  <DrawingCanvas 
                    canvasId={view === 'shared' ? 'shared' : (user?.uid || 'guest')} 
                    isOwner={user !== null && (view === 'shared' || view === 'personal')}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Rail */}
      <footer className="bg-black text-white px-6 py-2 flex justify-between items-center text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em]">
        <div>System: Active / v1.0.4</div>
        <div className="flex gap-4">
           <span>{view.toUpperCase()} SPACE</span>
           <span className="hidden sm:inline text-gray-500">Stability: Solid</span>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e5e5e5;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #d4d4d4;
        }
      `}</style>
    </div>
  );
}
