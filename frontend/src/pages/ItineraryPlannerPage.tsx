import { useState, useEffect } from 'react';
import { Compass, Calendar, MapPin, CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles, AlertTriangle, Plane } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ItineraryDay {
  day: number;
  theme: string;
  activities: string[];
}

interface ChecklistItem {
  id: string;
  item: string;
  context: string;
}

export function ItineraryPlannerPage() {
  const [destination, setDestination] = useState(() => sessionStorage.getItem('itinerary_dest') || '');
  const [days, setDays] = useState(() => Number(sessionStorage.getItem('itinerary_days')) || 7);
  const [preferences, setPreferences] = useState(() => sessionStorage.getItem('itinerary_prefs') || '');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [itinerary, setItinerary] = useState<ItineraryDay[]>(() => JSON.parse(sessionStorage.getItem('itinerary_data') || '[]'));
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => JSON.parse(sessionStorage.getItem('itinerary_checklist') || '[]'));
  const [completedItems, setCompletedItems] = useState<Set<string>>(() => new Set(JSON.parse(sessionStorage.getItem('itinerary_completed') || '[]')));
  const [expandedDays, setExpandedDays] = useState<Set<number>>(() => new Set(JSON.parse(sessionStorage.getItem('itinerary_expanded') || '[1]'))); // Default expand day 1
  const [flightAdvice, setFlightAdvice] = useState<string | null>(() => sessionStorage.getItem('itinerary_flight') || null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { sessionStorage.setItem('itinerary_dest', destination); }, [destination]);
  useEffect(() => { sessionStorage.setItem('itinerary_days', String(days)); }, [days]);
  useEffect(() => { sessionStorage.setItem('itinerary_prefs', preferences); }, [preferences]);
  useEffect(() => { sessionStorage.setItem('itinerary_data', JSON.stringify(itinerary)); }, [itinerary]);
  useEffect(() => { sessionStorage.setItem('itinerary_checklist', JSON.stringify(checklist)); }, [checklist]);
  useEffect(() => { sessionStorage.setItem('itinerary_completed', JSON.stringify(Array.from(completedItems))); }, [completedItems]);
  useEffect(() => { sessionStorage.setItem('itinerary_expanded', JSON.stringify(Array.from(expandedDays))); }, [expandedDays]);
  useEffect(() => { 
    if (flightAdvice) sessionStorage.setItem('itinerary_flight', flightAdvice); 
    else sessionStorage.removeItem('itinerary_flight'); 
  }, [flightAdvice]);

  const handleGenerate = async () => {
    if (!destination.trim()) {
      setError("Please enter a destination.");
      return;
    }
    
    setError(null);
    setIsGenerating(true);
    setItinerary([]);
    setChecklist([]);
    setFlightAdvice(null);
    setCompletedItems(new Set());
    setExpandedDays(new Set([1]));
    
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      
      const prompt = `You are a fast travel AI. User travels FROM Ranchi, India TO ${destination} for ${days} days. Prefs: ${preferences || 'general'}. 
Return ONLY a valid JSON object with THREE keys:
1. 'itinerary': Array [{ "day": 1, "theme": "Short title", "activities": ["Short act 1", "Short act 2"] }]. KEEP ACTIVITIES EXTREMELY CONCISE (under 10 words). Max 3 activities per day.
2. 'checklist': Array [{ "id": "uuid1", "item": "Item", "context": "Brief reason" }]. LIMIT TO EXACTLY 5 HIGH-PRIORITY ITEMS to save generation time.
3. 'flight_advice': 1 short sentence on best flight route from Ranchi.
Do not use markdown blocks. OUTPUT RAW JSON ONLY. BE AS CONCISE AS POSSIBLE to maximize speed.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      });

      let jsonStr = response.text || '';
      jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      const data = JSON.parse(jsonStr);
      
      if (data.itinerary && data.checklist) {
        setItinerary(data.itinerary);
        setChecklist(data.checklist);
        if (data.flight_advice) setFlightAdvice(data.flight_advice);
      } else {
        throw new Error("Invalid response format from AI.");
      }
      
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      setError("Failed to generate itinerary. Please try again. " + (err.message || ""));
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleChecklistItem = (id: string) => {
    setCompletedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleDayAccordion = (dayNum: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNum)) {
        next.delete(dayNum);
      } else {
        next.add(dayNum);
      }
      return next;
    });
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10 text-neutral-900 selection:bg-neutral-900/10">
      
      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        
        {/* Header Area */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#0a0a0a] border border-[#0a0a0a]/10 rounded-2xl flex items-center justify-center">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#0a0a0a]">AI Itinerary Planner</h1>
            <p className="text-[#0a0a0a]/60 text-sm mt-1 font-medium">Smart Travel Logistics & Automated Scheduling</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Control Panel */}
        <div className="bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-3xl shadow-2xl flex flex-col md:flex-row gap-6 items-end text-white">
          
          <div className="w-full md:flex-1 space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 ml-1">Destination</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input 
                type="text" 
                value={destination}
                onChange={e => setDestination(e.target.value)}
                placeholder="e.g., Kyoto, Japan" 
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all placeholder:text-white/20"
              />
            </div>
          </div>

          <div className="w-full md:w-32 space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 ml-1">Duration</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input 
                type="number" 
                min={1}
                max={30}
                value={days}
                onChange={e => setDays(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
              />
            </div>
          </div>

          <div className="w-full md:flex-[1.5] space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 ml-1">Preferences</label>
            <input 
              type="text" 
              value={preferences}
              onChange={e => setPreferences(e.target.value)}
              placeholder="e.g., Hidden cafes, scenic hikes, historical sites" 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-sm font-medium focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all placeholder:text-white/20"
            />
          </div>

          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !destination}
            className="w-full md:w-auto h-[54px] px-8 bg-white text-black rounded-2xl font-bold text-sm hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Itinerary</span>
              </>
            )}
          </button>
        </div>

        {/* Loading Shimmer State */}
        {isGenerating && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8 animate-pulse">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-20 bg-white/5 rounded-2xl" />
              <div className="h-20 bg-white/5 rounded-2xl" />
              <div className="h-20 bg-white/5 rounded-2xl" />
            </div>
            <div className="space-y-4">
              <div className="h-32 bg-white/5 rounded-2xl" />
              <div className="h-24 bg-white/5 rounded-2xl" />
              <div className="h-24 bg-white/5 rounded-2xl" />
            </div>
          </div>
        )}

        {/* Main Content Layout */}
        {!isGenerating && itinerary.length > 0 && (
          <div className="flex flex-col gap-8 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* Flight Logistics Banner */}
            {flightAdvice && (
              <div className="bg-[#0a0a0a]/5 border border-[#0a0a0a]/10 p-6 rounded-3xl flex flex-col md:flex-row items-center gap-6">
                <div className="w-12 h-12 bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Plane className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-xl text-[#0a0a0a] mb-1">Flight Logistics from Ranchi</h3>
                  <p className="text-sm text-[#0a0a0a]/70 font-medium leading-relaxed">{flightAdvice}</p>
                </div>
                <a 
                  href="https://www.skyscanner.co.in/?locale=en-GB&gclsrc=aw.ds&&utm_source=google&utm_medium=cpc&utm_campaign=IN-Travel-Search-Brand-SkyscannerPure-Desktop&utm_term=skyscanner&associateID=SEM_FLI_19465_00000&campaign_id=21456707965&adgroupid=167310367911&keyword_id=kwd-400074527&gad_source=1&gad_campaignid=21456707965&gbraid=0AAAAAD3oWFgg2e8Gsz-9PPoDvz2ZYo4Jq&gclid=CjwKCAjwy5rUBhB5EiwAIoAtCpMlWHyJB85TqKpUl67VXcCE_d8O85iLfdBfZwILv7Zx-20sy0OuZhoCcOsQAvD_BwE"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-[#0770e3] hover:bg-[#065ebf] text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Plane className="w-4 h-4" />
                  Search Flights on Skyscanner
                </a>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Left Column: Itinerary Accordion (70%) */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-xl font-serif mb-6 border-b border-[#0a0a0a]/10 pb-4 flex items-center justify-between text-[#0a0a0a]">
                  <span>Day-by-Day Journey</span>
                  <span className="text-xs font-mono text-[#0a0a0a]/40 uppercase tracking-widest">{itinerary.length} Days Planned</span>
                </h2>
              
              <div className="space-y-4">
                {itinerary.map((item) => {
                  const isExpanded = expandedDays.has(item.day);
                  return (
                    <div 
                      key={item.day}
                      className="bg-[#0a0a0a]/60 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/20"
                    >
                      <button 
                        onClick={() => toggleDayAccordion(item.day)}
                        className="w-full px-6 py-5 flex items-center justify-between focus:outline-none"
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-colors",
                            isExpanded ? "bg-white text-black" : "bg-white/5 text-white"
                          )}>
                            {item.day}
                          </div>
                          <div className="text-left">
                            <div className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-0.5">Day {item.day}</div>
                            <div className="font-medium text-base text-white/90">{item.theme}</div>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-white/60" /> : <ChevronDown className="w-4 h-4 text-white/60" />}
                        </div>
                      </button>
                      
                      <div className={cn(
                        "transition-all duration-500 ease-in-out px-6 overflow-hidden",
                        isExpanded ? "max-h-[800px] pb-6 opacity-100" : "max-h-0 opacity-0"
                      )}>
                        <div className="pt-2 border-t border-white/10">
                          <ul className="space-y-4 mt-4">
                            {item.activities.map((activity, idx) => (
                              <li key={idx} className="flex gap-4 items-start group">
                                <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 shrink-0 group-hover:bg-white/60 transition-colors" />
                                <span className="text-sm text-white/70 leading-relaxed font-medium group-hover:text-white/90 transition-colors">
                                  {activity}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Smart Checklist (30%) */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 bg-[#0a0a0a]/60 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-white">
                <h2 className="text-xl font-serif mb-6 border-b border-white/10 pb-4 flex items-center justify-between">
                  <span>Smart Prep</span>
                  <span className="text-xs font-mono text-white/40 uppercase tracking-widest">
                    {completedItems.size}/{checklist.length} Done
                  </span>
                </h2>
                
                <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                  {checklist.map((item) => {
                    const isCompleted = completedItems.has(item.id);
                    return (
                      <div 
                        key={item.id}
                        onClick={() => toggleChecklistItem(item.id)}
                        className={cn(
                          "p-4 rounded-2xl border transition-all duration-300 cursor-pointer group",
                          isCompleted 
                            ? "bg-white/5 border-white/5 opacity-50" 
                            : "bg-white/10 border-white/10 hover:bg-white/15 hover:border-white/20"
                        )}
                      >
                        <div className="flex gap-4 items-start">
                          <button className="shrink-0 mt-0.5 focus:outline-none">
                            {isCompleted 
                              ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                              : <Circle className="w-5 h-5 text-white/30 group-hover:text-white/50 transition-colors" />
                            }
                          </button>
                          <div className="flex-1 min-w-0">
                            <h4 className={cn(
                              "text-sm font-bold transition-all duration-300",
                              isCompleted ? "text-white/50 line-through" : "text-white/90"
                            )}>
                              {item.item}
                            </h4>
                            <div className={cn(
                              "text-xs text-white/50 mt-1.5 transition-all duration-300 overflow-hidden",
                              isCompleted ? "max-h-0 opacity-0 mt-0" : "max-h-24 opacity-100"
                            )}>
                              {item.context}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Progress Bar */}
                <div className="mt-6 pt-4 border-t border-white/10">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                    <span>Readiness</span>
                    <span>{Math.round((completedItems.size / (checklist.length || 1)) * 100)}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white transition-all duration-500 ease-out"
                      style={{ width: `${(completedItems.size / (checklist.length || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                
              </div>
            </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
