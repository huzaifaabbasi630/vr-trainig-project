import React from 'react';
import logoImg from '../assets/logo.jpg';

interface HeaderProps {
  currentView: 'landing' | 'map' | 'tour';
  onGoHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView: _currentView, onGoHome }) => {
  return (
    <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between gap-2 px-3 py-2 sm:px-8 sm:py-4 bg-zinc-950/40 backdrop-blur-xl border-b border-white/10 text-zinc-100 shadow-2xl">
      {/* Left side: Logo & Title */}
      <div className="flex min-w-0 items-center space-x-2.5 sm:space-x-3.5 cursor-pointer group" onClick={onGoHome}>
        <div className="w-10 h-10 overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center group-hover:border-emerald-500 transition-all shadow-inner">
          <img src={logoImg} alt="KBRC Logo" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <h1 className="whitespace-nowrap text-sm sm:text-base font-bold tracking-tight text-white drop-shadow-sm">KBRC Virtual Tour</h1>
          <p className="hidden sm:block text-[11px] text-zinc-300 font-mono tracking-wide">360° Interactive Experience</p>
        </div>
      </div>

      {/* Right side: Powered By with properly sized small logo */}
      <div className="flex shrink-0 items-center space-x-2.5 bg-white/5 backdrop-blur-md px-2.5 py-2 sm:px-4 rounded-xl border border-white/10 shadow-lg sm:mr-6">
        <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">Powered By</span>
        <div className="w-6 h-6 overflow-hidden rounded-md border border-emerald-500/30 flex items-center justify-center bg-zinc-900">
          <img src={logoImg} alt="KBRC Logo" className="w-full h-full object-cover" />
        </div>
      </div>
    </header>
  );
};