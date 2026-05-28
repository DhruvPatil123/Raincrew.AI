export interface Campaign {
  id: string;
  title: string;
  department: string;
  description: string;
  experience: string;
  questions: string[];
  createdAt: string;
  candidateCount: number;
  weights?: {
    technical: number;
    architecture: number;
    communication: number;
  };
  voiceSex?: 'male' | 'female';
  sttEngine?: 'deepgram' | 'assemblyai' | 'whisper';
  enableMediaPipeCameraProctor?: boolean;
  gdprConsentTextOverride?: string;
}

export interface TranscriptTurn {
  id: string;
  speaker: 'AI' | 'Candidate';
  text: string;
  timestamp: string;
}

export interface DetailedScore {
  criteria: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface QnAPairEvaluation {
  question: string;
  answer: string;
  rating: number; // 0-100
  feedback: string;
}

export interface DeliveryMetrics {
  fillerWords: Record<string, number>;
  totalFillers: number;
  wpm: number;
  clarityLevel: 'Excellent' | 'Good' | 'Moderate' | 'Needs Improvement';
  overallPacing: string;
}

export interface MissingSkill {
  skillName: string;
  importance: 'High' | 'Medium' | 'Low';
  gapDescription: string;
}

export interface LearningResource {
  title: string;
  type: 'Course' | 'Book' | 'Article' | 'Documentation' | 'Video';
  url: string;
  description: string;
}

export interface Candidate {
  id: string;
  campaignId: string;
  name: string;
  email: string;
  phone: string;
  status: 'Pending' | 'In-Progress' | 'Completed' | 'Evaluated' | 'Applied' | 'Interviewing' | 'Hired' | 'Rejected';
  appliedDate: string;
  duration: string;
  score: number; // 0-100 overall
  overallEvaluation: string;
  fitCategory?: 'Hire' | 'Shortlist' | 'Reject';
  strengths: string[];
  weaknesses: string[];
  transcript?: TranscriptTurn[];
  detailedScores?: DetailedScore[];
  qnaPairs?: QnAPairEvaluation[];
  consentAgreedTime?: string;
  gdprCompliantMode?: boolean;
  tabSwitchCount?: number;
  longSilenceCount?: number;
  suspiciousVoiceNoise?: boolean;
  fullscreenExitCount?: number;
  screenChangeCount?: number;
  spokenLanguage?: string;
  deliveryMetrics?: DeliveryMetrics;
  skillsGap?: MissingSkill[];
  learningResources?: LearningResource[];
  followUpFocusAreas?: string[];
  recruiterComments?: CandidateComment[];
  interviewScheduledDate?: string;
  interviewEventLink?: string;
  interviewMeetLink?: string;
  interviewStatus?: 'Not Scheduled' | 'Confirmed';
}

export interface CandidateComment {
  id: string;
  author: string;
  role: 'Recruiter' | 'Hiring Manager' | 'Lead Engineer' | 'Team Member';
  text: string;
  timestamp: string;
  annotations?: string[];
}

export interface AppStats {
  totalCampaigns: number;
  totalCandidates: number;
  completionRate: number;
  averageScore: number;
}

export interface RecruiterSession {
  email: string;
  name: string;
  provider: 'google' | 'github' | 'magic-link';
  organization: string;
  workspaceId: string;
  token?: string;
}

export function maskName(name: string, isAnonymous: boolean) {
  if (!isAnonymous) return name;
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `Candidate #${100 + (hash % 900)}`;
}

export function maskEmail(email: string, isAnonymous: boolean) {
  if (!isAnonymous) return email;
  const parts = email.split('@');
  if (parts.length !== 2) return 'xxx@xxxx.com';
  return parts[0].substring(0, 1) + '***@' + parts[1];
}

export function maskPhone(phone: string | undefined, isAnonymous: boolean) {
  if (!isAnonymous) return phone || '';
  if (!phone) return '';
  return phone.replace(/\d/g, '*');
}
