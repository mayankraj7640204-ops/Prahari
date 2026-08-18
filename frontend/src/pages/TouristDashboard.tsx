import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  Shield, MapPin, Activity, AlertTriangle, FileText, Navigation, 
  CheckCircle, Wifi, QrCode, Power, CloudSun, Leaf, Bell, User, Map, BookOpen, Smartphone, Settings, Menu
} from 'lucide-react';
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
              <SidebarItem isSidebarOpen={isSidebarOpen} icon={<FileText className="w-4 h-4" />} label="Blockchain Digital Pass" />
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
            <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
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
                            <QrCode className="w-6 h-6 text-[#0a0a0a]" />
                          </div>
                        </div>

                        <div className="mt-2 pt-4 border-t border-black/5 flex items-center justify-between">
                           <span className="font-mono text-[10px] text-[#0a0a0a]/40">DID: {permit.blockchain_hash ? permit.blockchain_hash.slice(0, 12) + '...' : 'PENDING'}</span>
                           <span className={cn(
                            "text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full",
                            permit.status === 'approved' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                          )}>{permit.status}</span>
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

function SidebarItem({ icon, label, active, isSidebarOpen }: { icon: React.ReactNode, label: string, active?: boolean, isSidebarOpen?: boolean }) {
  return (
    <a 
      href="#" 
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
