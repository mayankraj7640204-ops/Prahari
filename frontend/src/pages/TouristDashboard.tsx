import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TouristContextType } from '@/layouts/TouristLayout';
import { 
  Shield, Activity, AlertTriangle, FileText, Navigation, 
  Wifi, QrCode, CloudSun, BookOpen, CheckCircle
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
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
}

export function TouristDashboard() {
  const { 
    permits, 
    activeSosAlert, 
    activeEta, 
    userLocation, 
    setEnlargedPermit 
  } = useOutletContext<TouristContextType>();

  return (
    <div className="max-w-[1400px] mx-auto p-10 flex flex-col gap-8">
      
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
          <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between z-10 bg-white">
            <h3 className="font-serif text-lg text-[#0a0a0a]">Live Region Map</h3>
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#0a0a0a]/40 bg-[#0a0a0a]/5 px-3 py-1 rounded-full flex items-center gap-2">GPS Synced <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/></span>
          </div>
          <div className="flex-1 relative z-0">
            {/* Floating ETA Badge */}
            {activeSosAlert?.status === 'dispatched' && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-[0_10px_40px_rgba(37,99,235,0.3)] border border-blue-500/20 flex flex-col items-center gap-1 z-[400] min-w-[280px] animate-in slide-in-from-top fade-in">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-widest">Rescue Unit Dispatched</span>
                </div>
                <div className="text-2xl font-serif text-[#0a0a0a]">Arriving in <span className="text-blue-600">~{activeEta} mins</span></div>
              </div>
            )}

            <MapContainer 
              center={userLocation} 
              zoom={14} 
              style={{ width: '100%', height: '100%', zIndex: 0 }}
              zoomControl={false}
              attributionControl={false}
            >
              <MapResizer />
              <ChangeView center={userLocation} zoom={14} />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              
              {/* Tourist Location */}
              <Marker position={userLocation} icon={createTouristDot()} />

              {/* If Dispatched, show Rescuer and Route */}
              {activeSosAlert?.status === 'dispatched' && (
                <>
                  <Marker position={[userLocation[0] - 0.015, userLocation[1] - 0.015]} icon={createUnitDot()} />
                  <Polyline 
                    positions={[
                      [userLocation[0] - 0.015, userLocation[1] - 0.015],
                      userLocation
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
              <Shield className="w-4 h-4 text-green-500" />
              <span className="text-xs font-bold text-[#0a0a0a]">Green Zone: Sector A</span>
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
