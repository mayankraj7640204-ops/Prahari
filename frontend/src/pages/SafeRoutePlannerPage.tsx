import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Car, Footprints, Bike, Train, Plane, Navigation2, MapPin, AlertTriangle, Clock, MapPinIcon, Utensils, Camera, Coffee, Info } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateGeminiContentWithRetry } from '@/lib/gemini';

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

// Haversine distance in km between two lat/lon points
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Generate a great-circle arc path for flight visualization
function generateArcPath(start: [number, number], end: [number, number], numPoints = 50): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = start[0] + (end[0] - start[0]) * t;
    const lon = start[1] + (end[1] - start[1]) * t;
    points.push([lat, lon]);
  }
  return points;
}

interface AIAnalysis {
  safety_score: number;
  color_code: string;
  estimated_time: string;
  warnings: string[];
  important_stops: Array<{ name: string; description: string; type: string }>;
}

type TravelMode = 'driving' | 'foot' | 'bicycle' | 'transit' | 'flight';

export function SafeRoutePlannerPage() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<TravelMode>('driving');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);

  // Smart geocoding with AI typo-correction and disambiguation
  const geocode = async (query: string, type: 'Origin' | 'Destination') => {
    let res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
    let data = await res.json();
    
    let usedCorrection = false;
    let correctedName = query;

    // AI Autocorrect if 0 results
    if (!data || data.length === 0) {
       const aiPrompt = `The user searched for a map location "${query}" but OpenStreetMap couldn't find it. It might be misspelled or a local name (e.g. "aasman ranchi"). Return ONLY the correctly spelled, most globally recognized city/place name for this. DO NOT add any other text or quotes.`;
       try {
         const aiCorrection = await generateGeminiContentWithRetry(aiPrompt);
         correctedName = aiCorrection.replace(/["']/g, '').trim();
         if (correctedName && correctedName.toLowerCase() !== query.toLowerCase()) {
           res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(correctedName)}&limit=5`);
           data = await res.json();
           usedCorrection = true;
         }
       } catch(e) {
         console.warn("AI correction failed", e);
       }
    }

    // If STILL 0 results, use Gemini as the ultimate geocoder
    if (!data || data.length === 0) {
       const aiPrompt = `The user searched for a map location "${query}". OpenStreetMap couldn't find it. Return ONLY a valid JSON object with the latitude and longitude of this location (or the nearest major city/area if exact isn't known). Format: {"lat": 23.344, "lon": 85.309, "displayName": "Proper Name, City"}`;
       try {
         const aiCoord = await generateGeminiContentWithRetry(aiPrompt);
         const jsonMatch = aiCoord.match(/\{[\s\S]*\}/);
         if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.lat && parsed.lon) {
               return {
                 lat: parsed.lat,
                 lon: parsed.lon,
                 displayName: parsed.displayName,
                 usedCorrection: true,
                 correctedName: parsed.displayName
               };
            }
         }
       } catch(e) {}
       throw new Error(`${type} "${query}" not found. Try spelling it differently or adding the city name.`);
    }

    // Update to exact name to remove ambiguity (e.g. which Pantaloons)
    return { 
      lat: parseFloat(data[0].lat), 
      lon: parseFloat(data[0].lon), 
      displayName: data[0].display_name,
      usedCorrection,
      correctedName
    };
  };

  const handleGenerateRoute = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
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
    setIsOfflineMode(false);
    setAnalysis(null);
    setRoutePath([]);

    try {
      // 1. Geocode both locations globally with AI fallback
      const start = await geocode(origin, 'Origin');
      const end = await geocode(destination, 'Destination');
      
      let infoMessages: string[] = [];
      
      // Update inputs to the exact resolved name to remove ambiguity
      if (start.usedCorrection) infoMessages.push(`Did you mean "${start.correctedName}"? Updated Origin.`);
      setOrigin(start.displayName.split(',').slice(0, 3).join(', '));
      
      if (end.usedCorrection) infoMessages.push(`Did you mean "${end.correctedName}"? Updated Destination.`);
      setDestination(end.displayName.split(',').slice(0, 3).join(', '));
      
      if (infoMessages.length > 0) setInfoMsg(infoMessages.join(' | '));
      
      // 2. Calculate straight-line distance for geographic intelligence
      const distKm = haversineDistance(start.lat, start.lon, end.lat, end.lon);
      let activeMode = mode;
      let finalPath: [number, number][] = [];
      let osrmDuration = "";
      let osrmDistance = `${distKm.toFixed(0)} km (straight line)`;
      let autoSwitchedToFlight = false;

      // 3. Geographic Intelligence — auto-detect unreasonable land routes
      const isIntercontinental = distKm > 3000;
      const isLongDistance = distKm > 500;

      if (activeMode !== 'flight' && activeMode !== 'transit') {
        if (isIntercontinental) {
          // Impossible by car/bike/foot — auto-switch to flight
          activeMode = 'flight';
          autoSwitchedToFlight = true;
          setInfoMsg(`🛫 Auto-switched to Flight mode — ${origin} to ${destination} is ${distKm.toFixed(0)} km apart. Land travel is not feasible across this distance.`);
        } else if (isLongDistance && (activeMode === 'foot' || activeMode === 'bicycle')) {
          activeMode = 'driving';
          setInfoMsg(`⚠️ ${distKm.toFixed(0)} km is too far for ${activeMode === 'foot' ? 'walking' : 'cycling'}. Switched to Driving.`);
        }
      }

      // 4. Route generation based on mode
      if (activeMode === 'flight') {
        finalPath = generateArcPath([start.lat, start.lon], [end.lat, end.lon]);
        const flightHours = distKm / 850; // avg commercial jet speed
        const hrs = Math.floor(flightHours);
        const mins = Math.round((flightHours - hrs) * 60);
        osrmDuration = `~${hrs}h ${mins}m (flight)`;
        osrmDistance = `${distKm.toFixed(0)} km`;
      } else if (activeMode === 'transit') {
        finalPath = [[start.lat, start.lon], [end.lat, end.lon]];
        osrmDuration = "Varies by transit";
        osrmDistance = `${distKm.toFixed(0)} km`;
      } else {
        // Try OSRM for land routes
        try {
          const osrmMode = activeMode === 'bicycle' ? 'bike' : activeMode;
          const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/${osrmMode}/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`);
          const osrmData = await osrmRes.json();
          
          if (osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
            // OSRM can't route this — likely overseas. Switch to flight.
            activeMode = 'flight';
            autoSwitchedToFlight = true;
            finalPath = generateArcPath([start.lat, start.lon], [end.lat, end.lon]);
            const flightHours = distKm / 850;
            osrmDuration = `~${Math.floor(flightHours)}h ${Math.round((flightHours % 1) * 60)}m (flight)`;
            osrmDistance = `${distKm.toFixed(0)} km`;
            setInfoMsg(`🛫 No land route available between ${origin} and ${destination}. Showing flight path instead.`);
          } else {
            const route = osrmData.routes[0];
            finalPath = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
            const mins = Math.round(route.duration / 60);
            const hrs = Math.floor(mins / 60);
            osrmDuration = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
            osrmDistance = `${(route.distance / 1000).toFixed(1)} km`;
          }
        } catch (routeErr) {
          // OSRM failed — fallback to flight arc
          activeMode = 'flight';
          finalPath = generateArcPath([start.lat, start.lon], [end.lat, end.lon]);
          const flightHours = distKm / 850;
          osrmDuration = `~${Math.floor(flightHours)}h ${Math.round((flightHours % 1) * 60)}m (flight)`;
          osrmDistance = `${distKm.toFixed(0)} km`;
          setInfoMsg(`🛫 Routing service unavailable. Showing flight path.`);
        }
      }

      if (autoSwitchedToFlight) {
        setMode('flight');
      }

      setRoutePath(finalPath);

      // 5. AI Safety Analysis (with robust fallback)
      const modeLabel = activeMode === 'flight' ? 'commercial flight' : activeMode;
      const systemPrompt = `You are a route safety AI. The user is traveling from ${origin} to ${destination} via ${modeLabel}. The distance is ${osrmDistance} and estimated duration is ${osrmDuration}.
Return ONLY a valid JSON object in exactly this format:
{ 
  "safety_score": 0-100, 
  "color_code": "#22c55e", 
  "estimated_time": "String with time estimate", 
  "warnings": ["warning 1", "warning 2"],
  "important_stops": [ {"name": "Real-world attraction/waypoint name", "description": "Why to stop", "type": "food|sightseeing|rest"} ]
}
CRUCIAL: The 'important_stops' MUST be exact named real-world attractions (e.g., 'Thean Hou Temple', 'Grand Canyon National Park'), historical landmarks, or prominent waypoints located exactly between ${origin} and ${destination}. DO NOT use generic placeholders like 'Midpoint Rest Stop', 'Highway Outskirts', or 'Regional Cuisine Hub'.
Color Rules: green (#22c55e) for score >75, yellow (#eab308) for 40-75, red (#ef4444) for <40. For flights, include layover airports and visa requirements as warnings. Return RAW JSON without any markdown formatting.`;

      try {
        const aiText = await generateGeminiContentWithRetry(systemPrompt);
        
        // Robust JSON extraction
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        const cleaned = jsonMatch ? jsonMatch[0] : aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        const parsedAnalysis = JSON.parse(cleaned);
        setAnalysis(parsedAnalysis);
      } catch (aiErr) {
        console.warn("[Prahari] AI analysis failed, using smart fallback:", aiErr);
        setIsOfflineMode(true);
        // Smart local fallback based on distance and mode
        const score = activeMode === 'flight' ? 85 : distKm < 100 ? 90 : distKm < 500 ? 75 : 60;
        const color = score > 75 ? '#22c55e' : score > 40 ? '#eab308' : '#ef4444';
        const warnings: string[] = [];
        const stops: AIAnalysis['important_stops'] = [];

        if (activeMode === 'flight') {
          warnings.push(`International travel: Ensure you have a valid passport and any required visas for ${destination}.`);
          warnings.push("Check airline baggage policies and arrive at the airport at least 3 hours before departure.");
          stops.push({ name: `${origin} International Airport`, description: "Departure terminal — arrive early for security checks.", type: "rest" });
          stops.push({ name: `${destination} International Airport`, description: "Arrival terminal — arrange ground transportation in advance.", type: "rest" });
        } else {
          if (distKm > 200) warnings.push("Long drive ahead — take breaks every 2 hours to stay alert.");
          if (distKm > 500) warnings.push("Consider refueling midway. Check fuel station availability on your route.");
          stops.push({ name: `Major Checkpoint outside ${origin}`, description: "Final chance to restock essentials before the long stretch.", type: "rest" });
          stops.push({ name: `Popular Transit Hub / Diner on route to ${destination}`, description: "Experience local dining along the approach route.", type: "food" });
        }
        stops.push({ name: `${destination} Arrival`, description: "Your final destination — enjoy your stay!", type: "sightseeing" });

        setAnalysis({
          safety_score: score,
          color_code: color,
          estimated_time: osrmDuration,
          warnings,
          important_stops: stops
        });
      }
      
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
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-serif text-3xl font-bold text-[#0a0a0a] flex items-center gap-3">
              <Navigation2 className="w-7 h-7 text-blue-600" /> Safe Route Planner
            </h1>
            {isOfflineMode && (
              <span className="bg-neutral-200 text-neutral-600 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                Offline Mode Active
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-[#0a0a0a]/50 mb-8">
            Ultra-fast, AI-powered safety routing with geographic intelligence.
          </p>

          <div className="space-y-4">
            <div className="relative">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 absolute top-3 left-4">Origin (From)</label>
              <input 
                type="text" 
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                className="w-full bg-[#f5f5f5] border border-black/5 rounded-2xl pt-8 pb-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10" 
                placeholder="e.g., New York, USA" 
              />
            </div>
            
            <div className="relative">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 absolute top-3 left-4">Destination (To)</label>
              <input 
                type="text" 
                value={destination}
                onChange={e => setDestination(e.target.value)}
                className="w-full bg-[#f5f5f5] border border-black/5 rounded-2xl pt-8 pb-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10" 
                placeholder="e.g., Moscow, Russia" 
              />
            </div>

            <div className="flex gap-1.5 bg-[#f5f5f5] p-1.5 rounded-2xl">
              {[
                { id: 'driving', icon: Car, label: 'Drive' },
                { id: 'transit', icon: Train, label: 'Transit' },
                { id: 'bicycle', icon: Bike, label: 'Cycle' },
                { id: 'foot', icon: Footprints, label: 'Walk' },
                { id: 'flight', icon: Plane, label: 'Flight' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id as TravelMode)}
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

            {infoMsg && (
              <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-xs font-bold flex items-start gap-2 border border-blue-100 animate-in fade-in duration-300">
                <Info className="w-4 h-4 shrink-0 mt-0.5" /> <span>{infoMsg}</span>
              </div>
            )}

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
               <p className="text-xs font-mono tracking-widest uppercase">Analyzing route safety...</p>
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
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          />
          {routePath.length > 0 && (
            <>
              <MapUpdater path={routePath} />
              <Polyline 
                positions={routePath} 
                color={analysis?.color_code || "#3b82f6"} 
                weight={mode === 'flight' ? 4 : 6} 
                opacity={0.8}
                dashArray={mode === 'flight' ? "12, 8" : mode === 'transit' ? "10, 15" : undefined}
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
