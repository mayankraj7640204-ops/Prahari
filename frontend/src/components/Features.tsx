import { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion';
import { BrainCircuit, MapPin, Fingerprint, ShieldAlert } from 'lucide-react';

const features = [
  {
    title: "AI-Powered Monitoring",
    description: "Real-time analysis of tourist density and crowd behaviors to predict and prevent potential safety issues.",
    icon: BrainCircuit,
    color: "from-blue-500 to-indigo-500",
  },
  {
    title: "Dynamic Geo-Fencing",
    description: "Virtual safe zones with instant alerts when tourists wander into restricted or potentially dangerous areas.",
    icon: MapPin,
    color: "from-emerald-400 to-teal-500",
  },
  {
    title: "Blockchain Digital ID",
    description: "Decentralized and tamper-proof identification for tourists, ensuring maximum privacy and instant verification.",
    icon: Fingerprint,
    color: "from-purple-500 to-pink-500",
  },
  {
    title: "Rapid Incident Response",
    description: "Automated emergency dispatch system connecting tourists instantly with local authorities and medical teams.",
    icon: ShieldAlert,
    color: "from-orange-400 to-red-500",
  }
];

const ROTATION_RANGE = 32.5;
const HALF_ROTATION_RANGE = 32.5 / 2;

function FeatureCard({ feature, index }: { feature: typeof features[0], index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const xSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const ySpring = useSpring(y, { stiffness: 300, damping: 30 });

  const transform = useMotionTemplate`perspective(1000px) rotateX(${xSpring}deg) rotateY(${ySpring}deg)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseX = (e.clientX - rect.left) * ROTATION_RANGE;
    const mouseY = (e.clientY - rect.top) * ROTATION_RANGE;

    const rX = (mouseY / height - HALF_ROTATION_RANGE) * -1;
    const rY = mouseX / width - HALF_ROTATION_RANGE;

    x.set(rX);
    y.set(rY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: "easeOut" }}
      style={{
        transformStyle: "preserve-3d",
        transform,
      }}
      className="relative flex flex-col items-start p-8 w-full rounded-[44px] bg-white/[0.06] border-[3px] border-white shadow-[0_0_4px_0_rgba(0,0,0,0.15)] backdrop-blur-[20px] cursor-crosshair group overflow-hidden"
    >
      {/* Spotlight glow following the card slightly */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br ${feature.color} blur-3xl`} style={{ transform: "translateZ(-10px)" }} />
      
      <div 
        className={`flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} mb-6 shadow-lg`}
        style={{ transform: "translateZ(50px)" }}
      >
        <feature.icon className="w-7 h-7 text-white" />
      </div>

      <h3 
        className="font-display text-2xl font-bold text-wandor-text mb-4"
        style={{ transform: "translateZ(30px)" }}
      >
        {feature.title}
      </h3>

      <p 
        className="font-sans text-wandor-muted font-medium leading-relaxed"
        style={{ transform: "translateZ(20px)" }}
      >
        {feature.description}
      </p>

    </motion.div>
  );
}

export function Features() {
  return (
    <section className="relative w-full py-32 overflow-hidden bg-transparent">
      {/* Remove dark background gradients */}

      
      <div className="relative z-10 max-w-[1360px] mx-auto px-6 md:px-20">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center px-5 py-2 mb-6 rounded-full bg-white border border-white/40 shadow-sm backdrop-blur-md"
          >
            <span className="font-sans text-[15px] font-semibold text-[#292929] uppercase tracking-[0.04em]">Next-Gen Protection</span>
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-sans text-[clamp(36px,5vw,56px)] font-medium text-wandor-text leading-[1.05] tracking-[-0.04em] mb-6"
          >
            Smart Tourist Safety & Incident Response
          </motion.h2>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-sans text-xl font-medium text-wandor-muted leading-relaxed"
          >
            Empowering travelers with cutting-edge technology. Experience peace of mind through AI monitoring and decentralized security.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
