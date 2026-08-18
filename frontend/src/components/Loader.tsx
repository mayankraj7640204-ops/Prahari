import { motion } from 'framer-motion';

interface LoaderProps {
  onComplete: () => void;
}

export function Loader({ onComplete }: LoaderProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white"
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 0, y: '-100%' }}
      transition={{ 
        duration: 0.8, 
        delay: 2.5,
        ease: [0.76, 0, 0.24, 1] // sleek custom easing 
      }}
      onAnimationComplete={onComplete}
    >
      <motion.div 
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
      >
        <motion.img 
          src="/logo.png" 
          alt="Prahari Logo" 
          className="w-24 h-28 object-contain"
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
        <motion.span 
          className="font-display text-[56px] text-black leading-none select-none"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.6 }}
        >
          Prahari
        </motion.span>
      </motion.div>
    </motion.div>
  );
}
