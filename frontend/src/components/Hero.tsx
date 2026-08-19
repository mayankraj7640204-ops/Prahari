import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

export function Hero({ isVisible = true }: { isVisible?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [itinerary, setItinerary] = useState("I'm planning a 7-day trip to Japan in October. I love food, hidden cafes, scenic hikes, and want to avoid crowds....");
  const navigate = useNavigate();

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handlePlanMyTrip = (e: React.MouseEvent) => {
    e.preventDefault();
    sessionStorage.setItem('pending_itinerary', itinerary);
    navigate('/login?redirect=/dashboard/tourist');
  };

  return (
    <section className="relative min-h-svh w-full overflow-hidden">
      {/* Top gradient overlay (z-1) */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: isVisible ? 1 : 0 }}
        transition={{ duration: 1.5, delay: 0.2 }}
        className="absolute inset-x-0 top-0 h-[687px] pointer-events-none z-[1]"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)' }}
      />

      {/* Content wrapper (z-2) */}
      <div className="relative z-[2] max-w-[1360px] mx-auto">
        
        {/* Navigation bar */}
        <motion.nav 
          initial={{ y: -50, opacity: 0 }}
          animate={isVisible ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
          className="flex items-center justify-between px-6 md:px-20 pt-5 md:pt-6 pb-4"
        >
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Prahari Logo" className="w-10 h-12 object-contain" />
            <span className="font-display text-[32px] md:text-[40px] text-black leading-none select-none mt-1">
              Prahari
            </span>
          </div>
          
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 gap-8">
            <button className="bg-transparent border-none cursor-pointer font-sans text-[15px] font-medium uppercase text-wandor-text tracking-[0.04em] transition-opacity hover:opacity-55">
              Discover
            </button>
            <button className="bg-transparent border-none cursor-pointer font-sans text-[15px] font-medium uppercase text-wandor-text tracking-[0.04em] transition-opacity hover:opacity-55">
              Pricing
            </button>
            <button className="bg-transparent border-none cursor-pointer font-sans text-[15px] font-medium uppercase text-wandor-text tracking-[0.04em] transition-opacity hover:opacity-55">
              FAQs
            </button>
          </div>
          
          <div className="flex items-center gap-8">
            <Link to="/login" className="hidden md:block bg-transparent border-none cursor-pointer font-sans text-[15px] font-semibold uppercase text-[#292929] tracking-[0.04em] transition-opacity hover:opacity-55 no-underline">
              Login
            </Link>
            <button className="bg-wandor-dark text-[#fafafa] border-none cursor-pointer font-sans text-[15px] font-medium uppercase tracking-[0.04em] px-5 py-3.5 rounded-full transition-all hover:bg-[#333] active:scale-95">
              Plan My Trip
            </button>
          </div>
        </motion.nav>

        {/* Hero body */}
        <div className="flex flex-col items-center px-6 pt-16 pb-24 text-center">
          <motion.h1 
            initial={{ y: 30, opacity: 0 }}
            animate={isVisible ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.6 }}
            className="font-sans text-[clamp(40px,6vw,68px)] font-medium text-wandor-text leading-[1.05] tracking-[-0.04em] max-w-[820px] mb-5"
          >
            Where will you go next?
          </motion.h1>
          <motion.p 
            initial={{ y: 30, opacity: 0 }}
            animate={isVisible ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.7 }}
            className="font-sans text-xl font-medium text-wandor-muted leading-relaxed max-w-[500px] mb-10"
          >
            Tell our AI where you're going and what you love. We'll create a personalized itinerary for you.
          </motion.p>

          {/* Liquid glass prompt card */}
          <motion.div 
            initial={{ y: 40, opacity: 0 }}
            animate={isVisible ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.8 }}
            className="relative w-full max-w-[calc(100vw-48px)] md:w-[701px] md:max-w-[701px] min-h-[208px] bg-white/[0.06] border-[3px] border-white rounded-[44px] shadow-[0_0_4px_0_rgba(0,0,0,0.15)] overflow-hidden backdrop-blur-[20px] mx-auto"
          >
            
            <textarea 
              value={itinerary}
              onChange={(e) => setItinerary(e.target.value)}
              className="absolute left-[29px] top-[57px] -translate-y-1/2 w-[calc(100%-58px)] md:w-[609px] text-left font-sans text-[17px] md:text-xl font-medium text-wandor-prompt leading-relaxed break-words bg-transparent border-none resize-none focus:outline-none focus:ring-0"
              rows={3}
            />

            <button 
              onClick={handlePlanMyTrip}
              className="absolute bottom-[21px] right-[21px] w-[156px] h-14 bg-black border-none rounded-[44px] shadow-[0_0_2px_0_rgba(0,0,0,0.05)] cursor-pointer flex items-center justify-center font-sans text-base font-medium text-[#fafafa] uppercase tracking-[0.02em] transition-all hover:bg-[#333] active:scale-95"
            >
              Plan My Trip
            </button>

            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*,.pdf" 
              className="hidden" 
            />
            
            <button 
              onClick={handleUploadClick}
              aria-label="Upload inspiration"
              className="absolute left-[21px] top-[137px] w-11 h-11 bg-transparent border border-white/70 rounded-full cursor-pointer flex items-center justify-center backdrop-blur-[14px] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              <Upload className="w-[18px] h-[18px] text-wandor-text flex-shrink-0" />
            </button>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
