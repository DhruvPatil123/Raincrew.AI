import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, UserCheck, HelpCircle, ArrowRight, User, Mail, Sparkles, Check, AudioLines,
  KeyRound, Send, Inbox, ShieldAlert
} from 'lucide-react';
import { Campaign, RecruiterSession } from '../types';

interface RoleSelectionProps {
  onSelectRole: (
    role: 'recruiter' | 'candidate', 
    initialCampaignId?: string, 
    candidateName?: string, 
    candidateEmail?: string,
    recruiterSession?: RecruiterSession
  ) => void;
  campaigns: Campaign[];
  activeCampaignId: string;
  branding?: {
    appName?: string;
    logoUrl?: string;
    companyName?: string;
    themeColor?: string;
  };
}

export default function RoleSelection({ onSelectRole, campaigns, activeCampaignId, branding }: RoleSelectionProps) {
  const [activeTab, setActiveTab] = useState<'recruiter' | 'candidate'>('recruiter');
  const [recruiterAuthMode, setRecruiterAuthMode] = useState<'magic-link' | 'sso' | 'legacy'>('magic-link');
  
  // Magic Link fields
  const [magicEmail, setMagicEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [magicVerified, setMagicVerified] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  // Recruiter Legacy Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recruiterError, setRecruiterError] = useState('');
  
  // Candidate Login Form
  const [candName, setCandName] = useState('');
  const [candEmail, setCandEmail] = useState('');
  const [candidateError, setCandidateError] = useState('');

  // Sample credentials for Recruiter
  const sampleEmail = 'recruiter@foloup.ai';
  const samplePassword = 'manager123';

  // SSO selection list
  const SSO_PROVIDERS = [
    { name: 'Bruce Wayne', email: 'bwayne@wayne-corp.com', org: 'Wayne Corp', provider: 'google' as const },
    { name: 'Diana Prince', email: 'diana@amazon.com', org: 'Themyscira Group', provider: 'google' as const },
    { name: 'Tony Stark', email: 'tstark@stark-industries.com', org: 'Stark Labs', provider: 'github' as const },
    { name: 'Peter Parker', email: 'pparker@dailybugle.com', org: 'Bugle Media', provider: 'github' as const },
  ];

  const handleAutoFill = () => {
    setEmail(sampleEmail);
    setPassword(samplePassword);
    setRecruiterError('');
  };

  const handleRecruiterLogin = (e: FormEvent) => {
    e.preventDefault();
    if (email === sampleEmail && password === samplePassword) {
      onSelectRole('recruiter', undefined, undefined, undefined, {
        email: sampleEmail,
        name: 'Eleanor Vance',
        provider: 'magic-link',
        organization: 'Sandbox Workspace',
        workspaceId: 'sandbox'
      });
    } else {
      setRecruiterError('Invalid credentials. Please use the provided sample recruiter details below for the sandbox.');
    }
  };

  const handleSendMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!magicEmail.trim()) return;
    setMagicLoading(true);
    setRecruiterError('');

    try {
      const response = await fetch('/api/auth/magic-link-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: magicEmail.trim() })
      });
      const data = await response.json();
      setMagicLoading(false);
      if (response.ok && data.success) {
        setMagicLinkSent(true);
        setGeneratedLink(data.url);
      } else {
        setRecruiterError(data.error || data.message || 'Failed to dispatch magic link. Please check network state.');
      }
    } catch (err) {
      setMagicLoading(false);
      setRecruiterError('Unexpected network failure during magic link dispatch.');
    }
  };

  const handleVerifyMagicLink = async (linkUrl: string) => {
    if (!linkUrl) return;
    setMagicLoading(true);

    try {
      const queryParams = new URLSearchParams(linkUrl.split('?')[1]);
      const token = queryParams.get('token') || '';

      const response = await fetch(`/api/auth/magic-link-verify?token=${token}`);
      const data = await response.json();
      setMagicLoading(false);

      if (response.ok && data.success) {
        setMagicVerified(true);
        onSelectRole('recruiter', undefined, undefined, undefined, {
          email: data.user.email,
          name: data.user.name,
          provider: 'magic-link',
          organization: data.user.organization,
          workspaceId: data.user.workspaceId,
          token: data.session.token
        });
      } else {
        setRecruiterError(data.error || data.message || 'Magic link is invalid or expired.');
      }
    } catch (err) {
      setMagicLoading(false);
      setRecruiterError('Error verifying magic link session token.');
    }
  };

  const handleSSOLogin = async (profile: typeof SSO_PROVIDERS[0]) => {
    setRecruiterError('');
    setMagicLoading(true);

    try {
      const response = await fetch('/api/auth/oauth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          name: profile.name,
          provider: profile.provider,
          organization: profile.org
        })
      });
      const data = await response.json();
      setMagicLoading(false);

      if (response.ok && data.success) {
        onSelectRole('recruiter', undefined, undefined, undefined, {
          email: data.user.email,
          name: data.user.name,
          provider: data.user.provider,
          organization: data.user.organization,
          workspaceId: data.user.workspaceId
        });
      } else {
        setRecruiterError(data.error || data.message || 'SSO authentication profile rejected.');
      }
    } catch (err) {
      setMagicLoading(false);
      setRecruiterError('SSO callback channel network error.');
    }
  };

  const handleCandidateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!candName.trim() || !candEmail.trim()) {
      setCandidateError('Please provide both your name and email address to proceed.');
      return;
    }

    const activeCampaign = campaigns.find(c => c.id === activeCampaignId) || campaigns[0];
    if (!activeCampaign) {
      setCandidateError('No recruitment vacancies are currently active. Please contact the company recruiter.');
      return;
    }

    setCandidateError('');
    onSelectRole('candidate', activeCampaign.id, candName.trim(), candEmail.trim());
  };

  const activeCampaign = campaigns.find(c => c.id === activeCampaignId) || campaigns[0];

  return (
    <div className="max-w-4xl mx-auto my-12 bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(15,23,42,0.06)] grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
      
      {/* Visual panel Left */}
      <div className="md:col-span-12 lg:col-span-12 xl:col-span-5 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white p-9 flex flex-col justify-between relative overflow-hidden lg:p-9 md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.18)_0,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <div className="space-y-8 z-10">
          <div className="flex items-center gap-2.5">
            {branding?.logoUrl ? (
              <img 
                src={branding.logoUrl} 
                className="h-8 max-w-[125px] object-contain rounded-lg" 
                alt="Logo" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl text-white shadow-[0_4px_14px_rgba(99,102,241,0.28)] flex items-center justify-center animate-pulse">
                <AudioLines className="w-5 h-5 text-indigo-50" />
              </div>
            )}
            <span className="text-xl font-display font-extrabold tracking-tight">
              {branding?.appName ? (
                <span>{branding.appName} AI Portal</span>
              ) : (
                <>Folo<span className="text-indigo-400">Up</span> AI Portal</>
              )}
            </span>
          </div>

          <div className="space-y-4 pt-8">
            <h2 className="text-2xl font-display font-bold tracking-tight leading-span leading-tight">Vocal-First Screening Workspace</h2>
            <p className="text-xs text-slate-300 leading-relaxed font-light">
              {branding?.appName || 'Raincrew.AI'} uses conversational, intelligent AI follow-ups to evaluate job candidates through rich, natural speech analytics.
            </p>
          </div>
        </div>

        <div className="mt-12 space-y-4 z-10 border-t border-slate-800/85 pt-8">
          <div className="flex gap-3 items-start text-xs text-slate-300">
            <div className="w-5 h-5 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold text-slate-100 font-display">Multi-Tenancy Isolation</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">Enterprises get secure workspace isolation domains scoped to custom emails.</p>
            </div>
          </div>

          <div className="flex gap-3 items-start text-xs text-slate-300">
            <div className="w-5 h-5 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold text-slate-100 font-display">Modern Secure Auth</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">Passwordless Magic-Links and OAuth simulated integrations authenticate sessions seamlessly.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Role specific forms Right */}
      <div className="md:col-span-12 lg:col-span-12 xl:col-span-7 p-8 md:p-10 flex flex-col justify-center bg-slate-50/40">
        
        {/* Portal Switch tabs */}
        <div className="bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200/50 flex text-xs font-semibold mb-8 max-w-sm">
          <button
            onClick={() => setActiveTab('recruiter')}
            className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer font-display font-semibold ${
              activeTab === 'recruiter' 
                ? 'bg-white text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.04)]' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-slate-750" /> Company Recruiter
          </button>
          <button
            onClick={() => setActiveTab('candidate')}
            className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer font-display font-semibold ${
              activeTab === 'candidate' 
                ? 'bg-white text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.04)]' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4 text-slate-755" /> Invited Candidate
          </button>
        </div>

        {activeTab === 'recruiter' ? (
          <motion.div
            key="recruiter-portal"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="space-y-1">
              <h3 className="text-lg font-display font-bold text-slate-800">Recruiter Space</h3>
              <p className="text-slate-400 text-xs text-light">Authenticate into your secure campaign dashboard and evaluate custom metrics.</p>
            </div>

            {/* Recruiter Authentication sub-header segments */}
            <div className="flex border-b border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setRecruiterAuthMode('magic-link')}
                className={`pb-2.5 px-3 border-b-2 font-display transition-all cursor-pointer ${
                  recruiterAuthMode === 'magic-link' 
                    ? 'border-indigo-600 text-slate-900 font-bold' 
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Passwordless Mail Link
              </button>
              <button
                onClick={() => setRecruiterAuthMode('sso')}
                className={`pb-2.5 px-3 border-b-2 font-display transition-all cursor-pointer ${
                  recruiterAuthMode === 'sso' 
                    ? 'border-indigo-600 text-slate-900 font-bold' 
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Tenant OAuth Login
              </button>
              <button
                onClick={() => setRecruiterAuthMode('legacy')}
                className={`pb-2.5 px-3 border-b-2 font-display transition-all cursor-pointer ${
                  recruiterAuthMode === 'legacy' 
                    ? 'border-indigo-600 text-slate-900 font-bold' 
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Sandbox PIN
              </button>
            </div>

            {/* ERROR ALERT BOX */}
            {recruiterError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-xs text-red-700 font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{recruiterError}</span>
              </div>
            )}

            {/* SUB-VIEW 1: PASSWORDLESS MAGIC-LINK FLOW */}
            {recruiterAuthMode === 'magic-link' && (
              <div className="space-y-4">
                {!magicLinkSent ? (
                  <form onSubmit={handleSendMagicLink} className="space-y-4.5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Input Your Work Mail</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. recruiter@stripe.com"
                        value={magicEmail}
                        onChange={(e) => setMagicEmail(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-150 focus:border-indigo-500 bg-white shadow-xs transition-all placeholder:text-slate-400"
                        disabled={magicLoading}
                      />
                      <span className="text-[10px] text-slate-400 leading-normal block pt-1">
                        We will analyze the domain (e.g. <code>stripe.com</code>) to isolate your enterprise campaign records instantly.
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={magicLoading}
                      className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-xs font-display font-medium tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" /> 
                      {magicLoading ? 'Dispatching link...' : 'Send Magic-Link Callback'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4 bg-indigo-50/30 border border-indigo-100/50 rounded-2xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 text-[10px] uppercase font-mono tracking-wider font-extrabold text-indigo-400 animate-pulse flex items-center gap-1">
                      <Inbox className="w-3 h-3" /> Sandbox Mailbox
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-indigo-900 leading-snug">Simulated Recruiter Inbox</h4>
                      <p className="text-[11px] text-slate-500 font-light leading-normal">
                        {branding?.appName || 'Raincrew.AI'} AI has dispatched a login magic token to <strong>{magicEmail}</strong>. Since you are evaluating in the sandbox preview mode, you can trigger passwordless validation below:
                      </p>
                    </div>

                    <div className="bg-white border border-indigo-100/40 rounded-xl p-4.5 space-y-3 shadow-xs">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                        <span>Sender: login-noreply@raincrew.ai</span>
                        <span>Just now</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800 font-display">Your {branding?.appName || 'Raincrew.AI'} Passwordless Authentication Link</p>
                        <p className="text-[10px] text-slate-400">Click the verification below to establish your secure tenant session.</p>
                      </div>
                      
                      <button
                        onClick={() => handleVerifyMagicLink(generatedLink)}
                        disabled={magicLoading}
                        className="w-full py-2.5 bg-gradient-to-r from-emerald-650 to-teal-600 hover:from-emerald-700 hover:to-teal-600 text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1"
                      >
                        <Check className="w-4 h-4 text-emerald-100 animate-bounce" />
                        {magicLoading ? 'Verifying active token...' : 'Verify Link & Complete Login'}
                      </button>
                    </div>

                    <button
                      onClick={() => setMagicLinkSent(false)}
                      className="text-[10px] text-indigo-600 font-semibold hover:underline block pt-1"
                    >
                      ← Double check your email address
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SUB-VIEW 2: ENTERPRISE TENANT SSO FLOW */}
            {recruiterAuthMode === 'sso' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 font-light leading-relaxed">
                  Fast-track SSO testing by selecting one of our simulation enterprise recruiter profiles. This integrates and registers unified Google or GitHub authentication claims isolated under their tenant domains:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  {SSO_PROVIDERS.map((profile, i) => (
                    <button
                      key={i}
                      onClick={() => handleSSOLogin(profile)}
                      disabled={magicLoading}
                      className="p-3.5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all text-left flex flex-col justify-between group relative min-h-[110px]"
                    >
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{profile.org}</span>
                        <h4 className="text-sm font-semibold text-slate-850 font-display group-hover:text-indigo-600">{profile.name}</h4>
                        <code className="text-[10px] text-indigo-500 font-mono select-none block">{profile.email}</code>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-slate-50/50 mt-2 w-full text-[10px] text-slate-400">
                        <span className="uppercase font-semibold tracking-wider">Simulate {profile.provider === 'google' ? 'Google claims' : 'GitHub claims'}</span>
                        <span className="text-slate-300 group-hover:text-indigo-500 transition-colors font-bold">Launch →</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-VIEW 3: LEGACY PIN FOR PUBLIC SANDBOX WORKSPACE */}
            {recruiterAuthMode === 'legacy' && (
              <form onSubmit={handleRecruiterLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Work Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 bg-white shadow-sm transition-all placeholder:text-slate-400/85"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Workspace PIN / Passcode</label>
                    <span className="text-[11px] text-indigo-600 font-bold cursor-pointer select-none hover:text-indigo-750 font-display text-xs" onClick={handleAutoFill}>
                      Fill Sandbox Credentials
                    </span>
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 bg-white shadow-sm transition-all placeholder:text-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white rounded-2xl text-xs font-display font-bold tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                >
                  Enter Recruiter Workspace <ArrowRight className="w-4 h-4 ml-1" />
                </button>

                {/* Sandbox Credentials Helper Card */}
                <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4.5 space-y-2">
                  <div className="flex gap-1.5 items-center text-amber-800 font-display font-bold text-xs">
                    <HelpCircle className="w-4 h-4 shrink-0" />
                    <span>Private Testing Sandbox Credentials</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal font-light">
                    Avoid exposing your real identity. Use these prevalidated safety credentials specifically configured for screening simulation runs:
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-1 text-slate-600 text-[11.5px] font-mono bg-white/80 rounded-xl p-3 border border-amber-100/50">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Email (User ID)</span>
                      <p className="font-semibold text-slate-705">{sampleEmail}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Passcode</span>
                      <p className="font-semibold text-slate-705">{samplePassword}</p>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="candidate-portal"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="space-y-1">
              <h3 className="text-lg font-display font-bold text-slate-800">Job Screening Portal</h3>
              <p className="text-slate-400 text-xs">Access your oral evaluation workspace to engage with automated speech assessment triggers.</p>
            </div>

            {!activeCampaign ? (
              <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-5 text-center space-y-1">
                <p className="text-xs font-semibold text-amber-800 font-display">No recruitment vacancies currently active.</p>
                <p className="text-[11px] text-slate-500">Please contact the company recruiter to start the assessment.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Active Role Description Panel */}
                <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-2xl p-4.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1 bg-indigo-100 text-indigo-750 rounded-lg shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-650 fill-indigo-200" />
                    </span>
                    <span className="text-[10px] font-bold text-indigo-800 tracking-wider uppercase font-display">Active Hiring Position</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-display font-extrabold text-slate-805 leading-snug">{activeCampaign.title}</h4>
                    <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-medium font-display">
                      <span>{activeCampaign.department}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-350" />
                      <span>{activeCampaign.experience || 'All experience levels'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal pt-2 border-t border-indigo-100/30">
                      {activeCampaign.description}
                    </p>
                  </div>
                </div>

                {/* Candidate Credentials Input Form */}
                <form onSubmit={handleCandidateSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Enter Your Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="Alex Rivera"
                        value={candName}
                        onChange={(e) => setCandName(e.target.value)}
                        className="w-full pl-11 pr-4.5 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 bg-white shadow-sm transition-all placeholder:text-slate-450"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Enter Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                      <input
                        type="email"
                        required
                        placeholder="alex.rivera@example.com"
                        value={candEmail}
                        onChange={(e) => setCandEmail(e.target.value)}
                        className="w-full pl-11 pr-4.5 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 bg-white shadow-sm transition-all placeholder:text-slate-450"
                      />
                    </div>
                  </div>

                  {candidateError && (
                    <p className="text-xs text-rose-500 font-semibold">{candidateError}</p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-2xl text-[11px] font-display font-medium tracking-wider uppercase transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(79,70,229,0.25)] hover:shadow-[0_6px_16px_rgba(79,70,229,0.35)]"
                  >
                    <UserCheck className="w-4 h-4" /> Start Oral Interview <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        )}

      </div>

    </div>
  );
}
