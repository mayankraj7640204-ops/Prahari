import { useState, useEffect } from 'react';
import { Hero } from '@/components/Hero';
import { Loader } from '@/components/Loader';
import { Features } from '@/components/Features';
import { Footer } from '@/components/Footer';

export function Landing() {
  const [isLoaderVisible, setIsLoaderVisible] = useState(true);

  // Lock body scroll while loader is visible
  useEffect(() => {
    if (isLoaderVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isLoaderVisible]);

  return (
    <div className="relative min-h-screen">
      {/* Fixed Background Video */}
      <video
        src="/background.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-[-1]"
      />
      {isLoaderVisible && (
        <Loader onComplete={() => setIsLoaderVisible(false)} />
      )}
      <Hero isVisible={!isLoaderVisible} />
      {!isLoaderVisible && (
        <>
          <Features />
          <Footer />
        </>
      )}
    </div>
  )
}
