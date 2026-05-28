import { Campaign, Candidate, AppStats } from '../types';

const CAMPAIGNS_KEY = 'foloup_campaigns';
const CANDIDATES_KEY = 'foloup_candidates';

const DEFAULT_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-1',
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    description: 'We are looking for a Senior Frontend Engineer proficient in React, Tailwind CSS, TypeScript, and state management systems. The candidate should have experience optimizing rendering speed and leading UI architectural design.',
    experience: '5+ years',
    questions: [
      'Tell me about a complex React component or dashboard you built. What architectural decisions did you make and why?',
      'How do you approach optimizing performance in a React application that is experiencing slow renders?',
      'What is your preferred state management pattern for a large-scale enterprise application, and what are its trade-offs?',
      'How do you handle UI styling for responsive architectures, especially with tools like Tailwind CSS?'
    ],
    createdAt: '2026-05-10T14:30:00Z',
    candidateCount: 4
  },
  {
    id: 'camp-2',
    title: 'Corporate Sales Representative',
    department: 'Sales & Growth',
    description: 'Looking for an enthusiastic sales representative to drive pipeline growth, demonstrate B2B product suites, handle client objections, and secure subscription licenses.',
    experience: '2-4 years',
    questions: [
      'Walk me through a successful B2B deal you closed. What was your strategy from contact to signatures?',
      'How do you handle a strong objection from a prospective customer saying our solution is too expensive?',
      'How do you qualify a warm lead to ensure you are prioritizing high-impact accounts?',
      'What motivates you to hit quotas under high-pressure scenarios?'
    ],
    createdAt: '2026-05-18T09:12:00Z',
    candidateCount: 2
  }
];

const DEFAULT_CANDIDATES: Candidate[] = [
  {
    id: 'cand-1',
    campaignId: 'camp-1',
    name: 'Alex Rivera',
    email: 'alex.rivera@gmail.com',
    phone: '+1 (555) 342-9988',
    status: 'Evaluated',
    appliedDate: '2026-05-12T10:15:00Z',
    duration: '6m 22s',
    score: 92,
    fitCategory: 'Hire',
    overallEvaluation: 'Alex showed exceptional technical depth in React rendering performance, deep understanding of fiber trees, and practical architecture patterns. He balanced senior leadership logic with hands-on knowledge of modern CSS and typing systems.',
    strengths: [
      'Deep architectural knowledge of React internals, scheduling, and rendering cycles.',
      'Excellent performance profiling skills, identifying unnecessary state triggers.',
      'Highly professional presentation and logical communication.'
    ],
    weaknesses: [
      'Tended to overcomplicate state patterns for simple forms rather than defaulting to local mechanisms.'
    ],
    transcript: [],
    detailedScores: [
      { criteria: 'Technical Depth', score: 95, maxScore: 100, feedback: 'alex exhibited comprehensive mastery over the React fiber model, memory footprints, and optimization strategies.' },
      { criteria: 'Architectural Style', score: 92, maxScore: 100, feedback: 'Strong architectural discipline, utilizing decoupled state stores and optimized interval updates.' },
      { criteria: 'Communication & Culture', score: 90, maxScore: 100, feedback: 'Articulate, descriptive, and very professional verbal expression.' }
    ],
    qnaPairs: [],
    consentAgreedTime: '2026-05-12T10:10:00Z',
    gdprCompliantMode: true,
    tabSwitchCount: 0,
    longSilenceCount: 0,
    suspiciousVoiceNoise: false,
    fullscreenExitCount: 0,
    screenChangeCount: 0,
    spokenLanguage: 'English (US Accent)',
    deliveryMetrics: {
      totalFillers: 3,
      wpm: 125,
      clarityLevel: 'Excellent',
      overallPacing: 'Balanced & Fluent (125 WPM)',
      fillerWords: { "um": 1, "like": 2 }
    },
    skillsGap: [
      {
        skillName: 'Local Context Mastery vs. Heavy Store Over-Reliance',
        importance: 'Medium',
        gapDescription: 'Alex Rivera tends to default to massive global/modular state architectures (such as Redux/Zustand) even for simple, localized forms that could be served efficiently with raw React useState or Native HTML FormDatas, leading to potential boilerplate bloat.'
      },
      {
        skillName: 'Enterprise React Server Components (RSC)',
        importance: 'Low',
        gapDescription: 'Lacks explicit mention of advanced Server Action lifecycle integration, cache tags, or hydration debugging strategies for Next.js 14+ layouts.'
      }
    ],
    learningResources: [
      {
        title: 'Simplifying React Forms with uncontrolled inputs',
        type: 'Documentation',
        url: 'https://react.dev/reference/react-dom/components/input',
        description: 'React official guidelines on managing HTML forms with local state, form-actions, and lightweight uncontrolled components.'
      },
      {
        title: 'Next.js App Router Architecture Guide',
        type: 'Course',
        url: 'https://nextjs.org/learn',
        description: 'Comprehensive walkthrough of Server Components, hydration boundaries, and optimizing backend data fetching pipelines.'
      }
    ],
    followUpFocusAreas: [
      'Ask Alex to refactor a complex nested form to rely solely on browser-native HTML5 APIs and FormData in a follow-up interactive session.',
      'Assess their knowledge on the React Server Components hydration model, specifically distinguishing Server actions vs client triggers.'
    ]
  }
];

// ==========================================
// 🔄 ASYNC FULL-STACK SYNCHRONIZATION ENGINE
// ==========================================

export function getWorkspaceId(): string {
  try {
    const saved = localStorage.getItem('foloup_recruiter_session');
    if (saved) {
      const session = JSON.parse(saved);
      return session.workspaceId || 'sandbox';
    }
  } catch {}
  return 'sandbox';
}

export function getHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const wsId = getWorkspaceId();
  return {
    'X-Workspace-Id': wsId,
    ...extra
  };
}

export function startServerSync(forceClear: boolean = false): void {
  if (forceClear) {
    localStorage.removeItem(CAMPAIGNS_KEY);
    localStorage.removeItem(CANDIDATES_KEY);
    initializeStorage();
  }

  // Sync campaigns
  fetch('/api/campaigns', { headers: getHeaders() })
    .then(r => {
      if (!r.ok) throw new Error('Failed to fetch campaigns from Firestore server');
      return r.json();
    })
    .then(data => {
      if (Array.isArray(data)) {
        localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(data));
        window.dispatchEvent(new Event('foloup_db_update'));
      }
    })
    .catch(console.error);

  // Sync candidates
  fetch('/api/candidates', { headers: getHeaders() })
    .then(r => {
      if (!r.ok) throw new Error('Failed to fetch candidates from Firestore server');
      return r.json();
    })
    .then(data => {
      if (Array.isArray(data)) {
        localStorage.setItem(CANDIDATES_KEY, JSON.stringify(data));
        window.dispatchEvent(new Event('foloup_db_update'));
      }
    })
    .catch(console.error);
}

// Automatically trigger sync on load
if (typeof window !== 'undefined') {
  setTimeout(() => startServerSync(), 500);
}

export function initializeStorage(): void {
  const wsId = getWorkspaceId();
  if (wsId === 'sandbox') {
    if (!localStorage.getItem(CAMPAIGNS_KEY)) {
      localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(DEFAULT_CAMPAIGNS));
    }
    if (!localStorage.getItem(CANDIDATES_KEY)) {
      localStorage.setItem(CANDIDATES_KEY, JSON.stringify(DEFAULT_CANDIDATES));
    }
  } else {
    if (!localStorage.getItem(CAMPAIGNS_KEY)) {
      localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(CANDIDATES_KEY)) {
      localStorage.setItem(CANDIDATES_KEY, JSON.stringify([]));
    }
  }
}

export function getCampaigns(): Campaign[] {
  initializeStorage();
  try {
    const list: Campaign[] = JSON.parse(localStorage.getItem(CAMPAIGNS_KEY) || '[]');
    return list.map(c => ({
      ...c,
      weights: c.weights || { technical: 40, architecture: 30, communication: 30 },
      voiceSex: c.voiceSex || 'female',
      sttEngine: c.sttEngine || 'deepgram',
      enableMediaPipeCameraProctor: c.enableMediaPipeCameraProctor ?? true,
      gdprConsentTextOverride: c.gdprConsentTextOverride || ''
    }));
  } catch (e) {
    return getWorkspaceId() === 'sandbox' ? DEFAULT_CAMPAIGNS.map(c => ({
      ...c,
      weights: c.weights || { technical: 40, architecture: 30, communication: 30 },
      voiceSex: c.voiceSex || 'female',
      sttEngine: c.sttEngine || 'deepgram',
      enableMediaPipeCameraProctor: c.enableMediaPipeCameraProctor ?? true,
      gdprConsentTextOverride: c.gdprConsentTextOverride || ''
    })) : [];
  }
}

export function saveCampaigns(campaigns: Campaign[]): void {
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(campaigns));
}

export function getCandidates(): Candidate[] {
  initializeStorage();
  try {
    return JSON.parse(localStorage.getItem(CANDIDATES_KEY) || '[]');
  } catch (e) {
    return getWorkspaceId() === 'sandbox' ? DEFAULT_CANDIDATES : [];
  }
}

export function saveCandidates(candidates: Candidate[]): void {
  localStorage.setItem(CANDIDATES_KEY, JSON.stringify(candidates));
}

// Write mutation to server and log audit
export function addCampaign(campaign: Omit<Campaign, 'id' | 'createdAt' | 'candidateCount'>): Campaign {
  const campaigns = getCampaigns();
  const idValue = `camp-${Date.now()}`;
  const newCampaign: Campaign = {
    ...campaign,
    id: idValue,
    createdAt: new Date().toISOString(),
    candidateCount: 0
  };
  campaigns.unshift(newCampaign);
  saveCampaigns(campaigns);

  // Background DB save
  fetch('/api/campaigns', {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(newCampaign)
  }).catch(console.error);

  return newCampaign;
}

export function addCandidate(candidate: Omit<Candidate, 'id' | 'appliedDate' | 'status' | 'duration' | 'score' | 'overallEvaluation' | 'strengths' | 'weaknesses' | 'fitCategory'>): Candidate {
  const candidates = getCandidates();
  const campaigns = getCampaigns();
  
  const idValue = `cand-${Date.now()}`;
  const newCandidate: Candidate = {
    ...candidate,
    id: idValue,
    appliedDate: new Date().toISOString(),
    status: 'Pending',
    duration: '--',
    score: 0,
    overallEvaluation: 'Candidate invited to screening. Interview pending.',
    strengths: [],
    weaknesses: []
  };
  
  candidates.unshift(newCandidate);
  saveCandidates(candidates);
  
  // Update candidate count on campaign locally
  const updatedCampaigns = campaigns.map(c => {
    if (c.id === candidate.campaignId) {
      return { ...c, candidateCount: (c.candidateCount || 0) + 1 };
    }
    return c;
  });
  saveCampaigns(updatedCampaigns);

  // Background DB sync
  fetch('/api/candidates', {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(newCandidate)
  }).catch(console.error);
  
  return newCandidate;
}

export function deleteCampaign(id: string): void {
  const campaigns = getCampaigns().filter(c => c.id !== id);
  const candidates = getCandidates().filter(cand => cand.campaignId !== id);
  saveCampaigns(campaigns);
  saveCandidates(candidates);

  // Background DB sync
  fetch(`/api/campaigns/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  }).catch(console.error);
}

export function deleteCandidate(id: string): void {
  const candidates = getCandidates();
  const candidate = candidates.find(c => c.id === id);
  if (!candidate) return;

  const filteredCandidates = candidates.filter(c => c.id !== id);
  saveCandidates(filteredCandidates);

  // Update candidate count locally
  const campaigns = getCampaigns().map(c => {
    if (c.id === candidate.campaignId) {
      return { ...c, candidateCount: Math.max(0, (c.candidateCount || 1) - 1) };
    }
    return c;
  });
  saveCampaigns(campaigns);

  // Background DB sync
  fetch(`/api/candidates/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  }).catch(console.error);
}

export function updateCandidateEvaluation(
  candidateId: string,
  updates: Partial<Candidate>
): Candidate | null {
  const candidates = getCandidates();
  const index = candidates.findIndex(c => c.id === candidateId);
  if (index === -1) return null;
  
  const updatedCandidate: Candidate = {
    ...candidates[index],
    ...updates
  } as Candidate;
  
  candidates[index] = updatedCandidate;
  saveCandidates(candidates);

  // Background DB update
  fetch(`/api/candidates/${candidateId}`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates)
  }).catch(console.error);

  return updatedCandidate;
}

export function getStats(): AppStats {
  const campaigns = getCampaigns();
  const candidates = getCandidates();
  
  const evaluated = candidates.filter(c => c.status === 'Evaluated');
  const scored = evaluated.map(c => c.score).filter(s => s > 0);
  
  const averageScore = scored.length > 0 
    ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) 
    : 0;
    
  const completionRate = candidates.length > 0
    ? Math.round((candidates.filter(c => ['Completed', 'Evaluated'].includes(c.status)).length / candidates.length) * 100)
    : 0;

  return {
    totalCampaigns: campaigns.length,
    totalCandidates: candidates.length,
    completionRate,
    averageScore
  };
}

export function updateCampaignWeights(
  campaignId: string,
  weights: { technical: number; architecture: number; communication: number },
  voiceSex?: 'male' | 'female'
): Campaign | null {
  const campaigns = getCampaigns();
  const index = campaigns.findIndex(c => c.id === campaignId);
  if (index === -1) return null;

  campaigns[index] = {
    ...campaigns[index],
    weights,
    voiceSex: voiceSex || campaigns[index].voiceSex || 'female'
  };

  saveCampaigns(campaigns);

  // Background DB update
  fetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(campaigns[index])
  }).catch(console.error);

  return campaigns[index];
}

// ==========================================
// 🛡️ COMPLIANCE, NOTATIONS, AND BRANDING PORTAL
// ==========================================

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  operator: string;
  timestamp: string;
}

export async function fetchAuditLogsServer(): Promise<AuditLog[]> {
  try {
    const res = await fetch('/api/audit-logs');
    return res.ok ? await res.json() : [];
  } catch {
    return [
      { id: 'l1', action: 'OFFLINE_ERR', details: 'Audit logging system running locally.', operator: 'System', timestamp: new Date().toISOString() }
    ];
  }
}

export async function fetchEmailLogsServer(): Promise<any[]> {
  try {
    const res = await fetch('/api/emails');
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function dispatchSimulatedEmail(to: string, subject: string, template: string): Promise<boolean> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, template })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchBrandingServer(): Promise<any> {
  try {
    const res = await fetch('/api/branding', { headers: getHeaders() });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

export async function saveBrandingServer(config: any): Promise<any> {
  try {
    const res = await fetch('/api/branding', {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(config)
    });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

export async function addRecruiterCandidateNote(candidateId: string, note: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/recruiter-notes/${candidateId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function getRecruiterCandidateNotes(candidateId: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/recruiter-notes/${candidateId}`);
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}
