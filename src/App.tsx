import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { TourView } from './components/TourView';
import { ArrowRight, Eye, MapPin, Layers } from 'lucide-react';
import topViewImg from './assets/1-TOP-VIEW.webp';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'map' | 'tour'>('landing');
  const [selectedStreet, setSelectedStreet] = useState<string | null>(null);

  return (
    <div className="relative min-h-screen bg-zinc-950 font-sans antialiased text-zinc-100 overflow-hidden selection:bg-emerald-500 selection:text-zinc-950">
      
      {/* Header */}
      <Header currentView={currentView} onGoHome={() => setCurrentView('landing')} />

      {/* Landing Background Image */}
      <motion.div 
        className="absolute inset-0 z-0 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${topViewImg})`, filter: 'blur(20px) brightness(0.6)' }}
        animate={{
          opacity: currentView === 'landing' ? 1 : 0
        }}
        transition={{ duration: 0.35 }}
      />

      {/* Landing Overlay Screen */}
      <AnimatePresence>
        {currentView === 'landing' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 min-h-screen flex flex-col justify-center items-center px-4 pt-20 text-center"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl"
            >
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono mb-8 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>REAL ESTATE PROTOTYPE</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 text-white leading-tight drop-shadow-lg">
                Explore KEC Development <br />
                <span className="text-emerald-400 font-serif italic">in Immersive 360° VR</span>
              </h1>
              
              <p className="text-zinc-300 text-base md:text-lg mb-10 max-w-2xl mx-auto leading-relaxed font-light drop-shadow">
                Navigate interactive aerial masterplans, inspect sector boundaries, and walkthrough high-definition interior spaces.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10 text-left">
                <div className="p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all">
                  <Layers className="w-5 h-5 text-emerald-400 mb-3" />
                  <h3 className="font-semibold text-sm text-zinc-100">Interactive Map</h3>
                  <p className="text-xs text-zinc-300 mt-1.5 leading-normal">Hover over green zones to inspect development sectors.</p>
                </div>

                <div className="p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all">
                  <MapPin className="w-5 h-5 text-emerald-400 mb-3" />
                  <h3 className="font-semibold text-sm text-zinc-100">Street Markers</h3>
                  <p className="text-xs text-zinc-300 mt-1.5 leading-normal">Jump directly into designated street panorama views.</p>
                </div>

                <div className="p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all">
                  <Eye className="w-5 h-5 text-emerald-400 mb-3" />
                  <h3 className="font-semibold text-sm text-zinc-100">360° Interiors</h3>
                  <p className="text-xs text-zinc-300 mt-1.5 leading-normal">Walkthrough Foyer, Living Room, Kitchen & Dining areas.</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentView('map')}
                className="inline-flex items-center space-x-3 px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-zinc-950 shadow-xl shadow-emerald-950/50 transition-all duration-200 cursor-pointer"
              >
                <span>Start Exploring Prototype</span>
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map View */}
      {currentView !== 'landing' && (
        <MapView 
          isActive={currentView === 'map'}
          onSelectStreet={(streetId) => {
            setSelectedStreet(streetId);
            setCurrentView('tour');
          }} 
        />
      )}

      {/* Tour View (Smooth Switch to 2-PERSPECTIVE Image) */}
      <AnimatePresence>
        {currentView === 'tour' && (
          <TourView 
            streetId={selectedStreet}
            onBackToMap={() => setCurrentView('map')}
          />
        )}
      </AnimatePresence>

    </div>
  );
}