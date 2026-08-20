import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { User, Calendar, Map, MapPin, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Extracted context type assuming we update TouristLayout to provide it
interface ExtendedTouristContext {
  tourist: any;
  travelerProfile: any | null;
  permits: any[];
  setToastMessage: (msg: string | null) => void;
  refreshProfile: () => Promise<void>;
}

export function TravelerProfilePage() {
  const { tourist, travelerProfile, permits, setToastMessage, refreshProfile } = useOutletContext<ExtendedTouristContext>();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [formData, setFormData] = useState({
    full_name: tourist?.full_name || '',
    age: '',
    gender: 'Prefer not to say',
    country_code: '+91',
    phone_number: '',
    nationality: 'India'
  });

  const handleEditClick = () => {
    let cc = '+91';
    let phone = travelerProfile.phone_number || '';
    if (phone.startsWith('+')) {
      const match = phone.match(/^(\+\d{1,3})(.*)$/);
      if (match) {
        cc = match[1];
        phone = match[2];
      }
    }
    
    setFormData({
      full_name: travelerProfile.full_name || '',
      age: travelerProfile.age?.toString() || '',
      gender: travelerProfile.gender || 'Prefer not to say',
      country_code: cc,
      phone_number: phone,
      nationality: travelerProfile.nationality || 'India'
    });
    setIsEditingProfile(true);
  };

  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState('');

  const handleUpdateAvatar = async () => {
    if (!newAvatarUrl.trim()) return;
    try {
      const { error } = await supabase.from('traveler_profiles').update({ avatar_url: newAvatarUrl }).eq('id', travelerProfile.id);
      if (error) throw error;
      setToastMessage("Profile photo updated successfully!");
      if (refreshProfile) await refreshProfile();
      setIsEditingAvatar(false);
      setNewAvatarUrl('');
    } catch (err: any) {
      setToastMessage("Failed to update photo: " + err.message);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.age) {
      setToastMessage("Please fill out all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (travelerProfile) {
        const { error: profileError } = await supabase
          .from('traveler_profiles')
          .update({
            full_name: formData.full_name,
            age: parseInt(formData.age),
            gender: formData.gender,
            phone_number: `${formData.country_code}${formData.phone_number}`,
            nationality: formData.nationality
          })
          .eq('id', user.id);
        if (profileError) throw profileError;
        setToastMessage("Profile updated successfully!");
      } else {
        const avatar_url = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(formData.full_name)}`;
        const { error: profileError } = await supabase
          .from('traveler_profiles')
          .insert({
            id: user.id,
            full_name: formData.full_name,
            age: parseInt(formData.age),
            gender: formData.gender,
            phone_number: `${formData.country_code}${formData.phone_number}`,
            nationality: formData.nationality,
            avatar_url: avatar_url,
            travel_history: []
          });
        if (profileError) throw profileError;
        setToastMessage("Profile created successfully!");
      }

      // Sync full_name back to tourists table if it exists
      if (tourist) {
        await supabase
          .from('tourists')
          .update({ full_name: formData.full_name })
          .eq('id', tourist.id);
      }
      
      // Refresh the context state in the layout
      if (refreshProfile) {
        await refreshProfile();
      }
      setIsEditingProfile(false);
      
    } catch (err: any) {
      console.error(err);
      setToastMessage(`Error saving profile: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If no profile exists OR we are editing, render the form
  if (!travelerProfile || isEditingProfile) {
    return (
      <div className="flex-1 h-screen overflow-y-auto p-4 md:p-8 bg-[#FDFBF7] flex items-center justify-center relative z-10 selection:bg-neutral-900/10">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-black/[0.05] animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
          
          {isEditingProfile && (
            <button onClick={() => setIsEditingProfile(false)} className="absolute top-6 right-6 text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 hover:text-[#0a0a0a] transition-colors px-3 py-1.5 bg-black/5 rounded-full">
              Cancel
            </button>
          )}

          <div className="w-16 h-16 bg-[#0a0a0a] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-black/10">
            <User className="w-8 h-8 text-white" />
          </div>
          
          <h1 className="font-serif text-3xl font-bold text-[#0a0a0a] mb-2">
            {isEditingProfile ? "Edit Profile" : "Create Profile"}
          </h1>
          <p className="text-[#0a0a0a]/60 text-sm font-medium mb-8">
            {isEditingProfile ? "Update your personal details below." : "Complete your verified traveler profile to access the dashboard and generate digital passes."}
          </p>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/50 ml-1">Full Legal Name</label>
              <input 
                type="text" 
                required
                value={formData.full_name}
                onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="John Doe" 
                className="w-full bg-[#f5f5f5] border border-black/5 rounded-2xl py-4 px-4 text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all text-[#0a0a0a]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/50 ml-1">Age</label>
                <input 
                  type="number" 
                  min="18"
                  max="120"
                  required
                  value={formData.age}
                  onChange={e => setFormData(prev => ({ ...prev, age: e.target.value }))}
                  placeholder="25" 
                  className="w-full bg-[#f5f5f5] border border-black/5 rounded-2xl py-4 px-4 text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all text-[#0a0a0a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/50 ml-1">Gender</label>
                <select 
                  value={formData.gender}
                  onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                  className="w-full bg-[#f5f5f5] border border-black/5 rounded-2xl py-4 px-4 text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all text-[#0a0a0a] appearance-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/50 ml-1">Phone Number</label>
              <div className="flex gap-2">
                <select
                  value={formData.country_code}
                  onChange={e => setFormData(prev => ({ ...prev, country_code: e.target.value }))}
                  className="w-32 bg-[#f5f5f5] border border-black/5 rounded-2xl py-4 px-4 text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all text-[#0a0a0a] appearance-none"
                >
                  <option value="+91">+91 (IN)</option>
                  <option value="+1">+1 (US)</option>
                  <option value="+44">+44 (UK)</option>
                  <option value="+61">+61 (AU)</option>
                  <option value="+81">+81 (JP)</option>
                </select>
                <input 
                  type="tel"
                  required
                  value={formData.phone_number}
                  onChange={e => setFormData(prev => ({ ...prev, phone_number: e.target.value.replace(/\D/g, '') }))}
                  placeholder="9876543210" 
                  className="flex-1 bg-[#f5f5f5] border border-black/5 rounded-2xl py-4 px-4 text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all text-[#0a0a0a]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/50 ml-1">Nationality (For Validation)</label>
              <select
                required
                value={formData.nationality}
                onChange={e => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
                className="w-full bg-[#f5f5f5] border border-black/5 rounded-2xl py-4 px-4 text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all text-[#0a0a0a] appearance-none"
              >
                <option value="India">India</option>
                <option value="USA">United States</option>
                <option value="UK">United Kingdom</option>
                <option value="Australia">Australia</option>
                <option value="Japan">Japan</option>
                <option value="Other">Other / Rest of World</option>
              </select>
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[54px] mt-4 bg-[#0a0a0a] text-white rounded-2xl font-bold text-sm hover:bg-black/80 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isEditingProfile ? "Save Changes" : "Verify Identity"}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Bento-box Dashboard for existing profiles
  const activePasses = permits ? permits.filter((p: any) => p.status === 'approved').length : 0;
  const historyCount = travelerProfile.travel_history ? travelerProfile.travel_history.length : 0;

  return (
    <div className="flex-1 h-screen overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10 text-neutral-900 selection:bg-neutral-900/10">
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        
        {isEditingAvatar && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <h3 className="font-serif text-2xl font-bold text-[#0a0a0a] mb-2">Update Photo</h3>
              <p className="text-[#0a0a0a]/60 text-sm font-medium mb-6">Paste a direct image URL to update your profile picture.</p>
              <input 
                type="text" 
                value={newAvatarUrl} 
                onChange={e => setNewAvatarUrl(e.target.value)} 
                placeholder="https://example.com/photo.jpg"
                className="w-full bg-[#f5f5f5] border border-black/5 rounded-2xl py-4 px-4 text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all text-[#0a0a0a] mb-6"
              />
              <div className="flex gap-4">
                <button onClick={() => setIsEditingAvatar(false)} className="flex-1 py-4 text-sm font-bold text-[#0a0a0a]/60 hover:bg-[#f5f5f5] rounded-xl transition-colors">Cancel</button>
                <button onClick={handleUpdateAvatar} className="flex-[2] py-4 bg-[#0a0a0a] text-white text-sm font-bold rounded-xl shadow-lg hover:bg-black/80 transition-colors">Save Photo</button>
              </div>
            </div>
          </div>
        )}

        {/* Profile Header (Large Bento) */}
        <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-xl shadow-black/[0.02] border border-black/[0.05] flex flex-col md:flex-row items-center md:items-start gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div 
            onClick={() => setIsEditingAvatar(true)}
            className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-[#f5f5f5] border-4 border-white shadow-lg shrink-0 overflow-hidden relative group cursor-pointer"
          >
            {travelerProfile.avatar_url ? (
              <img src={travelerProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-40 transition-opacity duration-300" />
            ) : (
              <User className="w-full h-full p-8 text-black/20 group-hover:opacity-40 transition-opacity duration-300" />
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40">
              <span className="text-white text-[10px] font-bold uppercase tracking-widest text-center px-2">Change<br/>Photo</span>
            </div>
          </div>
          <div className="text-center md:text-left flex-1">
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#0a0a0a] mb-2">
              Hi, {travelerProfile.full_name}
            </h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
              <span className="px-4 py-1.5 bg-[#f5f5f5] rounded-full text-xs font-bold uppercase tracking-widest text-[#0a0a0a]/60">
                Age: {travelerProfile.age}
              </span>
              <span className="px-4 py-1.5 bg-[#f5f5f5] rounded-full text-xs font-bold uppercase tracking-widest text-[#0a0a0a]/60">
                {travelerProfile.gender}
              </span>
              {travelerProfile.nationality && (
                <span className="px-4 py-1.5 bg-[#f5f5f5] rounded-full text-xs font-bold uppercase tracking-widest text-[#0a0a0a]/60">
                  {travelerProfile.nationality}
                </span>
              )}
              {travelerProfile.phone_number && (
                <span className="px-4 py-1.5 bg-[#f5f5f5] rounded-full text-xs font-bold uppercase tracking-widest text-[#0a0a0a]/60">
                  {travelerProfile.phone_number}
                </span>
              )}
              <span className="px-4 py-1.5 bg-green-500/10 text-green-600 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified Identity
              </span>
              <button 
                onClick={handleEditClick} 
                className="px-4 py-1.5 bg-black/5 hover:bg-black/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#0a0a0a] transition-colors ml-auto md:ml-4"
              >
                Edit Details
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          <div className="bg-white rounded-[2rem] p-6 shadow-lg shadow-black/[0.02] border border-black/[0.05] flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4">
              <Map className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-4xl font-serif font-bold text-[#0a0a0a]">{historyCount}</div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 mt-1">Places Visited</div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 shadow-lg shadow-black/[0.02] border border-black/[0.05] flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-4xl font-serif font-bold text-[#0a0a0a]">{activePasses}</div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 mt-1">Active Passes</div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 shadow-lg shadow-black/[0.02] border border-black/[0.05] flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="text-4xl font-serif font-bold text-[#0a0a0a]">0</div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#0a0a0a]/40 mt-1">SOS Alerts Triggered</div>
          </div>
        </div>

        {/* Travel History List */}
        <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-black/[0.02] border border-black/[0.05] animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200">
          <h2 className="font-serif text-2xl font-bold text-[#0a0a0a] mb-6 flex items-center gap-3">
            <Calendar className="w-6 h-6 text-[#0a0a0a]/50" />
            Travel History
          </h2>
          
          {historyCount === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-black/5 rounded-2xl">
              <MapPin className="w-12 h-12 text-[#0a0a0a]/20 mb-3" />
              <div className="text-[#0a0a0a]/50 font-medium">No travel history recorded yet.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {travelerProfile.travel_history?.map((hist: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 bg-[#f5f5f5] rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <MapPin className="w-4 h-4 text-[#0a0a0a]" />
                    </div>
                    <div>
                      <div className="font-bold text-[#0a0a0a]">{hist.destination || 'Unknown Location'}</div>
                      <div className="text-xs text-[#0a0a0a]/50 font-medium mt-0.5">{hist.date || 'Recent'}</div>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-green-500/10 text-green-600 text-[10px] font-bold uppercase tracking-widest rounded-full">
                    Completed
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
