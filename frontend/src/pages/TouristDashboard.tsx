import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  Shield, MapPin, Activity, AlertTriangle, FileText, Navigation, 
  CheckCircle, Wifi, QrCode, Power, CloudSun, Leaf, Bell, User, Map, BookOpen, Smartphone, Settings, Menu, X
} from 'lucide-react';
import QRCode from 'react-qr-code';
import SHA256 from 'crypto-js/sha256';
import { GoogleGenAI } from '@google/genai';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function TouristDashboard() {
  const { user } = useAuth();
  const [tourist, setTourist] = useState<any>(null);
  const [permits, setPermits] = useState<any[]>([]);
  const [isSosActive, setIsSosActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showTravelForm, setShowTravelForm] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [enlargedPermit, setEnlargedPermit] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    passport: '',
    departureDate: '',
    returnDate: '',
    hotel: ''
  });

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      try {
        const { data: touristData } = await supabase
          .from('tourists')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (touristData) {
          setTourist(touristData);
          
          const { data: permitsData } = await supabase
            .from('ilp_permits')
            .select('*, geo_zones(name)')
            .eq('tourist_id', touristData.id)
            .order('created_at', { ascending: false });
            
          setPermits(permitsData || []);
        }
      } catch (err) {
        console.error('Error fetching tourist data', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  useEffect(() => {
    async function checkPendingItinerary() {
      if (!user || !tourist) return;
      const pendingItinerary = sessionStorage.getItem('pending_itinerary');
      if (pendingItinerary) {
        setShowTravelForm(true);
      }
    }
    checkPendingItinerary();
  }, [user, tourist]);

  const handleTravelFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tourist) return;
    const pendingItinerary = sessionStorage.getItem('pending_itinerary');
    if (!pendingItinerary) return;

    setIsProcessingAI(true);
    setToastMessage("AI is analyzing your itinerary globally...");

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `System: Extract the primary destination city and country from this itinerary. Return ONLY a valid JSON object in this format: { "location": "City, Country" }. Itinerary: ${pendingItinerary}`,
      });
      
      const jsonStr = response.text?.replace(/```json/g, '').replace(/```/g, '').trim();
      let extractedLocation = "";
      try {
        const parsed = JSON.parse(jsonStr || "{}");
        extractedLocation = parsed.location;
      } catch (e) {
        throw new Error("Failed to parse AI location JSON.");
      }
      
      if (!extractedLocation) throw new Error("Could not extract location");

      let { data: zone } = await supabase
        .from('geo_zones')
        .select('id, name, is_restricted')
        .ilike('name', `%${extractedLocation}%`)
        .limit(1)
        .single();

      if (!zone) {
        setToastMessage(`New Global Location Detected: ${extractedLocation}. Securing Zone...`);
        const { data: newZone, error: insertError } = await supabase
          .from('geo_zones')
          .insert({
            name: extractedLocation,
            region_state: 'Global',
            description: 'AI Extracted Global Zone',
            threat_level: 'GREEN',
            is_restricted: true
          })
          .select('id, name, is_restricted')
          .single();
          
        if (insertError || !newZone) throw new Error("Failed to register global zone.");
        zone = newZone;
      }

      if (zone && zone.is_restricted) {
        // Update the tourist's name with the one provided in the form
        if (formData.name) {
          await supabase.from('tourists').update({ full_name: formData.name }).eq('id', tourist.id);
        }
        
        const blockchainHash = SHA256(user.id + zone.id + Date.now().toString()).toString();
        
        const validFrom = new Date(formData.departureDate).toISOString();
        const validUntil = new Date(formData.returnDate).toISOString();

        const { error } = await supabase
          .from('ilp_permits')
          .insert({
            tourist_id: tourist.id,
            zone_id: zone.id,
            valid_from: validFrom,
            valid_until: validUntil,
            status: 'pending',
            blockchain_hash: blockchainHash,
            notes: `Passport: ${formData.passport}, Hotel: ${formData.hotel}`
          });

        if (error) {
          setToastMessage("Failed to secure pass: " + error.message);
        } else {
          setToastMessage("Global Zone Authorized. Secure Blockchain Digital Pass drafted successfully.");
          const { data: newPermitsData } = await supabase
            .from('ilp_permits')
            .select('*, geo_zones(name)')
            .eq('tourist_id', tourist.id)
            .order('created_at', { ascending: false });
          if (newPermitsData) setPermits(newPermitsData);
        }
      }
      
      setShowTravelForm(false);
      sessionStorage.removeItem('pending_itinerary');
      setFormData({ name: '', passport: '', departureDate: '', returnDate: '', hotel: '' });
      
    } catch (err: any) {
      console.error("Error processing global itinerary:", err);
      setToastMessage("Pipeline Error: " + (err.message || String(err)));
    } finally {
      setIsProcessingAI(false);
    }
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleSOS = async () => {
    if (!tourist) return;
    if (isSosActive) return;

    try {
      setIsSosActive(true);
      const { error } = await supabase
        .from('sos_alerts')
        .insert({
          tourist_id: tourist.id,
          latitude: 25.5788,
          longitude: 91.8933,
          ai_severity_score: 98,
          status: 'active',
          incident_type: 'EMERGENCY_BEACON'
        });

      if (error) {
        console.error('Failed to trigger SOS', error);
        setIsSosActive(false);
      }
    } catch (err) {
      console.error(err);
      setIsSosActive(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0a0a0a]/20 border-t-[#0a0a0a] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-black font-sans flex overflow-hidden selection:bg-[#0a0a0a]/10 relative">
      


      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#0a0a0a] text-white px-6 py-3 rounded-full shadow-lg z-[200] text-sm font-medium border border-white/10 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Shield className="w-4 h-4 text-green-400" />
          {toastMessage}
        </div>
      )}

      {enlargedPermit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-200 border border-black/10 max-w-2xl w-full flex flex-col md:flex-row gap-8 items-center">
            <button 
              onClick={() => setEnlargedPermit(null)}
              className="absolute top-4 right-4 p-2 bg-[#0a0a0a]/5 hover:bg-[#0a0a0a]/10 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5 text-[#0a0a0a]" />
            </button>
            
            <div className="flex-shrink-0 flex flex-col items-center">
              <h3 className="font-serif text-xl text-center mb-4 text-[#0a0a0a] md:hidden">Blockchain Digital Pass</h3>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-black/5">
                <QRCode value={enlargedPermit.blockchain_hash} size={200} />
              </div>
              <p className="mt-4 text-center font-mono text-[10px] text-[#0a0a0a]/40 max-w-[200px] break-all uppercase tracking-widest">
                DID: {enlargedPermit.blockchain_hash}
              </p>
            </div>

            <div className="flex-1 w-full space-y-4">
              <h3 className="font-serif text-2xl text-[#0a0a0a] hidden md:block border-b border-black/10 pb-4">Digital Identity Record</h3>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="font-mono text-[9px] text-[#0a0a0a]/50 tracking-widest mb-1 uppercase">Tourist Name</div>
                  <div className="font-sans text-sm font-bold text-[#0a0a0a] uppercase">{tourist?.full_name || 'N/A'}</div>
                </div>
                <div>
                  <div className="font-mono text-[9px] text-[#0a0a0a]/50 tracking-widest mb-1 uppercase">Passport / ID</div>
                  <div className="font-sans text-sm font-bold text-[#0a0a0a] uppercase">{enlargedPermit.notes?.match(/Passport:\s*([^,]+)/)?.[1] || 'N/A'}</div>
                </div>
                <div className="col-span-2">
                  <div className="font-mono text-[9px] text-[#0a0a0a]/50 tracking-widest mb-1 uppercase">Authorized Zone</div>
                  <div className="font-sans text-sm font-bold text-[#0a0a0a] uppercase">{enlargedPermit.geo_zones?.name || 'N/A'}</div>
                </div>
                <div className="col-span-2">
                  <div className="font-mono text-[9px] text-[#0a0a0a]/50 tracking-widest mb-1 uppercase">Registered Hotel</div>
                  <div className="font-sans text-sm font-bold text-[#0a0a0a] uppercase">{enlargedPermit.notes?.match(/Hotel:\s*(.+)$/)?.[1] || 'N/A'}</div>
                </div>
                <div className="col-span-2">
                  <div className="font-mono text-[9px] text-[#0a0a0a]/50 tracking-widest mb-1 uppercase">Validity Period</div>
                  <div className="font-sans text-sm font-bold text-[#0a0a0a] uppercase">
                    {new Date(enlargedPermit.valid_from).toLocaleDateString()} - {new Date(enlargedPermit.valid_until).toLocaleDateString()}
                  </div>
                </div>
                <div className="col-span-2 mt-2 flex items-center justify-between">
                  <span className={cn(
                    "text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full inline-block",
                    enlargedPermit.status === 'approved' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  )}>
                    {enlargedPermit.status === 'pending' ? 'PENDING AUTHORITY APPROVAL' : enlargedPermit.status}
                  </span>
                </div>
                
                {permits.length > 1 && (
                  <div className="col-span-2 mt-4 flex items-center justify-between border-t border-black/10 pt-4">
                    <button 
                      disabled={permits.findIndex(p => p.id === enlargedPermit.id) <= 0}
                      onClick={() => setEnlargedPermit(permits[permits.findIndex(p => p.id === enlargedPermit.id) - 1])}
                      className="text-[10px] font-bold uppercase tracking-widest text-[#0a0a0a]/50 hover:text-[#0a0a0a] disabled:opacity-30 transition-colors"
                    >
                      ← Previous
                    </button>
                    <span className="text-[10px] font-mono text-[#0a0a0a]/30">
                      Record {permits.findIndex(p => p.id === enlargedPermit.id) + 1} of {permits.length}
                    </span>
                    <button 
                      disabled={permits.findIndex(p => p.id === enlargedPermit.id) >= permits.length - 1}
                      onClick={() => setEnlargedPermit(permits[permits.findIndex(p => p.id === enlargedPermit.id) + 1])}
                      className="text-[10px] font-bold uppercase tracking-widest text-[#0a0a0a]/50 hover:text-[#0a0a0a] disabled:opacity-30 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {showTravelForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden border border-white/20">
            <div className="px-8 py-6 bg-[#0a0a0a] text-white flex justify-between items-center">
              <div>
                <h3 className="font-serif text-2xl">Complete Your Travel Profile</h3>
                <p className="text-white/60 text-sm mt-1">Mandatory verification for Secure Digital Pass Generation</p>
              </div>
              <button onClick={() => { setShowTravelForm(false); sessionStorage.removeItem('pending_itinerary'); }} className="text-white/40 hover:text-white transition-colors">
                 <Power className="w-5 h-5 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleTravelFormSubmit} className="p-8">
              <div className="flex flex-col lg:flex-row items-center gap-4 bg-[#f5f5f5] p-3 rounded-2xl border border-black/5">
                
                <div className="flex-1 w-full relative">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 absolute top-3 left-4">Complete Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white border border-black/5 rounded-xl pt-8 pb-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10" placeholder="John Doe" />
                </div>

                <div className="flex-1 w-full relative">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 absolute top-3 left-4">Passport / ID</label>
                  <input required type="text" value={formData.passport} onChange={e => setFormData({...formData, passport: e.target.value})} className="w-full bg-white border border-black/5 rounded-xl pt-8 pb-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10" placeholder="A1234567" />
                </div>
                
                <div className="flex-[0.8] w-full relative">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 absolute top-3 left-4">Departure</label>
                  <input required type="date" value={formData.departureDate} onChange={e => setFormData({...formData, departureDate: e.target.value})} className="w-full bg-white border border-black/5 rounded-xl pt-8 pb-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10" />
                </div>

                <div className="flex-[0.8] w-full relative">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 absolute top-3 left-4">Return</label>
                  <input required type="date" value={formData.returnDate} onChange={e => setFormData({...formData, returnDate: e.target.value})} className="w-full bg-white border border-black/5 rounded-xl pt-8 pb-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10" />
                </div>

                <div className="flex-1 w-full relative">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 absolute top-3 left-4">Accommodation</label>
                  <input required type="text" value={formData.hotel} onChange={e => setFormData({...formData, hotel: e.target.value})} className="w-full bg-white border border-black/5 rounded-xl pt-8 pb-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10" placeholder="Grand Hotel" />
                </div>
                
                <button disabled={isProcessingAI} type="submit" className="h-[68px] px-8 bg-[#0a0a0a] text-white rounded-xl font-medium text-sm hover:bg-black/80 transition-colors whitespace-nowrap disabled:opacity-50">
                  {isProcessingAI ? 'Verifying...' : 'Verify & Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Background */}
      <video
        src="/background.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-[-1]"
      />
      
      {/* Optional Cream Overlay to ensure text readability while letting video show through slightly */}
      <div className="fixed inset-0 bg-[#FDFBF7]/70 z-[-1]" />

      {/* Sidebar - Deep Black */}
      <aside className={cn(
        "bg-[#0a0a0a] text-white flex flex-col justify-between shadow-2xl z-20 shrink-0 transition-all duration-300",
        isSidebarOpen ? "w-[260px]" : "w-[80px]"
      )}>
        <div className="overflow-hidden">
          <div className={cn("p-6 flex items-center", isSidebarOpen ? "justify-between" : "justify-center")}>
            {isSidebarOpen && (
              <div className="flex items-center gap-3 overflow-hidden">
                <Leaf className="w-6 h-6 text-[#f5f5f5] shrink-0" />
                <div className="flex flex-col">
                  <h1 className="font-serif text-xl tracking-wide text-[#f5f5f5] whitespace-nowrap">Prahari</h1>
                  <p className="text-[9px] tracking-widest text-white/40 uppercase whitespace-nowrap">Tourist Link</p>
                </div>
              </div>
            )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-white/50 hover:text-white shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          
          <div className="px-4 py-2">
            {isSidebarOpen && <h2 className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-4 px-4 whitespace-nowrap">Main Menu</h2>}
            <nav className="flex flex-col gap-1">
              <SidebarItem isSidebarOpen={isSidebarOpen} icon={<Activity className="w-4 h-4" />} label="Command Dashboard" active />
              <SidebarItem isSidebarOpen={isSidebarOpen} icon={<Map className="w-4 h-4" />} label="Live Geo-Fence Map" />
              <SidebarItem isSidebarOpen={isSidebarOpen} icon={<Shield className="w-4 h-4" />} label="AI Incident Sentinel" />
              <SidebarItem 
                isSidebarOpen={isSidebarOpen} 
                icon={<FileText className="w-4 h-4" />} 
                label="Blockchain Digital Pass" 
                onClick={() => {
                  if (permits && permits.length > 0) {
                    setEnlargedPermit(permits[0]);
                  } else {
                    document.getElementById('digital-passes')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }} 
              />
              <button 
                onClick={handleSOS}
                title={!isSidebarOpen ? "Emergency & SOS" : undefined}
                className={cn(
                  "flex items-center gap-3 py-3 rounded-lg mx-2 text-sm font-medium transition-colors text-white/70 hover:text-white hover:bg-white/5",
                  isSosActive && "bg-red-500/20 text-red-300 hover:text-red-300 pointer-events-none",
                  isSidebarOpen ? "px-4" : "justify-center px-0"
                )}
              >
                <div className="shrink-0"><AlertTriangle className={cn("w-4 h-4", isSosActive ? "animate-pulse text-red-400" : "")} /></div>
                {isSidebarOpen && <span className="whitespace-nowrap">{isSosActive ? "SOS Transmitting..." : "Emergency & SOS"}</span>}
              </button>
              <SidebarItem isSidebarOpen={isSidebarOpen} icon={<Navigation className="w-4 h-4" />} label="Safe Route Planner" />
              <SidebarItem isSidebarOpen={isSidebarOpen} icon={<Smartphone className="w-4 h-4" />} label="Offline Beacon" />
            </nav>
          </div>

          <div className="px-4 mt-8">
            {isSidebarOpen && <h2 className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-4 px-4 whitespace-nowrap">Account</h2>}
            <nav className="flex flex-col gap-1">
              <SidebarItem isSidebarOpen={isSidebarOpen} icon={<User className="w-4 h-4" />} label="Traveler Profile" />
              <SidebarItem isSidebarOpen={isSidebarOpen} icon={<Settings className="w-4 h-4" />} label="Settings" />
            </nav>
          </div>
        </div>

        <div className="p-4">
          <button 
            onClick={handleLogout} 
            title={!isSidebarOpen ? "Logout" : undefined}
            className={cn(
              "flex items-center gap-3 py-3 text-sm font-medium text-white/40 hover:text-white transition-colors w-full rounded-lg hover:bg-white/5",
              isSidebarOpen ? "px-4" : "justify-center px-0"
            )}
          >
            <div className="shrink-0"><Power className="w-4 h-4" /></div>
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Subtle Background Elements */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-[#f5f5f5]/40 to-transparent rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
        
        {/* Top Navbar */}
        <header className="h-[88px] flex items-center justify-between px-10 shrink-0 border-b border-black/[0.03] z-10 bg-[#FDFBF7]/80 backdrop-blur-md">
          <h2 className="font-serif text-[22px] text-[#0a0a0a]">Dashboard</h2>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-black/5 shadow-sm">
              <Navigation className="w-3.5 h-3.5 text-[#0a0a0a]" />
              <span className="text-xs font-semibold text-[#0a0a0a]">Shillong • Live</span>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full ml-1" />
            </div>

            <button className="w-10 h-10 bg-white rounded-full border border-black/5 flex items-center justify-center shadow-sm text-[#0a0a0a]/60 hover:text-[#0a0a0a]">
              <Bell className="w-4 h-4" />
            </button>
            
            <div className="w-10 h-10 bg-[#0a0a0a] rounded-full flex items-center justify-center text-white shadow-sm overflow-hidden">
              <User className="w-5 h-5 opacity-80" />
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-10 z-10">
          <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
            
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard 
                title="AI Threat Level" 
                value="Safe to Travel" 
                icon={<Activity className="w-5 h-5 text-[#0a0a0a]" />}
              />
              <MetricCard 
                title="Geo-Fence Status" 
                value="1.2km to Checkpost" 
                icon={<Shield className="w-5 h-5 text-[#0a0a0a]" />}
              />
              <MetricCard 
                title="Companion Status" 
                value="Active Escort" 
                icon={<Wifi className="w-5 h-5 text-[#0a0a0a]" />}
              />
            </div>

            {/* Map & Feed Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Map View */}
              <div className="lg:col-span-8 bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden flex flex-col h-[450px]">
                <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
                  <h3 className="font-serif text-lg text-[#0a0a0a]">Live Region Map</h3>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#0a0a0a]/40 bg-[#0a0a0a]/5 px-3 py-1 rounded-full">GPS Synced</span>
                </div>
                <div className="flex-1 relative bg-[#F8F9F5]">
                  {/* Subtle map pattern */}
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_#0a0a0a_1px,_transparent_1px)] bg-[size:20px_20px]" />
                  
                  {/* Mock Map Element */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative flex flex-col items-center">
                      <div className="w-32 h-32 bg-[#f5f5f5] rounded-full animate-ping opacity-50 absolute" />
                      <div className="w-32 h-32 border border-[#0a0a0a]/20 rounded-full flex items-center justify-center">
                         <div className="w-4 h-4 bg-[#0a0a0a] rounded-full shadow-lg z-10" />
                      </div>
                      <div className="mt-4 px-4 py-2 bg-white rounded-xl shadow-lg border border-black/5 flex items-center gap-2 z-10">
                        <MapPin className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-semibold text-[#0a0a0a]">Green Zone: Sector A</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feed View */}
              <div className="lg:col-span-4 bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden flex flex-col h-[450px]">
                <div className="px-6 py-5 border-b border-black/5 flex items-center gap-3">
                  <CloudSun className="w-5 h-5 text-[#0a0a0a]/60" />
                  <h3 className="font-serif text-lg text-[#0a0a0a]">Incident & Weather</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                  <FeedItem time="Just Now" msg="Weather clear. Ideal for travel to Umiam Lake." type="success" />
                  <FeedItem time="2 hrs ago" msg="Minor roadblock at NH44 cleared. Traffic normal." type="info" />
                  <FeedItem time="Yesterday" msg="Blockchain ILP successfully verified at checkpoint Alpha." type="success" />
                </div>
              </div>

            </div>

            {/* Bottom Row - Permits Drawer */}
            <div id="digital-passes" className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
               <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between bg-[#FDFBF7]/50">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-[#0a0a0a]/60" />
                    <h3 className="font-serif text-lg text-[#0a0a0a]">Digital Permits (ILP)</h3>
                  </div>
                  <span className="text-xs font-semibold text-[#0a0a0a]/50 bg-[#0a0a0a]/5 px-3 py-1 rounded-full">{permits.length} Records</span>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {permits.length === 0 ? (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-[#0a0a0a]/30 gap-3">
                      <FileText className="w-10 h-10 opacity-50" />
                      <span className="text-sm font-medium">No Active Permits Found</span>
                    </div>
                  ) : (
                    permits.map(permit => (
                      <div key={permit.id} className="bg-gradient-to-br from-white to-[#FDFBF7] border border-black/5 p-6 rounded-2xl shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                        <div className={cn(
                          "absolute top-0 left-0 w-full h-1.5",
                          permit.status === 'approved' ? "bg-green-500" : permit.status === 'pending' ? "bg-yellow-500" : "bg-red-500"
                        )} />
                        
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-serif text-lg text-[#0a0a0a]">{permit.geo_zones?.name || 'Restricted Zone'}</h4>
                            <p className="text-[11px] font-semibold text-[#0a0a0a]/50 uppercase tracking-wider mt-1">
                              Valid: {new Date(permit.valid_from).toLocaleDateString()} - {new Date(permit.valid_until).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="p-2 bg-[#0a0a0a]/5 rounded-xl">
                            {permit.blockchain_hash ? (
                              <div 
                                className="bg-white p-1 rounded-lg shadow-sm border border-black/5 cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => setEnlargedPermit(permit)}
                                title="Click to enlarge Digital Pass"
                              >
                                <QRCode value={permit.blockchain_hash} size={64} />
                              </div>
                            ) : (
                              <QrCode className="w-6 h-6 text-[#0a0a0a]" />
                            )}
                          </div>
                        </div>

                        <div className="mt-2 pt-4 border-t border-black/5 flex items-center justify-between">
                           <span className="font-mono text-[10px] text-[#0a0a0a]/40">DID: {permit.blockchain_hash ? permit.blockchain_hash.slice(0, 12) + '...' : 'PENDING'}</span>
                           <span className={cn(
                            "text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full",
                            permit.status === 'approved' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                          )}>{permit.status === 'pending' ? 'PENDING AUTHORITY APPROVAL' : permit.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, isSidebarOpen, onClick }: { icon: React.ReactNode, label: string, active?: boolean, isSidebarOpen?: boolean, onClick?: () => void }) {
  return (
    <a 
      href={onClick ? "#digital-passes" : "#"} 
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      title={!isSidebarOpen ? label : undefined}
      className={cn(
        "flex items-center gap-3 py-3 rounded-lg mx-2 text-sm font-medium transition-all duration-200",
        active 
          ? "bg-[#f5f5f5]/10 text-[#f5f5f5]" 
          : "text-white/50 hover:text-white hover:bg-white/5",
        isSidebarOpen ? "px-4" : "justify-center px-0"
      )}
    >
      <div className="shrink-0">{icon}</div>
      {isSidebarOpen && <span className="whitespace-nowrap">{label}</span>}
    </a>
  );
}

function MetricCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-gradient-to-br from-[#f5f5f5]/50 to-[#fafafa]/30 border border-[#0a0a0a]/5 p-6 rounded-3xl flex flex-col gap-4 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 p-6 opacity-20 pointer-events-none">
        {icon}
      </div>
      <div className="flex items-center gap-2">
        <div className="p-2 bg-white rounded-full shadow-sm border border-black/5">
           {icon}
        </div>
        <span className="text-[11px] font-bold tracking-widest uppercase text-[#0a0a0a]/50">{title}</span>
      </div>
      <div className="font-serif text-2xl text-[#0a0a0a] mt-1">{value}</div>
    </div>
  );
}

function FeedItem({ time, msg, type }: { time: string, msg: string, type: 'info'|'warning'|'success' }) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-1 p-1.5 bg-[#FDFBF7] border border-black/5 rounded-full shadow-sm">
        {type === 'success' && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
        {type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />}
        {type === 'info' && <Navigation className="w-3.5 h-3.5 text-blue-500" />}
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <p className="text-sm text-[#0a0a0a]/80 font-medium leading-snug">{msg}</p>
        <span className="text-[11px] font-semibold tracking-wider text-[#0a0a0a]/40 uppercase">{time}</span>
      </div>
    </div>
  );
}
