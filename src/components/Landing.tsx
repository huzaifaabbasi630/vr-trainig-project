import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, MapPin, Layers } from 'lucide-react';

interface LandingProps {
  onStart: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onStart }) => {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center px-4 overflow-hidden pt-16">
      {/* Subtle Background Accent Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl text-center z-10"
      >
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>REAL ESTATE PROTOTYPE</span>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-zinc-100 leading-tight">
          Explore KEC Development <br />
          <span className="text-emerald-400 font-serif italic">in Immersive 360° VR</span>
        </h1>
        
        <p className="text-zinc-400 text-base md:text-lg mb-12 max-w-2xl mx-auto leading-relaxed">
          Navigate interactive aerial masterplans, inspect sector boundaries, and walkthrough high-definition interior spaces.
        </p>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12 text-left">
          <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
            <Layers className="w-5 h-5 text-emerald-400 mb-3" />
            <h3 className="font-semibold text-sm text-zinc-200">Interactive Map</h3>
            <p className="text-xs text-zinc-400 mt-1.5 leading-normal">Hover over green zones to inspect development sectors.</p>
          </div>

          <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
            <MapPin className="w-5 h-5 text-emerald-400 mb-3" />
            <h3 className="font-semibold text-sm text-zinc-200">Street Markers</h3>
            <p className="text-xs text-zinc-400 mt-1.5 leading-normal">Jump directly into designated street panorama views.</p>
          </div>

          <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
            <Eye className="w-5 h-5 text-emerald-400 mb-3" />
            <h3 className="font-semibold text-sm text-zinc-200">360° Interiors</h3>
            <p className="text-xs text-zinc-400 mt-1.5 leading-normal">Walkthrough Foyer, Living Room, Kitchen & Dining areas.</p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={onStart}
          className="inline-flex items-center space-x-3 px-8 py-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-zinc-950 transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-950"
        >
          <span>Start Exploring Prototype</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
};