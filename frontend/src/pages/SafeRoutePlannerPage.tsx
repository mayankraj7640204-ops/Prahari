import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Car, Footprints, Bike, Train, Navigation2, MapPin, AlertTriangle, Clock, MapPinIcon, Utensils, Camera, Coffee } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const originIcon = L.divIcon({
  className: 'bg-transparent border-0',
  html: `<div class="flex items-center justify-center w-8 h-8 bg-green-500 text-white rounded-full border-2 border-white shadow-lg text-[9px] font-bold tracking-widest uppercase">Start</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const destIcon = L.divIcon({
  className: 'bg-transparent border-0',
  html: `<div class="flex items-center justify-center w-8 h-8 bg-[#0a0a0a] text-white rounded-full border-2 border-white shadow-lg text-[9px] font-bold tracking-widest uppercase">End</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// Component to adjust map bounds to polyline
function MapUpdater({ path }: { path: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (path && path.length > 0) {
      const bounds = L.latLngBounds(path);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [path, map]);
  return null;
}

interface AIAnalysis {
  safety_score: number;
  color_code: string;
  estimated_time: string;
  warnings: string[];
  important_stops: Array<{ name: string; description: string; type: string }>;
}

export function SafeRoutePlannerPage() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<'driving' | 'foot' | 'bicycle' | 'transit'>('driving');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);

  const geocode = async (query: string) => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=1`);
    const data = await res.json();
    if (!data || data.length === 0) throw new Error(`Location not found. Try adding a city or state (e.g., 'Destination, State').`);
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  };

  const handleGenerateRoute = async () => {
    setErrorMsg(null);
    if (!origin.trim() || !destination.trim()) {
      setErrorMsg("Please enter both an origin and a destination.");
      return;
    }

    const isSame = origin.trim().toLowerCase() === destination.trim().toLowerCase();
    if (isSame) {
      setErrorMsg("Origin and Destination cannot be the same.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);
    setRoutePath([]);

    try {
      // 1. Geocode
      const start = await geocode(origin);
      const end = await geocode(destination);
      
      let finalPath: [number, number][] = [];
      let osrmDuration = "";
      let osrmDistance = "";

      // 2. Route via OSRM if not transit
      if (mode === 'transit') {
        finalPath = [[start.lat, start.lon], [end.lat, end.lon]];
        osrmDuration = "Varies by transit";
        osrmDistance = "Direct line";
      } else {
        const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/${mode}/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`);
        const osrmData = await osrmRes.json();
        
        if (osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
          throw new Error("Could not calculate route via OSRM.");
        }
        
        const route = osrmData.routes[0];
        // OSRM geojson coordinates are [lon, lat]
        finalPath = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        
        const mins = Math.round(route.duration / 60);
        const hrs = Math.floor(mins / 60);
        osrmDuration = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
        osrmDistance = `${(route.distance / 1000).toFixed(1)} km`;
      }
      
      setRoutePath(finalPath);

      // 3. Gemini AI Analysis
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key not found.");

      const systemPrompt = `You are a route safety AI. The user is traveling from ${origin} to ${destination} via ${mode}. The calculated distance is ${osrmDistance} and base duration is ${osrmDuration}.
Return ONLY a valid JSON object in exactly this format:
{ 
  "safety_score": 0-100, 
  "color_code": "#22c55e", 
  "estimated_time": "String", 
  "warnings": ["warning 1", "warning 2"],
  "important_stops": [ {"name": "Stop Name", "description": "Why to stop", "type": "food|sightseeing|rest"} ]
}
Color Rules: green >75, yellow 40-75, red <40. Return RAW JSON without any markdown formatting. You MUST return ONLY a raw JSON object. Do not include markdown formatting, backticks, or the word 'json'.`;

      const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }]
        })
      });

      const aiData = await aiRes.json();
      if (!aiRes.ok) throw new Error(aiData.error?.message || "AI Request failed");
      
      let rawText = aiData.candidates[0].content.parts[0].text;
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedAnalysis = JSON.parse(rawText);
      setAnalysis(parsedAnalysis);
      
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to generate route.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStopIcon = (type: string) => {
    switch(type) {
      case 'food': return <Utensils className="w-4 h-4 text-orange-500" />;
      case 'sightseeing': return <Camera className="w-4 h-4 text-blue-500" />;
      case 'rest': return <Coffee className="w-4 h-4 text-amber-600" />;
      default: return <MapPinIcon className="w-4 h-4 text-neutral-500" />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#FDFBF7] selection:bg-[#0a0a0a]/10 overflow-hidden relative z-10">
      
      {/* Left Sidebar (35%) */}
      <div className="w-full md:w-[35%] h-1/2 md:h-full bg-white border-r border-black/5 shadow-xl flex flex-col z-20 overflow-y-auto custom-scrollbar">
        <div className="p-6 md:p-8 shrink-0 border-b border-black/5 bg-white sticky top-0 z-10">
          <h1 className="font-serif text-3xl font-bold text-[#0a0a0a] mb-2 flex items-center gap-3">
            <Navigation2 className="w-7 h-7 text-blue-600" /> Safe Route Planner
          </h1>
          <p className="text-sm font-medium text-[#0a0a0a]/50 mb-8">
            Ultra-fast, AI-powered safety routing and smart point-of-interest discovery.
          </p>

          <div className="space-y-4">
            <div className="relative">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 absolute top-3 left-4">Origin (From)</label>
              <input 
                type="text" 
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                className="w-full bg-[#f5f5f5] border border-black/5 rounded-2xl pt-8 pb-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10" 
                placeholder="e.g., Lalpur, Ranchi" 
              />
            </div>
            
            <div className="relative">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 absolute top-3 left-4">Destination (To)</label>
              <input 
                type="text" 
                value={destination}
                onChange={e => setDestination(e.target.value)}
                className="w-full bg-[#f5f5f5] border border-black/5 rounded-2xl pt-8 pb-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10" 
                placeholder="e.g., Patratu Dam, Jharkhand" 
              />
            </div>

            <div className="flex gap-2 bg-[#f5f5f5] p-1.5 rounded-2xl">
              {[
                { id: 'driving', icon: Car, label: 'Driving' },
                { id: 'transit', icon: Train, label: 'Transit' },
                { id: 'bicycle', icon: Bike, label: 'Cycling' },
                { id: 'foot', icon: Footprints, label: 'Walking' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id as any)}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-200",
                    mode === m.id ? "bg-white shadow-sm text-blue-600 border border-black/5" : "text-[#0a0a0a]/40 hover:text-[#0a0a0a] hover:bg-black/5"
                  )}
                >
                  <m.icon className="w-5 h-5 mb-1" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">{m.label}</span>
                </button>
              ))}
            </div>

            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {errorMsg}
              </div>
            )}

            <button 
              onClick={handleGenerateRoute}
              disabled={isAnalyzing}
              className="w-full h-14 bg-[#0a0a0a] text-white rounded-2xl font-bold text-sm hover:bg-black/80 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>Generate Safe Route</>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Stops Content */}
        <div className="p-6 md:p-8 flex-1">
          {isAnalyzing ? (
             <div className="flex flex-col items-center justify-center h-40 text-neutral-400 space-y-4">
               <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
               <p className="text-xs font-mono tracking-widest uppercase">Gemini AI is analyzing safety...</p>
             </div>
          ) : analysis?.important_stops ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xs font-bold tracking-widest text-[#0a0a0a]/40 uppercase mb-4">Important Stops & POIs</h2>
              <div className="space-y-4">
                {analysis.important_stops.map((stop, idx) => (
                  <div key={idx} className="bg-[#f5f5f5] border border-black/5 p-4 rounded-2xl flex gap-4">
                    <div className="shrink-0 mt-1">
                      {getStopIcon(stop.type)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#0a0a0a] mb-1">{stop.name}</h3>
                      <p className="text-xs text-[#0a0a0a]/60 leading-relaxed">{stop.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-neutral-400/50 space-y-3">
              <MapPin className="w-8 h-8 opacity-20" />
              <p className="text-xs font-medium">No route selected</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Area: Map (65%) */}
      <div className="flex-1 relative h-1/2 md:h-full bg-neutral-200">
        <MapContainer 
          center={[20, 0]} 
          zoom={2} 
          className="w-full h-full"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          />
          {routePath.length > 0 && (
            <>
              <MapUpdater path={routePath} />
              <Polyline 
                positions={routePath} 
                color={analysis?.color_code || "#3b82f6"} 
                weight={6} 
                opacity={0.8}
                dashArray={mode === 'transit' ? "10, 15" : undefined}
                lineCap="round"
                lineJoin="round"
              />
              <Marker position={routePath[0]} icon={originIcon} />
              <Marker position={routePath[routePath.length - 1]} icon={destIcon} />
            </>
          )}
        </MapContainer>

        {/* Floating Route Summary Card */}
        {analysis && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] w-[90%] max-w-md animate-in slide-in-from-bottom-8 fade-in duration-500">
            <div className="bg-white/90 backdrop-blur-xl border border-white/20 p-6 rounded-3xl shadow-2xl overflow-hidden relative">
              <div 
                className="absolute top-0 left-0 w-full h-1"
                style={{ backgroundColor: analysis.color_code }}
              />
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#0a0a0a]">Route Summary</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{analysis.estimated_time}</span>
                  </div>
                </div>
                <div 
                  className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl shadow-inner border border-black/5"
                  style={{ backgroundColor: `${analysis.color_code}15` }}
                >
                  <span className="text-lg font-black" style={{ color: analysis.color_code }}>
                    {analysis.safety_score}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-widest opacity-50">Score</span>
                </div>
              </div>

              {analysis.warnings && analysis.warnings.length > 0 && (
                <div className="space-y-2 mt-4 pt-4 border-t border-black/5">
                  <h4 className="text-[10px] font-bold tracking-widest text-[#0a0a0a]/40 uppercase flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Active Warnings
                  </h4>
                  {analysis.warnings.map((w, i) => (
                    <div key={i} className="text-xs font-medium text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100">
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
