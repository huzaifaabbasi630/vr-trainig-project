import React from 'react';
import { Compass } from 'lucide-react';

interface HeaderProps {
  currentView: 'landing' | 'map' | 'tour';
  onGoHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onGoHome }) => {
  return (
    <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-8 py-4 bg-zinc-950/40 backdrop-blur-xl border-b border-white/10 text-zinc-100 shadow-2xl">
      {/* Left side: Navigation / Title */}
      <div className="flex items-center space-x-3.5 cursor-pointer group" onClick={onGoHome}>
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all shadow-inner">
          <Compass className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white drop-shadow-sm">KEC Virtual Tour</h1>
          <p className="text-[11px] text-zinc-300 font-mono tracking-wide">360° Interactive Experience</p>
        </div>
      </div>

      {/* Right side: KBRCGULF Logo */}
      <div className="flex items-center space-x-2.5 bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg">
        <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">Powered By</span>
        <span className="text-sm font-extrabold tracking-widest text-emerald-400 font-mono"></span>
      </div>
    </header>
  );
};