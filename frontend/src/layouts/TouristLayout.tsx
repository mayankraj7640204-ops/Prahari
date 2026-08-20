import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  Shield, Activity, AlertTriangle, FileText, Navigation, 
  Power, Leaf, Bell, User, Map, Smartphone, Settings, Menu, X, Crosshair, Calendar
} from 'lucide-react';
import QRCode from 'react-qr-code';
import SHA256 from 'crypto-js/sha256';
import { GoogleGenAI } from '@google/genai';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TouristContextType {
  tourist: any;
  permits: any[];
  activeSosAlert: any;
  activeEta: number;
  locationName: string;
  userLocation: [number, number];
  setToastMessage: (msg: string) => void;
  setEnlargedPermit: (permit: any) => void;
  travelerProfile: any | null;
  refreshProfile: () => Promise<void>;
}

export function TouristLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tourist, setTourist] = useState<any>(null);
  const [travelerProfile, setTravelerProfile] = useState<any>(null);
  const [permits, setPermits] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showTravelForm, setShowTravelForm] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [enlargedPermit, setEnlargedPermit] = useState<any>(null);
  
  // SOS States
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [activeSosAlert, setActiveSosAlert] = useState<any>(null);
  const [customSosText, setCustomSosText] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [incidentCategory, setIncidentCategory] = useState('Medical Emergency');
  const [locationName, setLocationName] = useState('Locating...');
  const [userLocation, setUserLocation] = useState<[number, number]>([25.5788, 91.8933]);
  const [activeEta, setActiveEta] = useState<number>(15);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (activeSosAlert?.status === 'dispatched') {
      // Calculate initial ETA immediately
      const match = activeSosAlert.incident_type?.match(/\[DISPATCHED:(\d+)\]/);
      const start = match ? parseInt(match[1], 10) : new Date(activeSosAlert.created_at).getTime();
      setActiveEta(Math.max(1, Math.floor(15 - ((Date.now() - start) / 60000))));

      // Update every second
      const interval = setInterval(() => {
        const diffMinutes = (Date.now() - start) / 60000;
        setActiveEta(Math.max(1, Math.floor(15 - diffMinutes)));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeSosAlert]);
  
  const [formData, setFormData] = useState({
    passport: '',
    departureDate: '',
    returnDate: '',
    hotel: ''
  });

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      try {
        const { data: profileData } = await supabase
          .from('traveler_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profileData) {
          setTravelerProfile(profileData);
        }

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
        console.error("Error setting up tourist profile:", err);
      }

      // Fetch live geocoded location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
            setUserLocation([pos.coords.latitude, pos.coords.longitude]);
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const data = await res.json();
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || 'Unknown';
            const state = data.address?.state || '';
            setLocationName(`${city}${state ? `, ${state}` : ''}`);
          } catch (err) {
            console.error("Geocoding failed", err);
            setLocationName("Location Unknown");
          }
        }, () => {
          setLocationName("GPS Disabled");
        });
      } else {
        setLocationName("GPS Unsupported");
      }
      setLoading(false);
    }

    fetchData();
  }, [user]);

  useEffect(() => {
    if (!loading && !travelerProfile && location.pathname !== '/dashboard/tourist/profile') {
      setToastMessage("Please complete your Traveler Profile to access the dashboard and generate passes.");
      navigate('/dashboard/tourist/profile');
    }
  }, [loading, travelerProfile, location.pathname, navigate]);

  useEffect(() => {
    if (!tourist) return;

    const channel = supabase.channel('tourist-sos-channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sos_alerts', 
        filter: `tourist_id=eq.${tourist.id}` 
      }, (payload) => {
        if ((payload.new as any).status === 'resolved') {
          setActiveSosAlert(null);
          setIsSosModalOpen(false);
        } else {
          setActiveSosAlert(payload.new);
        }
      })
      .subscribe();
      
    // Fetch initial active alert
    supabase.from('sos_alerts')
      .select('*')
      .eq('tourist_id', tourist.id)
      .neq('status', 'resolved')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setActiveSosAlert(data || null));
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tourist]);

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

    const nationality = travelerProfile?.nationality || 'Other';
    const passport = formData.passport.trim();
    let isValid = false;
    let expectedFormat = "";

    if (nationality === 'India') {
      isValid = /^[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]$/.test(passport);
      expectedFormat = "1 Letter + 7 Numbers (e.g., A1234567)";
    } else if (nationality === 'USA' || nationality === 'United States') {
      isValid = /^\d{9}$/.test(passport);
      expectedFormat = "9 Digits";
    } else if (nationality === 'UK' || nationality === 'United Kingdom') {
      isValid = /^\d{9}$/.test(passport);
      expectedFormat = "9 Digits";
    } else {
      isValid = /^(?!^([A-Za-z0-9])\1+$)[A-Za-z0-9]{6,15}$/i.test(passport);
      expectedFormat = "6-15 Alphanumeric Characters";
    }

    if (!isValid) {
      setToastMessage(`Invalid ${nationality} Passport Format (Expected: ${expectedFormat})`);
      return;
    }

    const today = new Date(); 
    today.setHours(0,0,0,0);
    const depDate = new Date(formData.departureDate); 
    depDate.setHours(0,0,0,0);
    if (depDate < today) {
       setToastMessage("Departure date cannot be in the past.");
       return;
    }
    const retDate = new Date(formData.returnDate);
    retDate.setHours(0,0,0,0);
    if (retDate < depDate) {
       setToastMessage("Return date cannot be before departure date.");
       return;
    }

    setIsProcessingAI(true);
    setToastMessage("AI is analyzing your itinerary globally...");

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
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
      setFormData({ passport: '', departureDate: '', returnDate: '', hotel: '' });
      
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

  const executeSOS = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !tourist) {
      setToastMessage("Authentication lost. Please log in to broadcast SOS.");
      setIsSosModalOpen(false);
      isSubmittingRef.current = false;
      return;
    }
    
    const finalName = emergencyName || tourist.full_name || 'Unknown Tourist';
    const finalPhone = emergencyPhone || tourist.phone || '';
    
    // Upsert tourist name and phone
    try {
      await supabase.from('tourists').update({
        full_name: finalName,
        phone: finalPhone
      }).eq('id', tourist.id);
    } catch (e) {
      console.warn("Could not update tourist profile", e);
    }

    // Fetch Geolocation
    let lat = 25.5788;
    let lng = 91.8933;
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
    } catch (e) {
      console.warn("Could not get geolocation, using fallback", e);
    }

    // Insert SOS Alert
    try {
      const { data, error } = await supabase
        .from('sos_alerts')
        .insert({
          tourist_id: tourist.id,
          latitude: lat,
          longitude: lng,
          ai_severity_score: incidentCategory === 'Medical Emergency' ? 10 : 8,
          status: 'active',
          incident_type: incidentCategory === 'Custom' ? `CUSTOM: ${customSosText || 'Emergency'}` : incidentCategory
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to trigger SOS', error);
        setToastMessage("Failed to broadcast SOS.");
      } else {
        setActiveSosAlert(data);
      }
    } catch (err) {
      console.error(err);
      setToastMessage("Error triggering SOS.");
    } finally {
      setIsSosModalOpen(false);
      isSubmittingRef.current = false;
    }
  };

  const resolveSOS = async () => {
    if (!activeSosAlert) return;
    try {
      await supabase.from('sos_alerts').update({ status: 'resolved' }).eq('id', activeSosAlert.id);
      setActiveSosAlert(null);
    } catch (e) {
      console.error("Failed to resolve SOS", e);
    }
  };

  const handleSOSClick = () => {
    if (activeSosAlert) return;
    const currentName = travelerProfile?.full_name || tourist?.full_name;
    setEmergencyName(currentName === 'New Tourist' ? '' : currentName || '');
    setEmergencyPhone(tourist?.phone || '');
    setIncidentCategory('Medical Emergency');
    setCustomSosText('');
    setIsSosModalOpen(true);
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

      {/* Active SOS Banner */}
      {activeSosAlert && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white z-[300] shadow-2xl animate-in slide-in-from-top border-b border-red-500 flex flex-col">
          <div className="px-4 py-3 flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-3 mb-3 md:mb-0">
              <div className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-widest text-sm md:text-base">SOS ACTIVE - {activeSosAlert.status === 'dispatched' ? 'UNIT EN ROUTE' : 'DISPATCH NOTIFIED'}</h2>
                <p className="text-xs text-red-100 font-mono">Live Beacon: {activeSosAlert.latitude.toFixed(4)}, {activeSosAlert.longitude.toFixed(4)}</p>
              </div>
            </div>
            <button 
              onClick={resolveSOS}
              className="px-4 py-2 bg-white text-red-600 font-bold uppercase tracking-widest text-xs rounded hover:bg-red-50 transition-colors w-full md:w-auto shadow-lg"
            >
              Resolve / Cancel Alert
            </button>
          </div>
          
          <div className="bg-red-950/40 px-4 py-3 border-t border-red-500/30 flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-red-200 mb-2">Nearby Safety Crews & Stations</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-black/20 p-2 rounded border border-white/10 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-xs font-bold">Local City Police Patrol</div>
                    <div className="text-[10px] font-mono text-green-400 font-bold tracking-widest">AVAILABLE</div>
                  </div>
                  <div className="text-[10px] text-white/60 font-mono mb-1">0.8 km away</div>
                  <div className="text-[10px] text-yellow-500 font-mono">✆ +91 98765 11111</div>
                </div>
                <div className="bg-black/20 p-2 rounded border border-white/10 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-xs font-bold">Rapid Medical Responders</div>
                    <div className="text-[10px] font-mono text-green-400 font-bold tracking-widest">AVAILABLE</div>
                  </div>
                  <div className="text-[10px] text-white/60 font-mono mb-1">1.2 km away</div>
                  <div className="text-[10px] text-yellow-500 font-mono">✆ +91 98765 22222</div>
                </div>
                <div className="bg-black/20 p-2 rounded border border-white/10 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-xs font-bold">Highway Safety Crew</div>
                    <div className="text-[10px] font-mono text-green-400 font-bold tracking-widest">AVAILABLE</div>
                  </div>
                  <div className="text-[10px] text-white/60 font-mono mb-1">2.5 km away</div>
                  <div className="text-[10px] text-yellow-500 font-mono">✆ +91 98765 33333</div>
                </div>
              </div>
              {activeSosAlert.status === 'dispatched' && (
                <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center gap-3 animate-pulse">
                  <Crosshair className="w-5 h-5 text-yellow-400" />
                  <div className="text-sm font-bold text-yellow-100 uppercase tracking-widest">Rescue Team Dispatched and En Route. Estimated ETA: {activeEta} mins.</div>
                </div>
              )}
            </div>
            
            {/* Mini Tracking Radar */}
            <div className="w-full lg:w-48 h-32 lg:h-auto bg-black/50 border border-red-500/20 rounded-lg relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,0,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,0,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_20%,rgba(0,0,0,0.8)_100%)]" />
              
              {/* Radar Sweep */}
              <div className="absolute w-full h-full animate-[spin_4s_linear_infinite] origin-center">
                <div className="w-1/2 h-1/2 border-r-2 border-red-500/50 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(220,38,38,0.2)_90deg)]" />
              </div>
              
              {/* Tourist Dot */}
              <div className="absolute w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_red] z-10" />
              
              {/* Rescuer Dot (if dispatched) */}
              {activeSosAlert.status === 'dispatched' && (
                <div className="absolute w-3 h-3 bg-yellow-400 rounded-full shadow-[0_0_15px_yellow] z-20 animate-pulse transition-all duration-1000" style={{ top: '20%', left: '20%' }}>
                  <span className="absolute -top-4 -left-4 text-[8px] font-mono text-yellow-400 whitespace-nowrap">UNIT</span>
                </div>
              )}
              
              <div className="absolute bottom-1 right-1 text-[8px] text-red-500/50 font-mono z-10">LOCAL RADAR</div>
            </div>
          </div>
        </div>
      )}

      {/* SOS Trigger Modal */}
      {isSosModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[250] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0a0a0a] border border-red-500/30 p-6 md:p-8 rounded-3xl shadow-2xl max-w-md w-full relative">
            <button 
              onClick={() => {
                setIsSosModalOpen(false);
              }}
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-2xl text-white">Emergency SOS</h3>
              <p className="text-white/60 text-sm mt-2">Select the nature of your emergency to notify the nearest command center immediately.</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Live Location Preview</div>
                <div className="text-sm text-white font-mono">{locationName}</div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-white/60 mb-2">Full Name (Required)</label>
                <input 
                  type="text" 
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-white/60 mb-2">Phone Number (Required)</label>
                <input 
                  type="text" 
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-white/60 mb-2">Incident Type</label>
                <select 
                  value={incidentCategory}
                  onChange={(e) => setIncidentCategory(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                >
                  <option value="Medical Emergency">Medical Emergency</option>
                  <option value="Route Stranded">Route Stranded</option>
                  <option value="Threat/Harassment">Threat/Harassment</option>
                  <option value="Natural Hazard">Natural Hazard</option>
                  <option value="Custom">Custom Emergency...</option>
                </select>
              </div>

              {incidentCategory === 'Custom' && (
                <div>
                  <input 
                    type="text" 
                    value={customSosText}
                    onChange={(e) => setCustomSosText(e.target.value)}
                    placeholder="Describe your emergency..." 
                    className="w-full bg-[#0a0a0a] border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
              )}

              <button 
                onClick={executeSOS}
                disabled={!emergencyName.trim() || !emergencyPhone.trim() || (incidentCategory === 'Custom' && !customSosText.trim()) || isSubmittingRef.current}
                className="mt-4 w-full p-4 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:opacity-50 text-white font-bold uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] animate-pulse"
              >
                {isSubmittingRef.current ? "Broadcasting..." : "CONFIRM & BROADCAST DISTRESS SIGNAL"}
              </button>
            </div>
          </div>
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
                  <div className="font-sans text-sm font-bold text-[#0a0a0a] uppercase">{travelerProfile?.full_name || tourist?.full_name || 'N/A'}</div>
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
                  <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 absolute top-3 left-4">Passport / ID</label>
                  <input required type="text" value={formData.passport} onChange={e => setFormData({...formData, passport: e.target.value})} className="w-full bg-white border border-black/5 rounded-xl pt-8 pb-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10" placeholder="A1234567" />
                </div>
                
                <div className="flex-[0.8] w-full relative">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 absolute top-3 left-4">Departure</label>
                  <input required min={new Date().toISOString().split('T')[0]} type="date" value={formData.departureDate} onChange={e => setFormData({...formData, departureDate: e.target.value})} className="w-full bg-white border border-black/5 rounded-xl pt-8 pb-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10" />
                </div>

                <div className="flex-[0.8] w-full relative">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 absolute top-3 left-4">Return</label>
                  <input required min={formData.departureDate || new Date().toISOString().split('T')[0]} type="date" value={formData.returnDate} onChange={e => setFormData({...formData, returnDate: e.target.value})} className="w-full bg-white border border-black/5 rounded-xl pt-8 pb-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10" />
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
              <SidebarItem isSidebarOpen={isSidebarOpen} icon={<Activity className="w-4 h-4" />} label="Command Dashboard" active={location.pathname === '/dashboard/tourist'} onClick={() => navigate('/dashboard/tourist')} />
              <SidebarItem isSidebarOpen={isSidebarOpen} icon={<Map className="w-4 h-4" />} label="Live Geo-Fence Map" active={location.pathname === '/dashboard/tourist/geofence'} onClick={() => navigate('/dashboard/tourist/geofence')} />
              <SidebarItem isSidebarOpen={isSidebarOpen} icon={<Calendar className="w-4 h-4" />} label="Itinerary Planner" active={location.pathname === '/dashboard/tourist/itinerary'} onClick={() => navigate('/dashboard/tourist/itinerary')} />
              <SidebarItem isSidebarOpen={isSidebarOpen} icon={<Shield className="w-4 h-4" />} label="AI Incident Sentinel" active={location.pathname === '/dashboard/tourist/sentinel'} onClick={() => navigate('/dashboard/tourist/sentinel')} />
              <SidebarItem 
                isSidebarOpen={isSidebarOpen} 
                icon={<FileText className="w-4 h-4" />} 
                label="Blockchain Digital Pass" 
                onClick={() => {
                  if (location.pathname !== '/dashboard/tourist') {
                    navigate('/dashboard/tourist');
                  }
                  setTimeout(() => {
                    if (permits && permits.length > 0) {
                      setEnlargedPermit(permits[0]);
                    } else {
                      document.getElementById('digital-passes')?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }, 100);
                }} 
              />
              <button 
                onClick={handleSOSClick}
                title={!isSidebarOpen ? "Emergency & SOS" : undefined}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 w-full text-left transition-all duration-300 font-mono text-xs tracking-widest uppercase",
                  activeSosAlert ? "bg-red-500/20 text-red-300 hover:text-red-300 pointer-events-none" : "text-white/50 hover:bg-white/5 hover:text-white"
                )}
              >
                <div className="shrink-0"><AlertTriangle className={cn("w-4 h-4", activeSosAlert ? "animate-pulse text-red-400" : "")} /></div>
                {isSidebarOpen && <span className="whitespace-nowrap">{activeSosAlert ? "SOS Transmitting..." : "Emergency & SOS"}</span>}
              </button>
              <SidebarItem 
                isSidebarOpen={isSidebarOpen} 
                icon={<Navigation className="w-4 h-4" />} 
                label="Safe Route Planner" 
                onClick={() => navigate('/dashboard/tourist/route-planner')}
                active={location.pathname === '/dashboard/tourist/route-planner'}
              />
              <SidebarItem 
                isSidebarOpen={isSidebarOpen} 
                icon={<Smartphone className="w-4 h-4" />} 
                label="Offline Beacon" 
                onClick={() => navigate('/dashboard/tourist/offline-beacon')}
                active={location.pathname === '/dashboard/tourist/offline-beacon'}
              />
            </nav>
          </div>

          <div className="px-4 mt-8">
            {isSidebarOpen && <h2 className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-4 px-4 whitespace-nowrap">Account</h2>}
            <nav className="flex flex-col gap-1">
              <SidebarItem 
                isSidebarOpen={isSidebarOpen} 
                icon={<User className="w-4 h-4" />} 
                label="Traveler Profile" 
                onClick={() => navigate('/dashboard/tourist/profile')}
                active={location.pathname === '/dashboard/tourist/profile'}
              />
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
              <span className="text-xs font-semibold text-[#0a0a0a]">{locationName} • Live</span>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full ml-1 animate-pulse" />
            </div>

            <button className="w-10 h-10 bg-white rounded-full border border-black/5 flex items-center justify-center shadow-sm text-[#0a0a0a]/60 hover:text-[#0a0a0a]">
              <Bell className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-[#0a0a0a] hidden md:block">
                {travelerProfile?.full_name || 'New Traveler'}
              </span>
              <div className="w-10 h-10 bg-[#0a0a0a] rounded-full flex items-center justify-center text-white shadow-sm overflow-hidden">
                {travelerProfile?.avatar_url ? (
                  <img src={travelerProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 opacity-80" />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content (Outlet) */}
        <main className="flex-1 overflow-y-auto z-10">
          <Outlet context={{ 
            tourist, 
            travelerProfile,
            permits, 
            activeSosAlert, 
            activeEta, 
            locationName, 
            userLocation, 
            setToastMessage,
            setEnlargedPermit,
            refreshProfile: async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const { data } = await supabase.from('traveler_profiles').select('*').eq('id', user.id).single();
                if (data) setTravelerProfile(data);
              }
            }
          }} />
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
