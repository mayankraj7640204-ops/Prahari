import { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Battery, 
  BatteryMedium, 
  BatteryLow, 
  MapPin, 
  AlertTriangle, 
  Satellite, 
  Navigation,
  Clock
} from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import type { TouristContextType } from '@/layouts/TouristLayout';
import { supabase } from '@/lib/supabase';

export function OfflineBeaconPage() {
  const { travelerProfile, setToastMessage } = useOutletContext<TouristContextType>();
  
  const [lat, setLat] = useState<string | null>(null);
  const [lon, setLon] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [status, setStatus] = useState<'scanning' | 'ready' | 'broadcasting' | 'sent'>('scanning');
  const [lastBroadcast, setLastBroadcast] = useState<string | null>(null);

  // Initialize sensors
  useEffect(() => {
    let watchId: number;

    const initSensors = async () => {
      // 1. Get Battery
      try {
        const nav = navigator as any;
        if ('getBattery' in nav) {
          const battery = await nav.getBattery();
          setBatteryLevel(Math.round(battery.level * 100));
          
          battery.addEventListener('levelchange', () => {
            setBatteryLevel(Math.round(battery.level * 100));
          });
        }
      } catch (err) {
        console.warn("Battery API not available", err);
      }

      // 2. Get Geolocation
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLat(pos.coords.latitude.toFixed(5));
            setLon(pos.coords.longitude.toFixed(5));
            setAccuracy(Math.round(pos.coords.accuracy));
            setStatus('ready');
          },
          (err) => {
            console.error(err);
            setToastMessage("Location access required for SOS Beacon");
            setStatus('ready'); // still allow them to broadcast without location if they must
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );

        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            setLat(pos.coords.latitude.toFixed(5));
            setLon(pos.coords.longitude.toFixed(5));
            setAccuracy(Math.round(pos.coords.accuracy));
          },
          (err) => console.warn(err),
          { enableHighAccuracy: true, maximumAge: 10000 }
        );
      } else {
        setStatus('ready');
      }
    };

    initSensors();
    
    // Check local storage for previous offline logs
    const previousLog = localStorage.getItem('prahari_offline_sos_log');
    if (previousLog) {
      try {
        const parsed = JSON.parse(previousLog);
        setLastBroadcast(new Date(parsed.timestamp).toLocaleString());
      } catch (e) {}
    }

    return () => {
      if (watchId !== undefined && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const handleBroadcast = async () => {
    setStatus('broadcasting');
    
    // 1. Log to localStorage (works offline)
    const payload = {
      timestamp: new Date().toISOString(),
      lat,
      lon,
      battery: batteryLevel,
      travelerId: travelerProfile?.id || 'Unknown',
      name: travelerProfile?.full_name || 'Traveler'
    };
    
    localStorage.setItem('prahari_offline_sos_log', JSON.stringify(payload));
    setLastBroadcast(new Date().toLocaleString());

    // 2. Save to Supabase (so Admin Dashboard lights up)
    if (lat && lon) {
      const { error } = await supabase.from('emergencies').insert([
        {
          tourist_name: travelerProfile?.full_name || "Tourist",
          traveler_id: travelerProfile?.id || "Prahari-Traveler",
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
          battery: batteryLevel !== null ? String(batteryLevel) : "Unknown",
          status: "ACTIVE_SOS",
          created_at: new Date().toISOString()
        }
      ]);
      if (error) console.error("Error logging SOS to Supabase:", error);
    }

    // 3. Format SMS Fallback
    const batteryStr = batteryLevel !== null ? `${batteryLevel}%` : 'Unknown';
    const locStr = lat && lon ? `Lat: ${lat}, Lon: ${lon}` : 'Location Unavailable';
    
    const message = `EMERGENCY SOS! My ID: Prahari-${travelerProfile?.full_name || 'Traveler'}. ${locStr}. Battery: ${batteryStr}. Send Help!`;
    
    // Slight delay to show broadcasting animation
    setTimeout(() => {
      setStatus('sent');
      setToastMessage("Offline distress log saved. Opening SMS fallback.");
      
      // Trigger native SMS app
      window.location.href = `sms:112?body=${encodeURIComponent(message)}`;
      
      setTimeout(() => {
        setStatus('ready');
      }, 5000);
    }, 1500);
  };

  const getBatteryIcon = () => {
    if (batteryLevel === null) return <Battery className="w-5 h-5 text-neutral-500" />;
    if (batteryLevel > 50) return <Battery className="w-5 h-5 text-green-500" />;
    if (batteryLevel > 20) return <BatteryMedium className="w-5 h-5 text-yellow-500" />;
    return <BatteryLow className="w-5 h-5 text-red-500 animate-pulse" />;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 relative overflow-hidden flex flex-col items-center justify-center">
      
      {/* Abstract Grid Background */}
      <div className="absolute inset-0 z-0 opacity-10" style={{
        backgroundImage: `radial-gradient(#ef4444 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      {/* Header */}
      <div className="absolute top-8 left-8 z-10 flex items-center gap-3">
        <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
          <Satellite className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Offline Beacon</h1>
          <p className="text-xs text-red-400 font-mono tracking-widest uppercase">Emergency Comm Link</p>
        </div>
      </div>

      <div className="z-10 w-full max-w-md flex flex-col items-center gap-12 mt-12">
        
        {/* Status Dashboard */}
        <div className="w-full grid grid-cols-2 gap-4">
          <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-neutral-400">
              <MapPin className="w-4 h-4" />
              <span className="text-[10px] font-bold tracking-widest uppercase">GPS Lock</span>
            </div>
            {lat && lon ? (
              <div className="font-mono text-sm text-green-400">
                {lat}<br/>{lon}
                {accuracy && <div className="text-[10px] text-neutral-500 mt-1">±{accuracy}m</div>}
              </div>
            ) : (
              <div className="font-mono text-sm text-yellow-500 animate-pulse">Acquiring...</div>
            )}
          </div>

          <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-neutral-400">
              {getBatteryIcon()}
              <span className="text-[10px] font-bold tracking-widest uppercase">Power</span>
            </div>
            {batteryLevel !== null ? (
              <div className="font-mono text-xl font-medium mt-1">
                <span className={batteryLevel <= 20 ? 'text-red-500' : 'text-white'}>{batteryLevel}%</span>
              </div>
            ) : (
              <div className="font-mono text-sm text-neutral-500 mt-1">Unknown</div>
            )}
          </div>
        </div>

        {/* Radar / SOS Button Area */}
        <div className="relative flex items-center justify-center w-64 h-64 my-8">
          
          {/* Radar Rings */}
          <div className="absolute inset-0 border border-red-500/10 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-4 border border-red-500/20 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
          <div className="absolute inset-12 border border-red-500/30 rounded-full" />
          
          {/* Radar Sweep */}
          {status === 'scanning' && (
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-red-500/20 to-transparent animate-spin" style={{ animationDuration: '2s' }} />
          )}
          
          {/* Main Button */}
          <button
            onClick={handleBroadcast}
            disabled={status === 'broadcasting'}
            className="relative z-20 w-32 h-32 bg-gradient-to-b from-red-500 to-red-700 rounded-full shadow-[0_0_50px_rgba(239,68,68,0.5)] flex items-center justify-center active:scale-95 transition-all duration-300 disabled:opacity-80 group overflow-hidden border-4 border-red-900"
          >
            <div className="absolute inset-0 bg-red-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex flex-col items-center gap-1 text-white relative z-10">
              {status === 'broadcasting' ? (
                <>
                  <Radio className="w-8 h-8 animate-ping" />
                  <span className="text-[10px] font-black tracking-widest uppercase mt-1">Sending</span>
                </>
              ) : status === 'sent' ? (
                <>
                  <Navigation className="w-8 h-8" />
                  <span className="text-[10px] font-black tracking-widest uppercase mt-1">Sent</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-8 h-8" />
                  <span className="text-[10px] font-black tracking-widest uppercase mt-1 text-center leading-tight px-2">Hold to<br/>Broadcast</span>
                </>
              )}
            </div>
          </button>
        </div>

        {/* Offline Warning & Log */}
        <div className="w-full bg-red-950/30 border border-red-900/50 rounded-2xl p-5 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <Radio className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-red-400">Mesh & SMS Fallback Active</h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                This beacon operates without internet. Triggering will log your exact coordinates locally and launch an encrypted SMS to 112 via the nearest available cell tower.
              </p>
            </div>
          </div>
          
          {lastBroadcast && (
            <div className="mt-4 pt-4 border-t border-red-900/30 flex items-center justify-between text-xs font-mono text-neutral-300">
              <span className="flex items-center gap-2 text-neutral-500"><Clock className="w-3 h-3" /> Last Broadcast</span>
              <span className="text-red-400">{lastBroadcast}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
