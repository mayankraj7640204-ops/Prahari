import { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { TouristContextType } from '@/layouts/TouristLayout';
import { Shield, AlertTriangle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const createTouristDot = () => L.divIcon({
  className: 'bg-transparent border-0',
  html: `<div class="relative"><div class="w-4 h-4 bg-black rounded-full border-2 border-white shadow-lg"></div></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const createUnitDot = () => L.divIcon({
  className: 'bg-transparent border-0',
  html: `<div class="relative"><div class="w-8 h-8 bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.8)] flex items-center justify-center border-2 border-white animate-bounce"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== 0) {
      map.flyTo(center, zoom, { animate: true, duration: 1.5 });
    }
  }, [center, map, zoom]);
  return null;
}

const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

export function GeoFencePage() {
  const { 
    activeSosAlert, 
    activeEta, 
    userLocation,
    tourist,
    setToastMessage
  } = useOutletContext<TouristContextType>();

  const [geoZones, setGeoZones] = useState<any[]>([]);
  const [simulatedLocation, setSimulatedLocation] = useState<[number, number]>(userLocation);
  const [currentZone, setCurrentZone] = useState<{name: string, level: string} | null>(null);
  const breachLock = useRef(false);

  // Sync simulator to real location initially
  useEffect(() => {
    setSimulatedLocation(userLocation);
  }, [userLocation]);

  // Point in Polygon Algorithm (Ray-Casting)
  const isPointInPolygon = (point: [number, number], polygon: [number, number][]) => {
    const x = point[0], y = point[1];
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) isInside = !isInside;
    }
    return isInside;
  };

  useEffect(() => {
    const fetchZones = async () => {
      const { data } = await supabase.from('geo_zones').select('*');
      if (data) setGeoZones(data);
    };
    fetchZones();

    const channel = supabase.channel('geo_zones_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'geo_zones' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setGeoZones(prev => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setGeoZones(prev => prev.map(z => z.id === payload.new.id ? payload.new : z));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let activeZone: {name: string, level: string} | null = null;
    let highestThreat = 0; // 1: GREEN, 2: YELLOW, 3: RED

    for (const zone of geoZones) {
      if (!zone.description.startsWith('{')) continue;
      try {
        const parsed = JSON.parse(zone.description);
        if (parsed.coordinates && parsed.coordinates.length >= 3) {
          if (isPointInPolygon(simulatedLocation, parsed.coordinates)) {
            let threatVal = zone.threat_level === 'RED' ? 3 : zone.threat_level === 'YELLOW' ? 2 : 1;
            if (threatVal > highestThreat) {
              highestThreat = threatVal;
              activeZone = { name: zone.name, level: zone.threat_level };
            }
          }
        }
      } catch (e) {}
    }
    setCurrentZone(activeZone);

    const redZoneName = activeZone?.level === 'RED' ? (activeZone as any).name : null;

    // Database Trigger (Only for RED restricted zones)
    if (redZoneName && !activeSosAlert && tourist?.id && !breachLock.current) {
      breachLock.current = true;
      const triggerBreachAlert = async () => {
        const { error } = await supabase.from('sos_alerts').insert({
          tourist_id: tourist.id,
          latitude: simulatedLocation[0],
          longitude: simulatedLocation[1],
          ai_severity_score: 8,
          incident_type: `[GEOFENCE_BREACH] ${redZoneName}`,
          status: 'active'
        });
        if (error) {
          console.error("Error creating breach alert", error);
          breachLock.current = false; // unlock on failure
        } else {
          if (setToastMessage) setToastMessage(`Breach alert logged for ${redZoneName}`);
        }
      };
      triggerBreachAlert();
    }

    if (!redZoneName && !activeSosAlert) {
      breachLock.current = false;
    }

  }, [simulatedLocation, geoZones, activeSosAlert, tourist]);

  const getZoneColor = (threat_level: string) => {
    if (threat_level === 'GREEN') return '#22c55e';
    if (threat_level === 'YELLOW') return '#f59e0b';
    return '#ef4444';
  };

  const handleDragEnd = (e: any) => {
    const marker = e.target;
    const position = marker.getLatLng();
    setSimulatedLocation([position.lat, position.lng]);
  };

  return (
    <div className="w-full h-full p-6 flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-3xl text-[#0a0a0a]">Live Geo-Fence Map</h2>
        <p className="text-sm font-mono text-[#0a0a0a]/50 uppercase tracking-widest">
          Interactive Territorial Simulation
        </p>
      </div>

      {/* Breach Alert Banner */}
      {currentZone?.level === 'RED' && (
        <div className="bg-red-500 text-white px-6 py-4 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.3)] flex items-center gap-4 animate-in slide-in-from-top-4">
          <AlertTriangle className="w-8 h-8 animate-pulse" />
          <div>
            <h3 className="font-bold text-lg uppercase tracking-widest">Restricted Zone Breach Detected</h3>
            <p className="font-mono text-sm">You have entered a restricted area: {currentZone.name}. Please evacuate immediately.</p>
          </div>
        </div>
      )}

      {/* Caution Alert Banner */}
      {currentZone?.level === 'YELLOW' && (
        <div className="bg-yellow-500 text-white px-6 py-4 rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.3)] flex items-center gap-4 animate-in slide-in-from-top-4">
          <AlertTriangle className="w-8 h-8" />
          <div>
            <h3 className="font-bold text-lg uppercase tracking-widest">Caution Zone Entered</h3>
            <p className="font-mono text-sm">You are in {currentZone.name}. Please exercise caution and stay alert.</p>
          </div>
        </div>
      )}
      
      {/* Map View */}
      <div className="flex-1 min-h-[600px] bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden flex flex-col relative z-0">
        <div className="absolute top-4 right-4 z-[400] flex gap-2">
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-sm border border-black/5 flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#0a0a0a]/50">Simulator Mode</span>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"/>
          </div>
        </div>

        {/* Floating ETA Badge */}
        {activeSosAlert?.status === 'dispatched' && (
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-[0_10px_40px_rgba(37,99,235,0.3)] border border-blue-500/20 flex flex-col items-center gap-1 z-[400] animate-in slide-in-from-top fade-in">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
              <span className="text-xs font-bold text-blue-900 uppercase tracking-widest">Rescue Unit Dispatched</span>
            </div>
            <div className="text-2xl font-serif text-[#0a0a0a]">Arriving in <span className="text-blue-600">~{activeEta} mins</span></div>
          </div>
        )}

        <MapContainer 
          center={simulatedLocation} 
          zoom={14} 
          style={{ width: '100%', height: '100%', zIndex: 0 }}
          zoomControl={false}
          attributionControl={false}
        >
          <MapResizer />
          <ChangeView center={simulatedLocation} zoom={14} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          
          {/* Tourist Location (Draggable Simulator) */}
          <Marker 
            position={simulatedLocation} 
            icon={createTouristDot()} 
            draggable={true}
            eventHandlers={{ dragend: handleDragEnd }}
          >
            <Popup>You (Draggable for Simulator)</Popup>
          </Marker>

          {/* Geo Zones */}
          {geoZones.map(zone => {
            try {
              if (!zone.description.startsWith('{')) return null;
              const parsed = JSON.parse(zone.description);
              if (!parsed.coordinates || parsed.coordinates.length < 3) return null;
              return (
                <Polygon 
                  key={zone.id} 
                  positions={parsed.coordinates} 
                  pathOptions={{ 
                    color: getZoneColor(zone.threat_level), 
                    fillColor: getZoneColor(zone.threat_level),
                    fillOpacity: 0.2,
                    weight: 2
                  }}
                />
              );
            } catch(e) { return null; }
          })}

          {/* If Dispatched, show Rescuer and Route */}
          {activeSosAlert?.status === 'dispatched' && (
            <>
              <Marker position={[simulatedLocation[0] - 0.015, simulatedLocation[1] - 0.015]} icon={createUnitDot()} />
              <Polyline 
                positions={[
                  [simulatedLocation[0] - 0.015, simulatedLocation[1] - 0.015],
                  simulatedLocation
                ]}
                color="#2563eb"
                weight={4}
                dashArray="10, 10"
                opacity={0.8}
              />
            </>
          )}
        </MapContainer>
        
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.1)] border border-black/5 flex items-center gap-2 z-[400]">
          <Shield className={cn("w-4 h-4", currentZone?.level === 'RED' ? "text-red-500" : currentZone?.level === 'YELLOW' ? "text-yellow-500" : "text-green-500")} />
          <span className="text-xs font-bold text-[#0a0a0a]">
            {currentZone?.level === 'RED' ? `CRITICAL: Inside ${currentZone.name}` : 
             currentZone?.level === 'YELLOW' ? `CAUTION: Inside ${currentZone.name}` : 
             "Green Zone: Safe"}
          </span>
        </div>
      </div>
    </div>
  );
}
