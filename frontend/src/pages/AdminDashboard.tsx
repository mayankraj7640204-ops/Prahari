import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Globe, Users, AlertOctagon, FileCheck, ShieldAlert, Crosshair, Check, Power, Shield, ScanLine, Scan, X } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const createTouristIcon = (score: number) => L.divIcon({
  className: 'bg-transparent border-0',
  html: `<div class="relative"><div class="w-12 h-12 border border-red-500 rounded-full animate-ping absolute -top-5 -left-5"></div><div class="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_rgba(220,38,38,1)]"></div><div class="absolute top-3 left-3 bg-red-950/80 border border-red-500/50 px-2 py-1 font-mono text-[9px] text-red-300 whitespace-nowrap">SOS: ${score}</div></div>`,
  iconSize: [8, 8],
  iconAnchor: [4, 4]
});

const createUnitIcon = (unitName: string, eta: number) => L.divIcon({
  className: 'bg-transparent border-0',
  html: `<div class="relative"><div class="w-8 h-8 bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.8)] flex items-center justify-center border-2 border-white animate-bounce"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div><div class="absolute top-8 left-1/2 -translate-x-1/2 bg-blue-950/90 border border-blue-500/50 px-2 py-1 font-mono text-[9px] text-blue-300 whitespace-nowrap z-30 mt-1"><div class="font-bold">${unitName}</div><div>ETA: ${Math.max(1, Math.floor(eta))} mins</div></div></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Component to fix Map resizing bugs
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

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== 0) {
      map.flyTo(center, zoom, { animate: true, duration: 1.5 });
    }
  }, [center, map, zoom]);
  return null;
}

export function AdminDashboard() {
  const [stats, setStats] = useState({ tourists: 0, sos: 0, ilp: 0 });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [permits, setPermits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeScanHash, setActiveScanHash] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Advanced Dispatch States
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedAlertForDispatch, setSelectedAlertForDispatch] = useState<any>(null);
  const [activeDispatches, setActiveDispatches] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    
    const sosChannel = supabase.channel('admin-sos-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sosChannel);
    };
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (activeDispatches.length === 0) return;
    const interval = setInterval(() => {
      setActiveDispatches(prev => prev.map(d => {
        // Move slightly towards target
        const dLat = d.targetLat - d.lat;
        const dLng = d.targetLng - d.lng;
        return {
          ...d,
          lat: d.lat + (dLat * 0.05),
          lng: d.lng + (dLng * 0.05),
          eta: Math.max(1, d.eta - 0.2)
        };
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [activeDispatches]);

  const fetchData = async () => {
    try {
      // Fetch stats
      const { count: touristCount } = await supabase.from('tourists').select('*', { count: 'exact', head: true });
      const { count: sosCount } = await supabase.from('sos_alerts').select('*', { count: 'exact', head: true }).neq('status', 'resolved');
      const { count: ilpCount } = await supabase.from('ilp_permits').select('*', { count: 'exact', head: true }).eq('status', 'pending');

      setStats({
        tourists: touristCount || 0,
        sos: sosCount || 0,
        ilp: ilpCount || 0
      });

      // Fetch Alerts
      const { data: alertsData } = await supabase
        .from('sos_alerts')
        .select('*, tourists(full_name, phone)')
        .neq('status', 'resolved')
        .order('created_at', { ascending: false })
        .order('ai_severity_score', { ascending: false });
      
      const uniqueAlerts = Array.from(new Map((alertsData || []).map((item: any) => [item.id, item])).values());
      setAlerts(uniqueAlerts);

      // Rehydrate active trackers for already dispatched units
      setActiveDispatches(prev => {
        const newDispatches = [...prev];
        for (const alert of uniqueAlerts) {
          if (alert.status === 'dispatched' && !newDispatches.some(d => d.alertId === alert.id)) {
            const match = alert.incident_type?.match(/\[DISPATCHED:(\d+)\]/);
            const start = match ? parseInt(match[1], 10) : new Date(alert.created_at).getTime();
            const initialEta = Math.max(1, 15 - ((Date.now() - start) / 60000));

            newDispatches.push({
              alertId: alert.id,
              unitName: 'RESCUE UNIT',
              lat: alert.latitude - 0.015,
              lng: alert.longitude - 0.015,
              targetLat: alert.latitude,
              targetLng: alert.longitude,
              eta: initialEta
            });
          }
        }
        return newDispatches;
      });

      // Fetch Permits
      const { data: permitsData } = await supabase
        .from('ilp_permits')
        .select('*, tourists(full_name), geo_zones(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      setPermits(permitsData || []);
    } catch (err) {
      console.error('Error fetching admin data', err);
    } finally {
      setLoading(false);
    }
  };

  const dispatchUnit = (alert: any) => {
    setSelectedAlertForDispatch(alert);
    setIsDispatchModalOpen(true);
  };

  const confirmDispatch = async (unitName: string) => {
    if (!selectedAlertForDispatch) return;
    const alertId = selectedAlertForDispatch.id;
    try {
      const dispatchTimestamp = Date.now();
      const updatedIncident = `${selectedAlertForDispatch.incident_type} [DISPATCHED:${dispatchTimestamp}]`;
      const { error } = await supabase.from('sos_alerts').update({ 
        status: 'dispatched',
        incident_type: updatedIncident 
      }).eq('id', alertId);
      
      if (error) {
        console.error('Failed to dispatch unit', error);
        setToastMessage(`Dispatch Failed: ${error.message}`);
        return;
      }
      
      // Add to simulated active dispatches
      setActiveDispatches(prev => [...prev, {
        alertId,
        unitName,
        lat: selectedAlertForDispatch.latitude - 0.015,
        lng: selectedAlertForDispatch.longitude - 0.015,
        targetLat: selectedAlertForDispatch.latitude,
        targetLng: selectedAlertForDispatch.longitude,
        eta: 15
      }]);
      
      setToastMessage(`Unit ${unitName} dispatched successfully.`);
    } catch (err: any) {
      console.error('Failed to dispatch unit', err);
      setToastMessage(`Dispatch Error: ${err.message || String(err)}`);
    } finally {
      setIsDispatchModalOpen(false);
      setSelectedAlertForDispatch(null);
    }
  };

  const resolveSOS = async (id: string) => {
    try {
      const { error } = await supabase.from('sos_alerts').update({ status: 'resolved' }).eq('id', id);
      if (error) {
        console.error('Failed to resolve SOS', error);
        setToastMessage(`Resolve Failed: ${error.message}`);
        return;
      }
      setActiveDispatches(prev => prev.filter(d => d.alertId !== id));
      setAlerts(prev => prev.filter(a => a.id !== id));
      setToastMessage("Incident marked as resolved.");
    } catch (err: any) {
      console.error('Failed to resolve SOS', err);
      setToastMessage(`Resolve Error: ${err.message || String(err)}`);
    }
  };



  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleScan = async (result: string) => {
    try {
      if (result !== activeScanHash) {
        setScanError("MISMATCHED PERMIT / FORGERY DETECTED");
        setScannedData(null);
        return;
      }

      const { data, error } = await supabase
        .from('ilp_permits')
        .select('*, tourists(full_name), geo_zones(name)')
        .eq('blockchain_hash', result)
        .single();

      if (error || !data) {
        setScanError("INVALID ID / FORGERY DETECTED");
        setScannedData(null);
      } else {
        setScanError(null);
        setScannedData(data);
      }
    } catch (err) {
      setScanError("INVALID ID / FORGERY DETECTED");
      setScannedData(null);
    }
  };

  const confirmAndApprove = async () => {
    if (!scannedData) return;
    try {
      await supabase.from('ilp_permits').update({ status: 'approved' }).eq('id', scannedData.id);
      setActiveScanHash(null);
      setScannedData(null);
      fetchData();
    } catch (err) {
      console.error('Failed to approve pass', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-[#e0e0e0] font-sans selection:bg-white/30 flex flex-col relative overflow-hidden">
      
      {/* Top Bar */}
      <header className="relative z-10 border-b border-white/20 bg-[#0a0a0a] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Prahari Logo" className="w-8 h-10 object-contain invert brightness-0" />
            <div className="flex flex-col">
              <span className="font-display text-xl text-white leading-none tracking-tight">Prahari</span>
              <span className="text-[10px] tracking-[0.2em] uppercase text-[#d4af37] mt-1">Command Center</span>
            </div>
          </div>
          
          <div className="hidden md:flex h-8 w-px bg-white/10 mx-2" />
          
          <div className="hidden md:flex items-center gap-3 px-4 py-1.5 bg-black border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.05)]">
            <Globe className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-mono tracking-widest uppercase text-white/80">ALL SECTORS ONLINE</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-950/30 border border-red-500/50">
            <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest text-red-500 uppercase">{stats.sos} Active SOS</span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center w-8 h-8 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            title="Disconnect Terminal"
          >
            <Power className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="relative z-10 flex-1 w-full max-w-[1800px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Macro Map & Metrics (Top/Center) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MacroMetric title="Total Active Tourists" value={stats.tourists.toString()} icon={<Users className="w-5 h-5 text-white/50" />} />
            <MacroMetric title="Active SOS Pings" value={stats.sos.toString()} icon={<AlertOctagon className={cn("w-5 h-5", stats.sos > 0 ? "text-red-500 animate-pulse" : "text-white/50")} />} highlight={stats.sos > 0 ? "border-t-red-500" : "border-t-white/10"} />
            <MacroMetric title="Pending ILP Approvals" value={stats.ilp.toString()} icon={<FileCheck className="w-5 h-5 text-yellow-500" />} highlight="border-t-yellow-500" />
          </div>

          {/* Macro Map */}
          <div className="flex-1 min-h-[400px] lg:min-h-[500px] bg-[#050505] border border-white/20 relative overflow-hidden flex flex-col z-0">
            <div className="absolute top-4 left-4 z-[400] px-4 py-2 bg-black border border-white/20 font-sans text-xs font-semibold text-white tracking-[0.15em] uppercase">
              NER Sector Map
            </div>
            
            <MapContainer 
              center={alerts.length > 0 ? [alerts[0].latitude, alerts[0].longitude] : [25.5788, 91.8933]} 
              zoom={7} 
              style={{ width: '100%', height: '100%', zIndex: 0 }}
              zoomControl={false}
              attributionControl={false}
            >
              <MapResizer />
              <ChangeView center={alerts.length > 0 ? [alerts[0].latitude, alerts[0].longitude] : [25.5788, 91.8933]} zoom={alerts.length > 0 ? 12 : 7} />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              />
              
              {/* Plot SOS Alerts */}
              {alerts.map((alert) => (
                <Marker 
                  key={alert.id} 
                  position={[alert.latitude, alert.longitude]} 
                  icon={createTouristIcon(alert.ai_severity_score)}
                >
                  <Popup className="custom-popup">
                    <div className="font-mono text-xs">
                      <strong>Tourist:</strong> {alert.tourists?.full_name || 'Unknown'}<br/>
                      <strong>Score:</strong> {alert.ai_severity_score}/10
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Plot Dispatched Units and Polylines */}
              {activeDispatches.map((dispatch) => (
                <div key={`dispatch-group-${dispatch.alertId}`}>
                  <Marker 
                    position={[dispatch.lat, dispatch.lng]} 
                    icon={createUnitIcon(dispatch.unitName, dispatch.eta)}
                  />
                  <Polyline 
                    positions={[
                      [dispatch.lat, dispatch.lng],
                      [dispatch.targetLat, dispatch.targetLng]
                    ]}
                    color="#2563eb"
                    weight={4}
                    dashArray="10, 10"
                    opacity={0.7}
                  />
                </div>
              ))}
            </MapContainer>
          </div>

        </div>

        {/* Right Column (Tables & Queues) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Incident Table */}
          <div className="flex-1 bg-[#050505] border border-white/20 flex flex-col min-h-[300px]">
            <div className="border-b border-white/20 px-5 py-4 flex items-center justify-between bg-[#0a0a0a]">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-red-500" />
                <h3 className="font-sans text-xs font-bold tracking-[0.15em] uppercase text-white">Active Incidents</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {alerts.length === 0 ? (
                <EmptyState icon={<Shield className="w-6 h-6" />} msg="No Active Incidents" />
              ) : (
                alerts.map(alert => {
                  const isDispatched = alert.status === 'dispatched';
                  const timeAgo = Math.floor((Date.now() - new Date(alert.created_at).getTime()) / 60000);
                  
                  const nameMatch = alert.incident_type?.match(/\[NAME: (.*?)\]/);
                  const displayTouristName = nameMatch ? nameMatch[1] : (alert.tourists?.full_name || 'Unknown');
                  const displayIncidentType = alert.incident_type?.replace(/\[NAME: .*?\]\s*/, '') || alert.incident_type;
                  
                  return (
                  <div key={alert.id} className={cn("border p-4 transition-colors", isDispatched ? "border-yellow-500/50 bg-yellow-950/10" : "border-red-500/30 bg-red-950/10")}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn("font-mono text-[10px] tracking-wider", isDispatched ? "text-yellow-400" : "text-red-400")}>
                            {isDispatched ? 'UNIT EN ROUTE' : `SCORE: ${alert.ai_severity_score}/10`}
                          </div>
                          <div className="font-mono text-[9px] text-white/40">{timeAgo === 0 ? 'Just now' : `${timeAgo}m ago`}</div>
                        </div>
                        <div className="font-sans text-sm font-bold text-white uppercase">{displayTouristName}</div>
                        <div className="font-mono text-[10px] text-white/60 mt-1 flex items-center gap-2">
                          <span>Phone: {alert.tourists?.phone || 'N/A'}</span>
                        </div>
                      </div>
                      <div className={cn("px-2 py-1 font-mono text-[9px] uppercase border", isDispatched ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400" : "bg-red-500/20 border-red-500/50 text-red-400")}>
                        {displayIncidentType}
                      </div>
                    </div>
                    <div className={cn("flex items-center justify-between mt-4 pt-3 border-t", isDispatched ? "border-yellow-500/20" : "border-red-500/20")}>
                      <a 
                        href={`https://maps.google.com/?q=${alert.latitude},${alert.longitude}`}
                        target="_blank" rel="noreferrer"
                        className="font-mono text-[9px] text-blue-400 hover:text-blue-300 underline"
                      >
                        {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                      </a>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => resolveSOS(alert.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0a0a] border border-white/20 hover:border-white/50 transition-colors font-sans text-[10px] font-bold uppercase tracking-widest text-white"
                        >
                          Resolve
                        </button>
                        {isDispatched ? (
                          <button 
                            disabled
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 border border-yellow-500/30 cursor-not-allowed font-sans text-[10px] font-bold uppercase tracking-widest text-yellow-500/50"
                          >
                            <Check className="w-3 h-3" />
                            Deployed
                          </button>
                        ) : (
                          <button 
                            onClick={() => dispatchUnit(alert)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 transition-colors font-sans text-[10px] font-bold uppercase tracking-widest text-white"
                          >
                            <Crosshair className="w-3 h-3" />
                            Dispatch
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )})
              )}
            </div>
          </div>

          {/* Verification Queue */}
          <div className="flex-1 bg-[#050505] border border-white/20 flex flex-col min-h-[300px]">
            <div className="border-b border-white/20 px-5 py-4 flex items-center justify-between bg-[#0a0a0a]">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-yellow-500" />
                <h3 className="font-sans text-xs font-bold tracking-[0.15em] uppercase text-white">ILP Verification</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {permits.length === 0 ? (
                <EmptyState icon={<FileCheck className="w-6 h-6" />} msg="No Pending Approvals" />
              ) : (
                permits.map(permit => (
                  <div key={permit.id} className="border border-white/10 bg-[#0a0a0a] p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-sans text-sm font-bold text-white uppercase">{permit.tourists?.full_name || 'Unknown'}</div>
                      <div className="font-mono text-[9px] text-yellow-500 uppercase tracking-widest">Pending</div>
                    </div>
                    <div className="font-sans text-[11px] text-white/50 mb-4 uppercase tracking-wide">
                      Zone: {permit.geo_zones?.name || 'Unknown'}
                    </div>
                    <div className="flex justify-end mt-2 border-t border-white/10 pt-3">
                      <button 
                        onClick={() => setActiveScanHash(permit.blockchain_hash)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0a0a] border border-white/20 hover:border-white/50 transition-all font-mono text-[10px] font-bold uppercase tracking-widest text-white"
                      >
                        <ScanLine className="w-3.5 h-3.5" />
                        Scan To Verify
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Scanner Modal HUD */}
      {activeScanHash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          
          <div className="relative w-full max-w-2xl bg-black border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)] p-1 overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-500" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-500" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-500" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-500" />
            
            <div className="flex items-center justify-between p-4 border-b border-green-500/20 bg-green-950/20">
              <div className="flex items-center gap-2">
                <Scan className="w-5 h-5 text-green-400" />
                <h2 className="font-mono text-sm tracking-[0.2em] text-green-400">SECURE VERIFICATION TERMINAL</h2>
              </div>
              <button onClick={() => { setActiveScanHash(null); setScannedData(null); setScanError(null); }} className="text-green-500/50 hover:text-green-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 relative min-h-[400px] flex flex-col items-center justify-center">
              
              {!scannedData && !scanError && (
                <div className="w-full max-w-sm aspect-square relative">
                   <div className="absolute -inset-4 border border-green-500/20 animate-pulse pointer-events-none" />
                   <Scanner onScan={(result) => handleScan(result[0].rawValue)} />
                   <div className="mt-8 text-center font-mono text-xs tracking-widest text-green-400 animate-pulse">
                     AWAITING TOURIST QR CODE...
                   </div>
                </div>
              )}

              {scanError && (
                 <div className="flex flex-col items-center justify-center gap-4 animate-in zoom-in fade-in duration-300">
                    <ShieldAlert className="w-20 h-20 text-red-600 animate-pulse" />
                    <h2 className="font-mono text-3xl font-bold tracking-widest text-red-600 text-center">FORGERY DETECTED</h2>
                    <p className="font-mono text-red-500/60 uppercase tracking-widest">Invalid Hash Signature. Detain subject.</p>
                    <button onClick={() => setScanError(null)} className="mt-8 px-6 py-2 border border-red-500/50 text-red-500 font-mono text-xs tracking-widest hover:bg-red-950/30">
                      RE-SCAN
                    </button>
                 </div>
              )}

              {scannedData && (
                 <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-green-500/20">
                      <Check className="w-6 h-6 text-green-400" />
                      <div>
                        <div className="font-mono text-green-400 text-lg tracking-widest">SIGNATURE MATCH FOUND</div>
                        <div className="font-mono text-xs text-green-500/50 truncate w-full max-w-[400px]">HASH: {scannedData.blockchain_hash}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="p-3 bg-green-950/20 border border-green-500/20">
                        <div className="font-mono text-[9px] text-green-500/50 tracking-widest mb-1">TOURIST NAME</div>
                        <div className="font-sans text-sm font-bold text-white uppercase">{scannedData.tourists?.full_name}</div>
                      </div>
                      <div className="p-3 bg-green-950/20 border border-green-500/20">
                        <div className="font-mono text-[9px] text-green-500/50 tracking-widest mb-1">PASSPORT NUMBER</div>
                        <div className="font-sans text-sm font-bold text-white uppercase">{scannedData.notes?.match(/Passport:\s*([^,]+)/)?.[1] || 'N/A'}</div>
                      </div>
                      <div className="p-3 bg-green-950/20 border border-green-500/20">
                        <div className="font-mono text-[9px] text-green-500/50 tracking-widest mb-1">ZONE REQUESTED</div>
                        <div className="font-sans text-sm font-bold text-white uppercase">{scannedData.geo_zones?.name}</div>
                      </div>
                      <div className="p-3 bg-green-950/20 border border-green-500/20">
                        <div className="font-mono text-[9px] text-green-500/50 tracking-widest mb-1">HOTEL</div>
                        <div className="font-sans text-sm font-bold text-white uppercase">{scannedData.notes?.match(/Hotel:\s*(.+)$/)?.[1] || 'N/A'}</div>
                      </div>
                      <div className="col-span-2 p-3 bg-green-950/20 border border-green-500/20">
                        <div className="font-mono text-[9px] text-green-500/50 tracking-widest mb-1">VALIDITY DATES</div>
                        <div className="font-sans text-sm font-bold text-white uppercase">{new Date(scannedData.valid_from).toLocaleDateString()} - {new Date(scannedData.valid_until).toLocaleDateString()}</div>
                      </div>
                    </div>

                    <button 
                      onClick={confirmAndApprove}
                      className="w-full py-4 bg-green-600 hover:bg-green-500 text-black font-mono text-sm font-bold tracking-[0.2em] transition-colors"
                    >
                      CONFIRM & APPROVE PASS
                    </button>
                 </div>
              )}
              
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {isDispatchModalOpen && selectedAlertForDispatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-[#050505] border border-red-500/30 p-6 md:p-8 w-full max-w-lg relative animate-in zoom-in-95 shadow-[0_0_50px_rgba(220,38,38,0.1)]">
            <button 
              onClick={() => { setIsDispatchModalOpen(false); setSelectedAlertForDispatch(null); }}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-6 border-b border-red-500/20 pb-4">
              <Crosshair className="w-6 h-6 text-red-500" />
              <h2 className="font-sans font-bold text-lg text-white uppercase tracking-widest">Select Dispatch Unit</h2>
            </div>
            
            <div className="space-y-3">
              <button onClick={() => confirmDispatch('Local City Police Patrol')} className="w-full text-left p-4 border border-white/10 hover:border-red-500/50 bg-[#0a0a0a] hover:bg-red-500/10 transition-colors flex justify-between items-center group">
                <span className="font-mono text-sm text-white uppercase">Local City Police Patrol</span>
                <span className="font-mono text-[10px] text-red-500/50 group-hover:text-red-500 tracking-widest uppercase">Available</span>
              </button>
              <button onClick={() => confirmDispatch('Rapid Medical Responders')} className="w-full text-left p-4 border border-white/10 hover:border-red-500/50 bg-[#0a0a0a] hover:bg-red-500/10 transition-colors flex justify-between items-center group">
                <span className="font-mono text-sm text-white uppercase">Rapid Medical Responders</span>
                <span className="font-mono text-[10px] text-red-500/50 group-hover:text-red-500 tracking-widest uppercase">Available</span>
              </button>
              <button onClick={() => confirmDispatch('Highway Safety Crew')} className="w-full text-left p-4 border border-white/10 hover:border-red-500/50 bg-[#0a0a0a] hover:bg-red-500/10 transition-colors flex justify-between items-center group">
                <span className="font-mono text-sm text-white uppercase">Highway Safety Crew</span>
                <span className="font-mono text-[10px] text-yellow-500 tracking-widest uppercase">Fastest ETA</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-[#0a0a0a] border border-white/20 text-white px-6 py-3 shadow-2xl z-[200] font-mono text-xs tracking-widest uppercase flex items-center gap-3">
          <AlertOctagon className="w-4 h-4 text-red-500" />
          {toastMessage}
        </div>
      )}

    </div>
  );
}

function MacroMetric({ title, value, icon, highlight = "border-t-white/20" }: { title: string, value: string, icon: React.ReactNode, highlight?: string }) {
  return (
    <div className={cn("bg-[#050505] border border-white/20 p-6 flex flex-col gap-4 relative overflow-hidden border-t-2", highlight)}>
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs font-bold tracking-[0.15em] uppercase text-white/60">{title}</span>
        {icon}
      </div>
      <div className="font-display text-4xl text-white tracking-tight">{value}</div>
    </div>
  );
}

function EmptyState({ icon, msg }: { icon: React.ReactNode, msg: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-white/20 gap-3">
      {icon}
      <span className="font-sans text-[10px] font-semibold tracking-widest uppercase">{msg}</span>
    </div>
  );
}
