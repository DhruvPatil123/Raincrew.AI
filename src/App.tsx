import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, AlertCircle, HelpCircle, Laptop, AudioLines, Eye, LogOut, Sun, Moon } from 'lucide-react';
import { Campaign, Candidate, AppStats, RecruiterSession } from './types';
import { 
  getCampaigns, getCandidates, getStats, deleteCampaign, 
  addCampaign, initializeStorage, startServerSync, fetchBrandingServer 
} from './lib/storage';

// Component imports
import Dashboard from './components/Dashboard';
import CampaignWizard from './components/CampaignWizard';
import CampaignDetails from './components/CampaignDetails';
import CandidateReport from './components/CandidateReport';
import InterviewRoom from './components/InterviewRoom';
import RoleSelection from './components/RoleSelection';
import CandidateDashboard from './components/CandidateDashboard';
import { ConfirmModal } from './components/ConfirmModal';

export default function App() {
  // Navigation: 'dashboard' | 'wizard' | 'details' | 'report' | 'interview' | 'candidate-dashboard'
  const [view, setView] = useState<'dashboard' | 'wizard' | 'details' | 'report' | 'interview' | 'candidate-dashboard'>('dashboard');
  
  // Recruiter Session State
  const [session, setSession] = useState<RecruiterSession | null>(() => {
    try {
      const saved = localStorage.getItem('foloup_recruiter_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // User Role control: null, 'recruiter', or 'candidate'
  const [currentUserRole, setCurrentUserRole] = useState<'recruiter' | 'candidate' | null>(() => {
    try {
      const saved = localStorage.getItem('foloup_recruiter_session');
      return saved ? 'recruiter' : null;
    } catch {
      return null;
    }
  });

  // Custom ConfirmModal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDanger: false,
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void, isDanger = false, confirmText = 'Confirm') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      isDanger,
      confirmText,
    });
  };

  // Data State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>(() => {
    return localStorage.getItem('foloup_active_campaign_id') || 'camp-1';
  });
  const [candidateName, setCandidateName] = useState<string>('');
  const [candidateEmail, setCandidateEmail] = useState<string>('');

  const [stats, setStats] = useState<AppStats>({
    totalCampaigns: 0,
    totalCandidates: 0,
    completionRate: 0,
    averageScore: 0
  });

  // Selected contexts
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [interviewCampaign, setInterviewCampaign] = useState<Campaign | null>(null);
  const [interviewCandidateId, setInterviewCandidateId] = useState<string | undefined>(undefined);

  const [branding, setBranding] = useState<any>({
    appName: 'Raincrew.AI',
    logoUrl: '/logo.svg',
    companyName: 'Raincrew.AI Sandbox Technologies',
    themeColor: '#0ea5e9'
  });

  const [isAnonymousMode, setIsAnonymousMode] = useState<boolean>(() => {
    return localStorage.getItem('foloup_anonymous_mode') === 'true';
  });

  const handleToggleAnonymousMode = () => {
    const nextValue = !isAnonymousMode;
    setIsAnonymousMode(nextValue);
    localStorage.setItem('foloup_anonymous_mode', String(nextValue));
  };

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('foloup_dark_mode') === 'true';
  });

  const handleToggleDarkMode = () => {
    const nextVal = !darkMode;
    setDarkMode(nextVal);
    localStorage.setItem('foloup_dark_mode', String(nextVal));
    if (nextVal) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Sync state with HTML document element on load
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // App initialization and loading
  useEffect(() => {
    // Migrate old cached labels in localStorage to prevent displaying old FoloUp text to returning users
    try {
      const storedComp = localStorage.getItem('recruiter_company');
      if (storedComp && (storedComp.includes('FoloUp') || storedComp.includes('Untitled'))) {
        localStorage.setItem('recruiter_company', 'Raincrew.AI Sandbox Technologies');
      }
      const storedEmail = localStorage.getItem('recruiter_email');
      if (storedEmail && storedEmail.includes('foloup.ai')) {
        localStorage.setItem('recruiter_email', 'recruiter@raincrew.ai');
      }
    } catch (e) {
      console.warn("Failed to migrate localStorage legacy values", e);
    }

    initializeStorage();
    reloadData();

    // Check for Deep Link parameters (e.g. ?campaignId=camp-1) for candidates
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const verifyEmail = params.get('email');

    if (token) {
      fetch(`/api/auth/magic-link-verify?token=${token}&email=${encodeURIComponent(verifyEmail || '')}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            handleSelectRole('recruiter', undefined, undefined, undefined, {
              email: data.user.email,
              name: data.user.name,
              provider: 'magic-link',
              organization: data.user.organization,
              workspaceId: data.user.workspaceId,
              token: data.session.token
            });
            // Clean browser state
            try {
              const cleanUrl = window.location.protocol + "//" + window.location.host + "/";
              window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
            } catch (err) {
              console.warn("Failed to clean browser state history", err);
            }
          }
        })
        .catch(err => {
          console.error("Error verifying magic link session token", err);
        });
    }

    const urlCampaignId = params.get('campaignId') || params.get('campId');
    const urlCandidateId = params.get('candidateId') || undefined;
    const urlName = params.get('name') || '';
    const urlEmail = params.get('email') || '';

    if (urlCampaignId) {
      const activeCampaigns = getCampaigns();
      const matched = activeCampaigns.find(c => c.id === urlCampaignId);
      if (matched) {
        if (urlName) setCandidateName(urlName);
        if (urlEmail) setCandidateEmail(urlEmail);
        setInterviewCampaign(matched);
        setInterviewCandidateId(urlCandidateId);
        setCurrentUserRole('candidate');
        setView('interview');

        // Clean up parameters from the address bar so refresh works correctly
        try {
          const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        } catch (err) {
          console.warn("Failed to clean browser state history", err);
        }
      }
    }
  }, []);

  // Listen for background DB updates
  useEffect(() => {
    const onDbUpdate = () => {
      reloadData();
    };
    window.addEventListener('foloup_db_update', onDbUpdate);
    return () => {
      window.removeEventListener('foloup_db_update', onDbUpdate);
    };
  }, []);

  const reloadData = () => {
    setCampaigns(getCampaigns());
    setCandidates(getCandidates());
    setStats(getStats());
    fetchBrandingServer()
      .then(cfg => {
        if (cfg) {
          setBranding({
            appName: cfg.appName || '',
            logoUrl: cfg.logoUrl || '',
            companyName: cfg.companyName || 'FoloUp Sandbox Technologies',
            themeColor: cfg.themeColor || '#4f46e5'
          });
        }
      })
      .catch(err => console.error("Error loading branding from server in App", err));
  };

  const handleSelectRole = (
    role: 'recruiter' | 'candidate', 
    initialCampaignId?: string, 
    candName?: string, 
    candEmail?: string,
    recruiterSession?: RecruiterSession
  ) => {
    if (role === 'recruiter') {
      const finalSession = recruiterSession || {
        email: 'recruiter@foloup.ai',
        name: 'Eleanor Vance',
        provider: 'magic-link' as const,
        organization: 'Sandbox Workspace',
        workspaceId: 'sandbox'
      };
      setSession(finalSession);
      localStorage.setItem('foloup_recruiter_session', JSON.stringify(finalSession));
      setCurrentUserRole('recruiter');
      setView('dashboard');
      // Sync fresh items in the background
      setTimeout(() => startServerSync(true), 100);
    } else {
      setCurrentUserRole(role);
      if (candName) setCandidateName(candName);
      if (candEmail) setCandidateEmail(candEmail);
      if (initialCampaignId) {
        const storedCampaigns = getCampaigns();
        const matched = storedCampaigns.find(c => c.id === initialCampaignId);
        if (matched) {
          setInterviewCampaign(matched);
        }
      }
      setView('candidate-dashboard');
    }
  };

  const handleSetActiveCampaign = (campId: string) => {
    setActiveCampaignId(campId);
    localStorage.setItem('foloup_active_campaign_id', campId);
  };

  const handleCreateCampaign = (newCamp: Omit<Campaign, 'id' | 'createdAt' | 'candidateCount'>) => {
    addCampaign(newCamp);
    reloadData();
    setView('dashboard');
  };

  const handleDeleteCampaign = (campId: string) => {
    deleteCampaign(campId);
    reloadData();
  };

  const handleLaunchCampaignInterview = (campaign: Campaign, candidateId?: string) => {
    setInterviewCampaign(campaign);
    setInterviewCandidateId(candidateId);
    setView('interview');
  };

  const handleFinishInterview = () => {
    reloadData();
    if (currentUserRole === 'candidate') {
      setView('candidate-dashboard');
    } else {
      if (selectedCampaign) {
        // Return to details of campaign
        const updatedCampaigns = getCampaigns();
        const updatedSelectedCampaign = updatedCampaigns.find(c => c.id === selectedCampaign.id) || selectedCampaign;
        setSelectedCampaign(updatedSelectedCampaign);
        setView('details');
      } else {
        setView('dashboard');
      }
    }
  };

  // Safe Back transitions
  const handleBackToDashboard = () => {
    reloadData();
    if (currentUserRole === 'candidate') {
      setView('candidate-dashboard');
    } else {
      setView('dashboard');
    }
    setSelectedCampaign(null);
  };

  const handleBackToCampaign = () => {
    reloadData();
    if (currentUserRole === 'candidate') {
      setView('candidate-dashboard');
      setSelectedCandidate(null);
    } else {
      setView('details');
      setSelectedCandidate(null);
    }
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col antialiased transition-colors duration-200 ${
      darkMode ? 'bg-slate-950 text-slate-100 dark' : 'bg-[#f8fafc] text-slate-800'
    }`}>
      
      {/* Pristine Minimal Header bar */}
      <header className={`border-b backdrop-blur-md py-4 px-6 md:px-8 sticky top-0 z-40 transition-colors duration-200 shadow-[0_2px_15px_rgba(15,23,42,0.015)] no-print ${
        darkMode ? 'bg-slate-900/85 border-slate-800' : 'bg-white/80 border-slate-100'
      }`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div 
            onClick={() => currentUserRole === 'recruiter' && handleBackToDashboard()}
            className={`flex items-center gap-2.5 group ${currentUserRole === 'recruiter' ? 'cursor-pointer' : 'cursor-default select-none'}`}
          >
            {branding.logoUrl ? (
              <img 
                src={branding.logoUrl} 
                className="h-8 max-w-[120px] object-contain rounded-lg" 
                alt="Logo" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="p-2 bg-gradient-to-tr from-indigo-650 to-indigo-500 rounded-xl text-white group-hover:from-indigo-600 group-hover:to-indigo-400 hover:scale-[1.05] transition-all shadow-[0_4px_14px_rgba(99,102,241,0.28)] flex items-center justify-center">
                <AudioLines className="w-5 h-5 text-indigo-50" />
              </div>
            )}
            <span className={`text-xl font-display font-extrabold tracking-tight ${
              darkMode ? 'text-white' : 'text-slate-900'
            }`}>
              {branding.appName ? (
                <span>{branding.appName}</span>
              ) : (
                <>Folo<span className="text-indigo-600 font-black">Up</span></>
              )}
            </span>
            <span className="text-[10px] font-bold tracking-wider text-indigo-700 bg-indigo-50/70 border border-indigo-100/50 px-2 py-0.5 rounded-lg uppercase ml-2 select-none md:inline hidden font-display">AI Recruiting Platform</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            {currentUserRole === 'recruiter' && (
              <>
                {/* Workspace Switcher Component for Recruiters */}
                {session && (
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold py-1 px-2.5 rounded-xl border font-display hidden xl:inline-block ${
                      darkMode ? 'bg-indigo-950/20 text-indigo-400 border-indigo-900/30' : 'bg-indigo-50/60 text-indigo-700 border-indigo-100/50'
                    }`}>
                      🏢 {session.organization}
                    </span>
                    <select
                      value={session.workspaceId}
                      onChange={(e) => {
                        const ws = e.target.value;
                        const orgName = ws === 'sandbox' 
                          ? 'Sandbox Workspace' 
                          : `${ws.split('.')[0].charAt(0).toUpperCase() + ws.split('.')[0].slice(1)} Group`;
                        const updated: RecruiterSession = {
                          ...session,
                          workspaceId: ws,
                          organization: orgName
                        };
                        setSession(updated);
                        localStorage.setItem('foloup_recruiter_session', JSON.stringify(updated));
                        // Flash reload
                        startServerSync(true);
                      }}
                      className={`text-[10px] uppercase tracking-wider font-extrabold font-display border py-1.5 px-3 rounded-xl shadow-xs cursor-pointer focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all ${
                        darkMode ? 'bg-slate-850 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-702'
                      }`}
                      title="Switch Tenanted Recruiter Workspace isolation domain"
                    >
                      <option value="sandbox">Sandbox Env</option>
                      <option value="stripe.com">Stripe Space</option>
                      <option value="netflix.com">Netflix Digital</option>
                      <option value="google.com">Google Enterprise</option>
                      <option value="github.com">GitHub Labs</option>
                    </select>
                  </div>
                )}

                <button 
                  onClick={handleToggleAnonymousMode}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] uppercase tracking-wider font-extrabold cursor-pointer transition-all ${
                    isAnonymousMode 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                      : darkMode 
                        ? 'bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                  title="Toggle Anonymous Review Mode to hide candidate names and emails for bias-free grading"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {isAnonymousMode ? 'Anonymous ON' : 'Anonymous Mode'}
                </button>

                <button 
                  onClick={handleBackToDashboard}
                  className={`hover:text-indigo-500 transition-colors cursor-pointer font-bold ${
                    view === 'dashboard' ? 'text-indigo-500' : darkMode ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Dashboard
                </button>
              </>
            )}

            {currentUserRole === 'candidate' && (
              <span className="text-slate-400 font-bold md:inline hidden uppercase tracking-wider font-mono text-[10px]">Candidate Assessment Board</span>
            )}

            {currentUserRole !== null && (
              <>
                <div className={`h-4 w-px ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <button 
                  onClick={() => {
                    if (currentUserRole === 'candidate') {
                      if (view === 'interview') {
                        triggerConfirm(
                          "Exit Screening Session",
                          "Are you sure you want to exit the active screening session? Progress on active answers will not be scored.",
                          () => {
                            setView('candidate-dashboard');
                          },
                          true,
                          "Exit Session"
                        );
                      } else {
                        triggerConfirm(
                          "Log Out",
                          "Are you sure you want to sign out from your Candidate Board?",
                          () => {
                            setCurrentUserRole(null);
                            setView('dashboard');
                          },
                          false,
                          "Log Out"
                        );
                      }
                    } else {
                      triggerConfirm(
                        "Sign Out",
                        "Are you sure you want to log out from the Recruiter Workspace?",
                        () => {
                          localStorage.removeItem('foloup_recruiter_session');
                          setSession(null);
                          setCurrentUserRole(null);
                          setView('dashboard');
                          setTimeout(() => startServerSync(true), 120);
                        },
                        false,
                        "Sign Out"
                      );
                    }
                  }}
                  className={`flex items-center gap-1.5 hover:text-rose-600 transition-all font-bold border py-1.5 px-3 rounded-xl shadow-xs cursor-pointer ${
                    darkMode 
                      ? 'bg-slate-850 border-slate-700 hover:bg-rose-950/20 text-slate-300' 
                      : 'bg-slate-50 border-slate-100 hover:bg-rose-50/55 text-slate-500'
                  }`}
                  title="Abandon Session or Log Out"
                >
                  <LogOut className="w-3.5 h-3.5" /> {currentUserRole === 'candidate' && view !== 'interview' ? 'Log Out' : 'Sign Out'}
                </button>
              </>
            )}

            <button
              onClick={handleToggleDarkMode}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                darkMode 
                  ? 'bg-slate-850 border-slate-700 text-amber-400 hover:bg-slate-800' 
                  : 'bg-slate-50 border-slate-200 text-slate-550 hover:bg-slate-100 hover:text-slate-800'
              }`}
              title="Toggle Theme Light/Dark Appearance"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className={`h-4 w-px ${darkMode ? 'bg-slate-800' : 'bg-slate-200'} md:block hidden`} />
            <div className={`flex items-center gap-1.5 font-display font-bold text-[10px] tracking-wider px-2.5 py-1 rounded-full border select-none ${
              darkMode 
                ? 'text-emerald-400 bg-emerald-950/20 border-emerald-900/50' 
                : 'text-emerald-700 bg-emerald-50/60 border-emerald-100'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Service Online
            </div>
          </div>
        </div>
      </header>

      {/* Main interactive viewport container */}
      <main className="flex-1 px-8 py-8">
        <AnimatePresence mode="wait">
          
          {currentUserRole === null ? (
            <motion.div
              key="role-selection"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <RoleSelection
                onSelectRole={handleSelectRole}
                campaigns={campaigns}
                activeCampaignId={activeCampaignId}
                branding={branding}
              />
            </motion.div>
          ) : (
            <>
              {/* VIEW: Recruiter Campaigns Dashboard */}
              {view === 'dashboard' && currentUserRole === 'recruiter' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Dashboard
                    campaigns={campaigns}
                    stats={stats}
                    candidates={candidates}
                    onCreateNewCampaign={() => setView('wizard')}
                    onSelectCampaign={(camp) => {
                      setSelectedCampaign(camp);
                      setView('details');
                    }}
                    onLaunchInterview={(camp) => handleLaunchCampaignInterview(camp)}
                    onDeleteCampaign={handleDeleteCampaign}
                    activeCampaignId={activeCampaignId}
                    onSetActiveCampaign={handleSetActiveCampaign}
                    onViewReport={(subCand, subCamp) => {
                      setSelectedCandidate(subCand);
                      setSelectedCampaign(subCamp);
                      setView('report');
                    }}
                    isAnonymousMode={isAnonymousMode}
                  />
                </motion.div>
              )}

              {/* VIEW: New Campaign Creation Wizard */}
              {view === 'wizard' && currentUserRole === 'recruiter' && (
                <motion.div
                  key="wizard"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <CampaignWizard
                    onBack={handleBackToDashboard}
                    onSave={handleCreateCampaign}
                  />
                </motion.div>
              )}

              {/* VIEW: Campaign Details Pipeline & Table */}
              {view === 'details' && selectedCampaign && currentUserRole === 'recruiter' && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <CampaignDetails
                    campaign={selectedCampaign}
                    candidates={candidates.filter(c => c.campaignId === selectedCampaign.id)}
                    onBack={handleBackToDashboard}
                    onOpenReport={(cand) => {
                      setSelectedCandidate(cand);
                      setView('report');
                    }}
                    onLaunchInterview={(candId) => handleLaunchCampaignInterview(selectedCampaign, candId)}
                    onRefresh={reloadData}
                    isAnonymousMode={isAnonymousMode}
                  />
                </motion.div>
              )}

              {/* VIEW: Detailed Candidate Evaluation report */}
              {view === 'report' && selectedCandidate && selectedCampaign && (
                <motion.div
                  key="report"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <CandidateReport
                    candidate={selectedCandidate}
                    campaign={selectedCampaign}
                    onBack={handleBackToCampaign}
                    isAnonymousMode={isAnonymousMode}
                  />
                </motion.div>
              )}

              {/* VIEW: Candidate Dashboard */}
              {view === 'candidate-dashboard' && currentUserRole === 'candidate' && (
                <motion.div
                  key="candidate-dashboard"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <CandidateDashboard
                    candidateName={candidateName}
                    candidateEmail={candidateEmail}
                    campaigns={campaigns}
                    candidates={candidates}
                    onStartInterview={(camp, candId) => {
                      setInterviewCampaign(camp);
                      setInterviewCandidateId(candId);
                      setView('interview');
                    }}
                    onLogout={() => {
                      setCurrentUserRole(null);
                      setView('dashboard');
                    }}
                    onViewReport={(subCand, subCamp) => {
                      setSelectedCandidate(subCand);
                      setSelectedCampaign(subCamp);
                      setView('report');
                    }}
                    onRefresh={reloadData}
                  />
                </motion.div>
              )}

              {/* VIEW: Oral browser-based candidates interview room */}
              {view === 'interview' && interviewCampaign && (
                <motion.div
                  key="interview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <InterviewRoom
                    campaign={interviewCampaign}
                    candidateId={interviewCandidateId}
                    initialName={candidateName}
                    initialEmail={candidateEmail}
                    onCompleted={handleFinishInterview}
                    onCancel={() => {
                      triggerConfirm(
                        "Quit Interview Room",
                        "Are you sure you want to exit the interview session? Progress on active answers will not be registered or scored.",
                        () => {
                          if (currentUserRole === 'candidate') {
                            setView('candidate-dashboard');
                          } else {
                            setView(selectedCampaign ? 'details' : 'dashboard');
                          }
                        },
                        true,
                        "Quit Session"
                      );
                    }}
                    isCandidateOnly={currentUserRole === 'candidate'}
                  />
                </motion.div>
              )}
            </>
          )}

        </AnimatePresence>
      </main>

      {/* Pristine Modern Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 font-medium no-print">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 px-8">
          <p>© {new Date().getFullYear()} Raincrew.AI. Powered securely by Gemini 3.5 Flash.</p>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><Laptop className="w-3.5 h-3.5" /> High-Performance Vetting Node</span>
          </div>
        </div>
      </footer>

      {/* Global Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        isDanger={confirmModal.isDanger}
        confirmText={confirmModal.confirmText}
      />
    </div>
  );
}
