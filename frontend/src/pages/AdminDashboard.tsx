import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Globe, Users, AlertOctagon, FileCheck, ShieldAlert, Crosshair, Check, Power, Shield } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function AdminDashboard() {
  const [stats, setStats] = useState({ tourists: 0, sos: 0, ilp: 0 });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [permits, setPermits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // In a real app, we would set up Supabase realtime subscriptions here
  }, []);

  const fetchData = async () => {
    try {
      // Fetch stats
      const { count: touristCount } = await supabase.from('tourists').select('*', { count: 'exact', head: true });
      const { count: sosCount } = await supabase.from('sos_alerts').select('*', { count: 'exact', head: true }).eq('status', 'active');
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
        .eq('status', 'active')
        .order('ai_severity_score', { ascending: false });
      
      setAlerts(alertsData || []);

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

  const dispatchUnit = async (id: string) => {
    try {
      await supabase.from('sos_alerts').update({ status: 'dispatched' }).eq('id', id);
      fetchData(); // Refresh
    } catch (err) {
      console.error('Failed to dispatch unit', err);
    }
  };

  const approvePermit = async (id: string) => {
    try {
      await supabase.from('ilp_permits').update({ status: 'approved' }).eq('id', id);
      fetchData(); // Refresh
    } catch (err) {
      console.error('Failed to approve permit', err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
            <MacroMetric title="Active SOS Pings" value={stats.sos.toString()} icon={<AlertOctagon className="w-5 h-5 text-red-500" />} highlight="border-t-red-500" />
            <MacroMetric title="Pending ILP Approvals" value={stats.ilp.toString()} icon={<FileCheck className="w-5 h-5 text-yellow-500" />} highlight="border-t-yellow-500" />
          </div>

          {/* Macro Map */}
          <div className="flex-1 min-h-[400px] lg:min-h-[500px] bg-[#050505] border border-white/20 relative overflow-hidden flex flex-col">
            <div className="absolute top-4 left-4 z-10 px-4 py-2 bg-black border border-white/20 font-sans text-xs font-semibold text-white tracking-[0.15em] uppercase">
              NER Sector Map
            </div>
            
            {/* Map Placeholder Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />
            
            {/* Mock Data Points */}
            {alerts.map((alert, idx) => (
              <div 
                key={alert.id}
                className="absolute"
                style={{ 
                  top: `${30 + (idx * 15)}%`, 
                  left: `${40 + (idx * 10)}%` 
                }}
              >
                <div className="relative">
                  <div className="w-12 h-12 border border-red-500 rounded-full animate-ping absolute -top-5 -left-5" />
                  <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_rgba(220,38,38,1)]" />
                  <div className="absolute top-3 left-3 bg-red-950/80 border border-red-500/50 px-2 py-1 font-mono text-[9px] text-red-300 whitespace-nowrap">
                    SOS: {alert.ai_severity_score}
                  </div>
                </div>
              </div>
            ))}
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
                alerts.map(alert => (
                  <div key={alert.id} className="border border-red-500/30 bg-red-950/10 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-mono text-[10px] text-red-400 tracking-wider mb-1">SCORE: {alert.ai_severity_score}/100</div>
                        <div className="font-sans text-sm font-bold text-white uppercase">{alert.tourists?.full_name || 'Unknown'}</div>
                      </div>
                      <div className="px-2 py-1 bg-red-500/20 border border-red-500/50 font-mono text-[9px] text-red-400 uppercase">
                        {alert.incident_type}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-red-500/20">
                      <div className="font-mono text-[9px] text-white/40">
                        {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                      </div>
                      <button 
                        onClick={() => dispatchUnit(alert.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 transition-colors font-sans text-[10px] font-bold uppercase tracking-widest text-white"
                      >
                        <Crosshair className="w-3 h-3" />
                        Dispatch
                      </button>
                    </div>
                  </div>
                ))
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
                    <div className="flex justify-end">
                      <button 
                        onClick={() => approvePermit(permit.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-green-500/50 hover:bg-green-500/10 transition-colors font-sans text-[10px] font-bold uppercase tracking-widest text-green-500"
                      >
                        <Check className="w-3 h-3" />
                        Approve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </main>
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
