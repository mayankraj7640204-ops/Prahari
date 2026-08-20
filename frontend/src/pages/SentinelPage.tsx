import { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TouristContextType } from '@/layouts/TouristLayout';
import { GoogleGenAI } from '@google/genai';
import { Shield, AlertTriangle, Wind, Thermometer, MapPin, Square, Volume2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SentinelAlert {
  type: 'WEATHER' | 'TERRAIN' | 'SECURITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  message: string;
}

export function SentinelPage() {
  const { userLocation, locationName, setToastMessage } = useOutletContext<TouristContextType>();
  
  const [loading, setLoading] = useState(true);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [alerts, setAlerts] = useState<SentinelAlert[]>([]);
  const [audioScript, setAudioScript] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const fetchAttempted = useRef(false);

  useEffect(() => {
    // Wait until we have a valid location from context before running analysis
    if (locationName === 'Locating...' || fetchAttempted.current) return;
    
    fetchAttempted.current = true;
    runSentinelAnalysis();
  }, [locationName, userLocation]);

  const runSentinelAnalysis = async () => {
    setLoading(true);
    try {
      const [lat, lng] = userLocation;
      
      // 1. Fetch Weather
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
      if (!weatherRes.ok) throw new Error("Failed to fetch weather data");
      const weatherJson = await weatherRes.json();
      setWeatherData(weatherJson.current_weather);

      // 2. Run Gemini Threat Analysis
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const prompt = `You are the Prahari AI Incident Sentinel. Analyze the following real-time weather and location data for a tourist. 
      Location: ${locationName} (Lat: ${lat}, Lng: ${lng})
      Weather: ${JSON.stringify(weatherJson.current_weather)}
      
      Return ONLY a valid JSON object with the following structure:
      {
        "audio_script": "A short, highly playful, friendly, and conversational radio-host style briefing summarizing the situation in 2 sentences. DO NOT sound robotic.",
        "alerts": [
          { "type": "WEATHER" | "TERRAIN" | "SECURITY", "severity": "LOW" | "MEDIUM" | "HIGH", "title": "Short Title", "message": "Detailed 2-sentence advice." }
        ]
      }
      
      Generate 3 to 4 alert objects. Do not include markdown code blocks, just the raw JSON.`;

      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
      });

      let jsonStr = response.text || "{}";
      jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/gi, '').trim();
      
      const parsed = JSON.parse(jsonStr);
      setAudioScript(parsed.audio_script || "Hey there, ready for your trip? Looking good out there.");
      setAlerts(parsed.alerts || []);

    } catch (err: any) {
      console.error("Sentinel Analysis Failed", err);
      setToastMessage("AI Sentinel Connection Failed. Retrying later.");
      // Fallback
      setAlerts([
        {
          type: 'SECURITY',
          severity: 'LOW',
          title: 'System Offline',
          message: 'Unable to connect to AI Sentinel for live analysis. Please rely on local authorities.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch(severity) {
      case 'HIGH': return 'border-red-500/50 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)] text-red-500';
      case 'MEDIUM': return 'border-yellow-500/50 bg-yellow-500/5 shadow-[0_0_20px_rgba(234,179,8,0.1)] text-yellow-500';
      default: return 'border-blue-500/50 bg-blue-500/5 shadow-[0_0_20px_rgba(59,130,246,0.1)] text-blue-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch(severity) {
      case 'HIGH': return <AlertTriangle className="w-6 h-6 text-red-500" />;
      case 'MEDIUM': return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      default: return <Shield className="w-6 h-6 text-blue-500" />;
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup audio on unmount
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleAudio = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    if (alerts.length === 0 || !audioScript) return;

    const utterance = new SpeechSynthesisUtterance(audioScript);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  return (
    <div className="max-w-[1400px] mx-auto p-10 flex flex-col gap-8 min-h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="font-serif text-3xl text-[#0a0a0a]">Regional Intelligence Briefing</h2>
          <p className="text-sm font-mono text-[#0a0a0a]/50 uppercase tracking-widest">
            AI Sentinel Deep Analysis • Live Data Stream
          </p>
        </div>
        <button 
          onClick={toggleAudio}
          disabled={loading || alerts.length === 0}
          className={cn(
            "flex items-center gap-3 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest transition-all duration-300",
            isPlaying 
              ? "bg-[#0a0a0a] text-white shadow-[0_0_20px_rgba(0,0,0,0.2)]"
              : "bg-white border border-black/10 text-[#0a0a0a] hover:bg-black/5",
            (loading || alerts.length === 0) && "opacity-50 cursor-not-allowed"
          )}
        >
          {isPlaying ? (
            <>
              <Square className="w-4 h-4 fill-current animate-pulse text-red-500" />
              Stop Audio
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              Play Audio Briefing
            </>
          )}
        </button>
      </div>

      {/* Top Bar / Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#0a0a0a]/40 mb-1">Current Sector</div>
            <div className="font-sans text-lg font-bold text-[#0a0a0a] leading-tight">{locationName}</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
            <Thermometer className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#0a0a0a]/40 mb-1">Surface Temperature</div>
            <div className="font-sans text-2xl font-bold text-[#0a0a0a] leading-tight">
              {loading ? '--' : weatherData?.temperature}°C
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center">
            <Wind className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#0a0a0a]/40 mb-1">Wind Velocity</div>
            <div className="font-sans text-2xl font-bold text-[#0a0a0a] leading-tight">
              {loading ? '--' : weatherData?.windspeed} <span className="text-sm">km/h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-3xl border border-black/5 shadow-sm p-8 flex flex-col gap-6 relative overflow-hidden">
        
        {loading ? (
          // Premium Shimmer Skeleton
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center animate-in fade-in duration-500">
            <div className="w-16 h-16 border-2 border-black/10 border-t-black rounded-full animate-spin mb-6" />
            <h3 className="font-serif text-xl text-[#0a0a0a] mb-2">Establishing secure connection to AI Sentinel...</h3>
            <p className="font-mono text-xs uppercase tracking-widest text-[#0a0a0a]/40 animate-pulse">Analyzing regional data packets</p>
          </div>
        ) : null}

        <div className="flex items-center gap-3 border-b border-black/5 pb-4">
          <Shield className="w-5 h-5 text-[#0a0a0a]" />
          <h3 className="font-serif text-xl text-[#0a0a0a]">Active Threat Assessment</h3>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {alerts.map((alert, idx) => (
            <div 
              key={idx} 
              className={cn(
                "p-6 rounded-2xl border flex flex-col md:flex-row gap-6 items-start animate-in slide-in-from-bottom fade-in duration-700",
                getSeverityStyles(alert.severity)
              )}
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              <div className="shrink-0 p-3 bg-white rounded-xl shadow-sm">
                {getSeverityIcon(alert.severity)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-white shadow-sm text-black">
                    {alert.type}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-black text-white">
                    {alert.severity} RISK
                  </span>
                </div>
                <h4 className="font-sans text-xl font-bold text-[#0a0a0a] mb-2">{alert.title}</h4>
                <p className="text-[#0a0a0a]/70 text-sm leading-relaxed font-medium">
                  {alert.message}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
