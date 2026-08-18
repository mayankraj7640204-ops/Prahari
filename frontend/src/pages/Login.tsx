import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Navigation, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Login() {
  const [activeTab, setActiveTab] = useState<'tourist' | 'admin'>('tourist');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (user && !loading && !isSubmitting) {
      const from = (location.state as any)?.from?.pathname || (isAdmin ? '/dashboard/admin' : '/dashboard/tourist');
      navigate(from, { replace: true });
    }
  }, [user, isAdmin, loading, navigate, location, isSubmitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isSignUp && activeTab === 'tourist') {
        // Sign Up Flow
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        // Automatically create the tourist profile row
        if (authData.user) {
          const { error: profileError } = await supabase.from('tourists').insert({
            user_id: authData.user.id,
            full_name: 'New Tourist',
            phone: 'Pending'
          });
          
          if (profileError) {
            console.error('Profile creation error:', profileError);
          }
        }

        // Force sign out so they have to login manually
        await supabase.auth.signOut();
        
        setSuccessMsg('Account created successfully! Please log in to continue.');
        setIsSignUp(false);
        setPassword('');
        setIsSubmitting(false);
        return;
      } else {
        // Sign In Flow
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Verify role to prevent crossover
        const { data: adminData } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', authData.user!.id)
          .single();
          
        const isUserAdmin = !!adminData;
        
        if (activeTab === 'admin' && !isUserAdmin) {
          await supabase.auth.signOut();
          throw new Error("Unauthorized. Please use the Tourist Portal.");
        }
        
        if (activeTab === 'tourist' && isUserAdmin) {
          await supabase.auth.signOut();
          throw new Error("Admin accounts must use the Command Portal.");
        }

        // Success, navigate manually
        const from = (location.state as any)?.from?.pathname || (isUserAdmin ? '/dashboard/admin' : '/dashboard/tourist');
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
      setIsSubmitting(false);
    }
  };

  if (loading || (user && !isSubmitting)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-[#d4af37] rounded-full animate-spin" />
      </div>
    );
  }

  const isDarkTheme = activeTab === 'admin';

  return (
    <div className={cn(
      "min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500",
      isDarkTheme ? "bg-[#050505]" : "bg-transparent"
    )}>
      {/* Return to Home Button */}
      <Link 
        to="/"
        className={cn(
          "absolute top-6 right-6 z-20 flex items-center justify-center w-10 h-10 rounded-full border backdrop-blur-md transition-all duration-300 hover:scale-105",
          isDarkTheme 
            ? "border-white/20 bg-white/5 text-white hover:bg-white/10" 
            : "border-black/20 bg-white/50 text-black hover:bg-white/80"
        )}
      >
        <X className="w-5 h-5" />
      </Link>

      {/* Video Background for Tourist */}
      {!isDarkTheme && (
        <video
          src="/background.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      )}

      {/* Background Grid for Admin */}
      {isDarkTheme && (
        <div className="absolute inset-0 bg-[size:40px_40px] pointer-events-none transition-opacity duration-500 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)]" />
      )}

      <div className={cn(
        "relative z-10 w-full max-w-[420px] backdrop-blur-xl p-8 rounded-none shadow-2xl transition-colors duration-500",
        isDarkTheme ? "bg-white/[0.02] border border-white/10" : "bg-white border border-black/10"
      )}>
        
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/logo.png" 
            alt="Prahari Logo" 
            className={cn(
              "w-12 h-14 object-contain mb-4 transition-all duration-500",
              isDarkTheme ? "invert brightness-0 opacity-90" : "opacity-90"
            )} 
          />
          <h1 className={cn(
            "font-display text-2xl tracking-widest uppercase transition-colors duration-500",
            isDarkTheme ? "text-white" : "text-black"
          )}>
            Prahari
          </h1>
        </div>

        {/* Tab Switcher */}
        <div className="flex w-full mb-8 border-b border-black/10">
          <button
            type="button"
            onClick={() => setActiveTab('tourist')}
            className={cn(
              "flex-1 pb-3 flex items-center justify-center gap-2 font-sans text-xs tracking-widest uppercase font-semibold transition-all duration-300 relative",
              activeTab === 'tourist' 
                ? (isDarkTheme ? "text-[#d4af37]" : "text-[#d4af37]") 
                : (isDarkTheme ? "text-white/40 hover:text-white/70" : "text-black/40 hover:text-black/70")
            )}
          >
            <Navigation className="w-4 h-4" />
            Tourist
            {activeTab === 'tourist' && (
              <div className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-[#d4af37]" />
            )}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setIsSignUp(false);
            }}
            className={cn(
              "flex-1 pb-3 flex items-center justify-center gap-2 font-sans text-xs tracking-widest uppercase font-semibold transition-all duration-300 relative",
              activeTab === 'admin' 
                ? "text-red-500" 
                : (isDarkTheme ? "text-white/40 hover:text-white/70" : "text-black/40 hover:text-black/70")
            )}
          >
            <Shield className="w-4 h-4" />
            Command
            {activeTab === 'admin' && (
              <div className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-red-500" />
            )}
          </button>
        </div>

        <div className={cn(
          "mb-6 font-sans text-xs tracking-wide text-center",
          isDarkTheme ? "text-white/60" : "text-black/60"
        )}>
          {activeTab === 'tourist' ? 'Access your digital tourist companion.' : 'Restricted authority access only.'}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="p-3 border border-red-500/30 bg-red-500/10 text-red-500 text-xs font-sans text-center">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 border border-green-500/30 bg-green-500/10 text-green-500 text-xs font-sans text-center">
              {successMsg}
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <label className={cn(
              "font-sans text-[10px] uppercase tracking-[0.1em]",
              isDarkTheme ? "text-white/50" : "text-black/50"
            )}>
              Email Identifier
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                "w-full border px-4 py-3 font-sans text-sm outline-none transition-colors duration-300",
                isDarkTheme 
                  ? "bg-black/50 border-white/20 text-white focus:border-red-500" 
                  : "bg-white border-black/20 text-black focus:border-[#d4af37]"
              )}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={cn(
              "font-sans text-[10px] uppercase tracking-[0.1em]",
              isDarkTheme ? "text-white/50" : "text-black/50"
            )}>
              Access Code
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                "w-full border px-4 py-3 font-sans text-sm outline-none transition-colors duration-300",
                isDarkTheme 
                  ? "bg-black/50 border-white/20 text-white focus:border-red-500" 
                  : "bg-white border-black/20 text-black focus:border-[#d4af37]"
              )}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "mt-4 w-full font-sans font-bold text-xs tracking-[0.1em] uppercase py-4 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
              isDarkTheme 
                ? "bg-red-600 hover:bg-red-500 text-white" 
                : "bg-black hover:bg-[#333] text-white"
            )}
          >
            {isSubmitting ? 'Authenticating...' : (isSignUp ? 'Create Tourist Account' : 'Initialize Session')}
          </button>

          {activeTab === 'tourist' && (
            <div className="text-center mt-2">
              <button 
                type="button" 
                onClick={() => setIsSignUp(!isSignUp)}
                className="font-sans text-[11px] uppercase tracking-widest text-black/60 hover:text-black transition-colors"
              >
                {isSignUp ? "Already have an account? Login" : "Don't have an account? Sign Up"}
              </button>
            </div>
          )}
        </form>

        <div className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-4 w-full">
            <div className="flex-1 h-px bg-black/10 dark:bg-white/10" />
            <span className="font-sans text-[10px] uppercase tracking-widest text-black/40 dark:text-white/40">Hackathon Demo</span>
            <div className="flex-1 h-px bg-black/10 dark:bg-white/10" />
          </div>
          <button
            type="button"
            onClick={() => alert('Demo login bypass requires mock state or disabled RLS. Please use actual Supabase credentials for now.')}
            className={cn(
              "w-full border py-3 font-sans font-bold text-[10px] tracking-widest uppercase transition-colors duration-300",
              isDarkTheme
                ? "border-white/20 text-white hover:bg-white/10"
                : "border-black/20 text-black hover:bg-black/5"
            )}
          >
            Demo Login as {activeTab === 'admin' ? 'Admin' : 'Tourist'}
          </button>
        </div>

      </div>
    </div>
  );
}
