import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, FileText, AlertTriangle, ShieldCheck, Clock, MapPin, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function IncidentHistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('sos_alerts')
          .select('*, tourists(full_name, phone)')
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;
        setHistory(data || []);
      } catch (err) {
        console.error('Error fetching history', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const filteredHistory = history.filter(item => {
    const name = item.tourists?.full_name?.toLowerCase() || '';
    const phone = item.tourists?.phone?.toLowerCase() || '';
    const type = item.incident_type?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();
    return name.includes(search) || phone.includes(search) || type.includes(search);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <span className="px-2 py-1 bg-green-500/20 text-green-500 border border-green-500/30 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Resolved</span>;
      case 'active':
        return <span className="px-2 py-1 bg-red-500/20 text-red-500 border border-red-500/30 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-1"><AlertTriangle className="w-3 h-3 animate-pulse"/> Active</span>;
      case 'dispatched':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-1"><Clock className="w-3 h-3"/> Dispatched</span>;
      default:
        return <span className="px-2 py-1 bg-white/10 text-white/60 border border-white/20 rounded text-[10px] uppercase font-bold tracking-widest">{status}</span>;
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#0a0a0a] text-white p-6 md:p-10 flex flex-col gap-8">
      
      {/* Header */}
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => navigate('/dashboard/admin')}
          className="self-start flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/70"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[10px] font-mono tracking-widest uppercase">Back to Command Center</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 text-red-500">
              <FileText className="w-6 h-6" />
              <h2 className="font-serif text-3xl md:text-4xl">Incident History</h2>
            </div>
            <p className="text-sm font-mono text-white/50 uppercase tracking-widest">
              Permanent record of all past emergencies and geofence breaches
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input 
              type="text"
              placeholder="Search name, phone, or incident..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111] border border-white/20 rounded-lg pl-10 pr-4 py-3 text-sm font-mono text-white placeholder-white/30 focus:border-red-500/50 outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 bg-[#111] border border-white/10 rounded-xl overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/30">
            <FileText className="w-12 h-12" />
            <p className="font-mono text-sm uppercase tracking-widest">No records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/50 border-b border-white/10">
                  <th className="p-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] whitespace-nowrap">Timestamp</th>
                  <th className="p-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Tourist Info</th>
                  <th className="p-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Incident Details</th>
                  <th className="p-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Severity</th>
                  <th className="p-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Status</th>
                  <th className="p-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] text-right">Location</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => {
                  const date = new Date(item.created_at);
                  const nameMatch = item.incident_type?.match(/\[NAME: (.*?)\]/);
                  const displayTouristName = nameMatch ? nameMatch[1] : (item.tourists?.full_name || 'Unknown');
                  const displayIncidentType = item.incident_type?.replace(/\[NAME: .*?\]\s*/, '') || item.incident_type;

                  return (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-mono text-xs text-white/80">{date.toLocaleDateString()}</div>
                        <div className="font-mono text-[10px] text-white/40">{date.toLocaleTimeString()}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-sans text-sm font-bold text-white uppercase">{displayTouristName}</div>
                        <div className="font-mono text-[10px] text-white/50">{item.tourists?.phone || 'N/A'}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-xs text-white/80 max-w-xs truncate" title={displayIncidentType}>
                          {displayIncidentType}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-xs text-white/80">{item.ai_severity_score}/10</div>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="p-4 text-right">
                        <a 
                          href={`https://maps.google.com/?q=${item.latitude},${item.longitude}`}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded text-[10px] uppercase font-bold tracking-widest transition-colors"
                        >
                          <MapPin className="w-3 h-3" /> Map
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
