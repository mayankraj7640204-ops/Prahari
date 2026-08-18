import { motion } from 'framer-motion';

export function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-white py-20 px-6 md:px-20 relative z-10 w-full overflow-hidden">
      <div className="max-w-[1360px] mx-auto">
        {/* Top Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-16 lg:gap-8 mb-24">
          <div className="max-w-[400px]">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="font-sans text-[32px] md:text-[40px] leading-[1.1] font-light tracking-tight text-white/90"
            >
              Empowering Secure Tourist Experiences
            </motion.h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12 lg:gap-24 font-sans text-[15px]">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="flex flex-col gap-4 font-medium"
            >
              <span className="text-white hover:text-white/70 transition-colors cursor-default">Platform</span>
              <span className="text-white hover:text-white/70 transition-colors cursor-default">Technology</span>
              <span className="text-white hover:text-white/70 transition-colors cursor-default">Blockchain ID</span>
              <span className="text-white hover:text-white/70 transition-colors cursor-default">Analytics</span>
              <span className="text-white hover:text-white/70 transition-colors cursor-default">Partners</span>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="flex flex-col gap-4 font-medium"
            >
              <span className="text-white hover:text-white/70 transition-colors cursor-default">About Us</span>
              <span className="text-white hover:text-white/70 transition-colors cursor-default">News</span>
              <span className="text-white hover:text-white/70 transition-colors cursor-default">Careers</span>
              <span className="text-white hover:text-white/70 transition-colors cursor-default">Contact Us</span>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-col gap-4 font-medium"
            >
              <a href="https://www.linkedin.com/in/mayank-raj-a59b73382" target="_blank" rel="noopener noreferrer" className="text-white hover:text-white/70 transition-colors">LinkedIn</a>
              <span className="text-white hover:text-white/70 transition-colors cursor-default">Follow Us on X</span>
            </motion.div>
          </div>
        </div>

        {/* Decorative Divider - replicating the dot pattern */}
        <div className="w-full pt-16 pb-12 mb-8 border-t border-white/[0.08] overflow-hidden">
           <div className="w-full flex flex-wrap gap-2 text-[10px] tracking-[1em] text-white/20 select-none whitespace-nowrap">
             {Array.from({ length: 15 }).map((_, i) => (
               <span key={i}>. . &nbsp;&nbsp;&nbsp; . . . &nbsp;&nbsp; . &nbsp;&nbsp;</span>
             ))}
           </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 font-sans">
          <div className="flex items-center gap-3">
            {/* Using invert filter if logo is black, to make it white for dark footer */}
            <img src="/logo.png" alt="Prahari Logo" className="w-10 h-12 object-contain" style={{ filter: "brightness(0) invert(1)" }} />
            <span className="font-display text-[32px] text-white leading-none mt-1 tracking-tight">
              Prahari
            </span>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12 text-[13px] text-white/60">
            <span>© 2026 Prahari. All rights reserved.</span>
            <div className="flex gap-6 font-medium">
              <span className="hover:text-white transition-colors cursor-default">Privacy Policy</span>
              <span className="hover:text-white transition-colors cursor-default">Terms of Use</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Designed for</span>
              <span className="text-white font-bold tracking-tight">SIH</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
