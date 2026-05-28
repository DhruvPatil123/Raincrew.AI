import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { WebSocketServer } from "ws";
import { createRequire } from "module";
const requireModule = createRequire(import.meta.url);
// @ts-ignore
const pdf = requireModule("pdf-parse");
import mammoth from "mammoth";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where, getDocFromServer } from "firebase/firestore";

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;

// ==========================================
// 💾 PERSISTENT DATABASE STORAGE ARCHITECTURE
// ==========================================
const DB_FILE = path.join(process.cwd(), "data", "database.json");

// Define structural schema for database persistence
interface DBStore {
  campaigns: any[];
  candidates: any[];
  auditLogs: any[];
  branding: {
    logoUrl?: string;
    appName?: string;
    companyName?: string;
    primaryColor?: string;
    gdprText?: string;
  };
  emailLogs: any[];
  recruiterNotes: Record<string, string[]>; // CandidateId -> notes array
}

// Initial fallback mock templates matching client defaults
const INITIAL_DATABASE: DBStore = {
  campaigns: [
    {
      id: "camp-1",
      title: "Senior Frontend Engineer",
      department: "Engineering",
      description: "We are looking for a Senior Frontend Engineer proficient in React, Tailwind CSS, TypeScript, and state management systems. The candidate should have experience optimizing rendering speed and leading UI architectural design.",
      experience: "5+ years",
      questions: [
        "Tell me about a complex React component or dashboard you built. What architectural decisions did you make and why?",
        "How do you approach optimizing performance in a React application that is experiencing slow renders?",
        "What is your preferred state management pattern for a large-scale enterprise application, and what are its trade-offs?",
        "How do you handle UI styling for responsive architectures, especially with tools like Tailwind CSS?"
      ],
      createdAt: "2026-05-10T14:30:00Z",
      candidateCount: 4
    },
    {
      id: "camp-2",
      title: "Corporate Sales Representative",
      department: "Sales & Growth",
      description: "Looking for an enthusiastic sales representative to drive pipeline growth, demonstrate B2B product suites, handle client objections, and secure subscription licenses.",
      experience: "2-4 years",
      questions: [
        "Walk me through a successful B2B deal you closed. What was your strategy from contact to signatures?",
        "How do you handle a strong objection from a prospective customer saying our solution is too expensive?",
        "How do you qualify a warm lead to ensure you are prioritizing high-impact accounts?",
        "What motivates you to hit quotas under high-pressure scenarios?"
      ],
      createdAt: "2026-05-18T09:12:00Z",
      candidateCount: 2
    }
  ],
  candidates: [
    {
      id: "cand-1",
      campaignId: "camp-1",
      name: "Alex Rivera",
      email: "alex.rivera@gmail.com",
      phone: "+1 (555) 342-9988",
      status: "Evaluated",
      appliedDate: "2026-05-12T10:15:00Z",
      duration: "6m 22s",
      score: 92,
      fitCategory: "Hire",
      overallEvaluation: "Alex showed exceptional technical depth in React rendering performance, deep understanding of fiber trees, and practical architecture patterns. He balanced senior leadership logic with hands-on knowledge of modern CSS and typing systems.",
      strengths: [
        "Deep architectural knowledge of React internals, scheduling, and rendering cycles.",
        "Excellent performance profiling skills, identifying unnecessary state triggers.",
        "Highly professional presentation and logical communication."
      ],
      weaknesses: [
        "Tended to overcomplicate state patterns for simple forms rather than defaulting to local mechanisms."
      ],
      transcript: [
        { id: "t-1", speaker: "AI", text: "Hey there Alex! Thanks for joining us today. Let's dive right in. To kick things off, tell me about a complex React component or dashboard you built. What architectural decisions did you make and why?", timestamp: "00:05" },
        { id: "t-2", speaker: "Candidate", text: "Hi! Of course. In my last project, I architected a real-time financial tracking dashboard aggregating dozens of high-frequency stock tickers. The core architectural decision was separating the volatile web socket push engine from visual component trees. We used a normalized local store with state buffers, only releasing screen refreshes at a debounced 60fps interval. This kept CPU utilization under fifteen percent and eliminated render choking entirely.", timestamp: "01:10" },
        { id: "t-3", speaker: "AI", text: "That is incredibly smart. Seamless data flow is everything under low-latency limits. Moving on: How do you approach optimizing performance in a React application that is experiencing slow rendering?", timestamp: "01:50" },
        { id: "t-4", speaker: "Candidate", text: "I always start with measurement before modifying anything. I open the React DevTools Profiler, record a representative interaction, and look for long-running fiber updates or recursive renders. Common issues are usually unstable objects or function references passed in contexts, or high-level state updates triggering whole cascades. I solve these by lifting state down, memoizing callback references with useCallback, wrapping heavy visual children in React.memo, and occasionally moving to absolute primitive state fields.", timestamp: "03:12" },
        { id: "t-5", speaker: "AI", text: "Exactly, profile first, fix second! Now let's discuss state. What is your preferred state management pattern for a large-scale enterprise application, and what are its trade-offs?", timestamp: "03:55" },
        { id: "t-6", speaker: "Candidate", text: "For massive scale, I prefer a combination of Zustand for light global client states and TanStack Query for server-side state. The main trade-off is separating client-only actions from server responses. Zustand keeps the code incredibly lean and boilerplate-free compared to Redux, which makes onboarding developers extremely fast. TanStack handles caching, auto-refetching, and offline states natively, which saves us months of custom sync coding.", timestamp: "05:08" },
        { id: "t-7", speaker: "AI", text: "Marvelous. Lastly, how do you handle UI styling for responsive architectures, especially with tools like Tailwind CSS?", timestamp: "05:40" },
        { id: "t-8", speaker: "Candidate", text: "I am a huge advocate of Tailwind! I strictly follow mobile-first responsive breakpoints using helpers like md, lg, and xl. I avoid embedding absolute pixel dimensions, preferring flexible layouts grids, custom flex boxes with matching gaps, and fluid spacing scales. It makes designing beautiful interfaces remarkably fast and maintains uniform token values across our screens.", timestamp: "06:15" },
        { id: "t-9", speaker: "AI", text: "Perfect Alex! Those were all the screening questions I have for today. We will evaluate our discussion and get back to you soon!", timestamp: "06:22" }
      ],
      detailedScores: [
        { criteria: "Technical Depth", score: 95, maxScore: 100, feedback: "Alex exhibited comprehensive mastery over the React fiber model, memory footprints, and optimization strategies." },
        { criteria: "Architectural Style", score: 92, maxScore: 100, feedback: "Strong architectural discipline, utilizing decoupled state stores and optimized interval updates." },
        { criteria: "Communication & Culture", score: 90, maxScore: 100, feedback: "Articulate, descriptive, and very professional verbal expression." }
      ],
      qnaPairs: [
        { question: "Tell me about a complex React component or dashboard you built.", answer: "In my last project, I architected a real-time financial tracking dashboard aggregating dozens of tickers. We decoupled the web socket stream, buffered pushes, and updated the screen at a debounced 60fps.", rating: 96, feedback: "An exemplary explanation showcasing deep performance engineering and technical pragmatism." },
        { question: "How do you approach optimizing performance in a React application?", answer: "Use React DevTools Profiler first. Fix deep rerenders by flattening state pools, using useMemo and useCallback to preserve reference stability, or doing lazy loading.", rating: 94, feedback: "Demonstrated precise, data-driven methodology for troubleshooting lag and bottlenecks." },
        { question: "What is your preferred state management pattern?", answer: "Zustand for global client values paired with TanStack Query for caching and syncing backend APIs. It remains boilerplate-free compared to Redux.", rating: 90, feedback: "Sensible selection of modern packages, demonstrating understanding of architectural efficiency." }
      ],
      consentAgreedTime: "2026-05-12T10:10:00Z",
      gdprCompliantMode: true,
      tabSwitchCount: 0,
      longSilenceCount: 0,
      suspiciousVoiceNoise: false,
      spokenLanguage: "English (US Accent)",
      deliveryMetrics: {
        totalFillers: 3,
        wpm: 125,
        clarityLevel: "Excellent",
        overallPacing: "Balanced & Fluent (125 WPM)",
        fillerWords: { "um": 1, "like": 2 }
      }
    },
    {
      id: "cand-2",
      campaignId: "camp-1",
      name: "Sarah Chen",
      email: "sarah.chen@techcorp.io",
      phone: "+1 (555) 123-4567",
      status: "Evaluated",
      appliedDate: "2026-05-14T11:40:00Z",
      duration: "4m 50s",
      score: 78,
      fitCategory: "Shortlist",
      overallEvaluation: "Sarah is a proficient frontend developer with strong visual and layout skills. However, she was slightly weaker on React internals, particularly around fiber tree structure and granular profiling, though her practical coding habits are excellent.",
      strengths: [
        "Superb aesthetic design eye and mastery of responsive systems.",
        "Active contributor to frontend open-source tooling.",
        "Friendly and highly approachable verbal demeanor."
      ],
      weaknesses: [
        "Gaps in profiling knowledge, relying on trial-and-error changes rather than profiling tools initially.",
        "Less familiar with complex state normalization."
      ],
      transcript: [
        { id: "t-1", speaker: "AI", text: "Hello Sarah! Thanks for speaking with us. To begin: tell me about a complex React component or dashboard you built.", timestamp: "00:04" },
        { id: "t-2", speaker: "Candidate", text: "Hi! Yes. In my last position, I designed a multi-window user settings dashboard where employees could change workspace properties, customize layouts, and manage permissions. I used standard React context for sharing preferences. It looked great and saved settings locally using browser sessions.", timestamp: "01:05" },
        { id: "t-3", speaker: "AI", text: "Splendid. Let's move to optimization: how do you approach diagnosing and resolving slow renders?", timestamp: "01:45" },
        { id: "t-4", speaker: "Candidate", text: "Usually, when screens feel sluggish, I start checking if I am doing duplicate fetch requests. Then I look at components and make sure I use React.useMemo around data calculations, and sometimes split heavy components into smaller files to avoid large render chunks. I also try to avoid inline objects in HTML tags as they can recreate on load.", timestamp: "02:50" },
        { id: "t-5", speaker: "AI", text: "Wonderful practical advice! Now, what is your preferred state management pattern for a large-scale enterprise application, and what are its trade-offs?", timestamp: "03:22" },
        { id: "t-6", speaker: "Candidate", text: "Honestly, I prefer Redux Toolkit because that is what most companies I have worked at are using. It is really powerful and structured, and the Redux DevTools are amazing. The downside is definitely the boilerplate code—even with the toolkit, setting up slices and actions can take a while and feel repetitive for simple feature states.", timestamp: "04:10" },
        { id: "t-7", speaker: "AI", text: "Agreed, structural consistency is a huge relief at scale. Finally, how do you handle responsive typography and layout using Tailwind CSS?", timestamp: "04:30" },
        { id: "t-8", speaker: "Candidate", text: "Tailwind has simplified this so much! I use arbitrary class lists prefixed with sm, md, or lg and control spacing fluidly. I also pair it with CSS Grid systems so elements wrap cleanly on mobile, and apply flex boxes for navigation bars. It yields a really polished, pixel-perfect feel.", timestamp: "04:45" },
        { id: "t-9", speaker: "AI", text: "Fantastic Sarah, it was a pleasure conversing with you! We will outline our details and contact you soon.", timestamp: "04:50" }
      ],
      detailedScores: [
        { criteria: "Technical Depth", score: 72, maxScore: 100, feedback: "Understood standard hooks but had slight gaps regarding performance optimizations and profiling instruments." },
        { criteria: "Architectural Style", score: 76, maxScore: 100, feedback: "Relied heavily on high-level React context and standard Redux packages without consideration for performance impacts." },
        { criteria: "UX & CSS Polish", score: 88, maxScore: 100, feedback: "Showed outstanding styling intuition, understanding responsive containers, grid wrapping, and font scales." }
      ],
      qnaPairs: [
        { question: "Tell me about a complex React component or dashboard you built.", answer: "Built a multi-window settings dashboard sharing standard React context state. Preserved setups inside session utilities.", rating: 80, feedback: "A great practical component, though it used simpler state management architectures." },
        { question: "How do you approach optimizing performance in a React application?", answer: "Audit network requests, add React.useMemo around array maps, split heavy layout elements, and remove inline styling elements.", rating: 70, feedback: "Identified helpful UI conventions, though missed critical tools like the flame-graph Profiler." }
      ],
      consentAgreedTime: "2026-05-14T11:35:00Z",
      gdprCompliantMode: true,
      tabSwitchCount: 1,
      longSilenceCount: 0,
      suspiciousVoiceNoise: false,
      spokenLanguage: "English (APAC Accent)",
      deliveryMetrics: {
        totalFillers: 7,
        wpm: 110,
        clarityLevel: "Good",
        overallPacing: "Structured & Balanced (110 WPM)",
        fillerWords: { "like": 4, "basically": 3 }
      }
    },
    {
      id: "cand-3",
      campaignId: "camp-1",
      name: "Marcus Johnson",
      email: "marcus.j@outlook.com",
      phone: "+1 (555) 765-1122",
      status: "Shortlist",
      appliedDate: "2026-05-25T15:20:00Z",
      duration: "5m 12s",
      score: 83,
      fitCategory: "Shortlist",
      overallEvaluation: "Marcus showed strong competency in state management engines and robust CSS/Vite structure, with minor pacing pauses.",
      strengths: ["Clean code structure mindset", "Zustand familiarity"],
      weaknesses: ["Speech had several long silences during architectural design explanations"],
      transcript: [],
      detailedScores: [
        { criteria: "Technical Depth", score: 84, maxScore: 100, feedback: "Thorough understanding of state caches." }
      ],
      qnaPairs: [],
      consentAgreedTime: "2026-05-25T15:10:00Z",
      gdprCompliantMode: true,
      tabSwitchCount: 0,
      longSilenceCount: 3,
      suspiciousVoiceNoise: false,
      spokenLanguage: "English (US Accent)",
      deliveryMetrics: {
        totalFillers: 6,
        wpm: 92,
        clarityLevel: "Moderate",
        overallPacing: "Slow & Deliberate (92 WPM)",
        fillerWords: { "um": 4, "ah": 2 }
      }
    },
    {
      id: "cand-4",
      campaignId: "camp-2",
      name: "Elena Rostova",
      email: "elena.rostova@salescloud.com",
      phone: "+1 (555) 909-4433",
      status: "Reject",
      appliedDate: "2026-05-19T09:12:00Z",
      duration: "3m 15s",
      score: 44,
      fitCategory: "Reject",
      overallEvaluation: "Elena was enthusiastic but lacked B2B consultative selling depth. She was easily flustered by the mock price objection and relied on discount giveaways immediately rather than discussing ROI value propositions.",
      strengths: [
        "Very friendly tone, high energy and welcoming voice presence.",
        "Active listener."
      ],
      weaknesses: [
        "Poor objection handling, immediately offering a thirty percent discount without investigating pain points.",
        "Struggled with lead qualification models (BANT criteria)."
      ],
      transcript: [
        { id: "t-1", speaker: "AI", text: "Welcome Elena. Excited to talk tech sales today! Can you start by walking me through a successful B2B deal you closed? What was your strategy from contact to signatures?", timestamp: "00:05" },
        { id: "t-2", speaker: "Candidate", text: "Yes, hi! In my last job, I sold subscriptions for a CRM software. I had a lead that filled out a contact form. I immediately called them, explained our system for thirty minutes, and then emailed them a price brochure. They seemed to like the product, so I followed up twice over email, and they finally signed on the dotted line. It was fairly simple.", timestamp: "00:55" },
        { id: "t-3", speaker: "AI", text: "Interesting, speed to lead is crucial. Let's try a roleplay question: How do you handle a strong objection from a prospective customer saying our solution is too expensive?", timestamp: "01:25" },
        { id: "t-4", speaker: "Candidate", text: "Oh, if they say it's too expensive, I immediately try to make them happy. I tell them I can talk to my manager and get them a thirty percent discount right today. If they still think it's high, I offer to give them a free month or even extend the discount further. Keeping customers happy is my priority!", timestamp: "02:05" },
        { id: "t-5", speaker: "AI", text: "I see. Retaining margin is vital to high-growth, though. Next up: How do you qualify a warm lead to ensure you are prioritizing high-impact accounts?", timestamp: "02:35" },
        { id: "t-6", speaker: "Candidate", text: "I usually just look at how fast they email me back. If they respond quickly, I work with them. If they take a few days, I move them down my checklist.", timestamp: "03:10" },
        { id: "t-7", speaker: "AI", text: "Understood. Thank you Elena, that concludes our screening today!", timestamp: "03:15" }
      ],
      detailedScores: [
        { criteria: "Objection Handling", score: 32, maxScore: 100, feedback: "Gave away margin immediately without attempting to build business value or establish true cost-of-inaction metrics." },
        { criteria: "Consultative approach", score: 48, maxScore: 100, feedback: "Relies on standard price cuts rather than exploring client motivation profiles." }
      ],
      qnaPairs: [
        { question: "How do you handle a strong objection?", answer: "Give them a thirty percent discount right away.", rating: 30, feedback: "Unacceptable strategy for enterprise software reps; severely diminishes product stature and contract size." }
      ],
      consentAgreedTime: "2026-05-19T09:08:00Z",
      gdprCompliantMode: true,
      tabSwitchCount: 4,
      longSilenceCount: 2,
      suspiciousVoiceNoise: true,
      spokenLanguage: "Russian (Accent Spoken)",
      deliveryMetrics: {
        totalFillers: 12,
        wpm: 145,
        clarityLevel: "Needs Improvement",
        overallPacing: "Rapid & Energetic (145 WPM)",
        fillerWords: { "like": 7, "basically": 5 }
      }
    },
    {
      id: "cand-5",
      campaignId: "camp-2",
      name: "David Kim",
      email: "david.kim@globalsecure.com",
      phone: "+1 (555) 434-1100",
      status: "Pending",
      appliedDate: "2026-05-24T10:00:00Z",
      duration: "--",
      score: 0,
      fitCategory: "Shortlist",
      overallEvaluation: "This candidate has not undergone the digital screening interview yet. Invite link is active.",
      strengths: [],
      weaknesses: []
    }
  ],
  auditLogs: [
    { id: "log-1", action: "CAMPAIGN_CREATE", details: "Created Senior Frontend Engineer Vetting Pipeline", operator: "Eleanor Vance", timestamp: "2026-05-10T14:30:00Z" },
    { id: "log-2", action: "CANDIDATE_INVITE", details: "Invited Alex Rivera to Frontend campaign", operator: "Eleanor Vance", timestamp: "2026-05-12T10:10:00Z" },
    { id: "log-3", action: "INTERVIEW_COMPLETE", details: "Candidate Alex Rivera finished voice screen (Score: 92)", operator: "AI Virtual System", timestamp: "2026-05-12T10:22:00Z" },
    { id: "log-4", action: "CANDIDATE_INVITE", details: "Invited Sarah Chen to Frontend campaign", operator: "Eleanor Vance", timestamp: "2026-05-14T11:30:00Z" }
  ],
  branding: {
    logoUrl: "/logo.svg",
    appName: "Raincrew.AI",
    companyName: "Raincrew.AI",
    primaryColor: "#0ea5e9", // Cerulean Blue
    gdprText: "By proceeding with this vocal interview screen, you consent to let the AI assessment pipeline analyze your voice speech patterns and proctoring video indicators for hiring evaluation."
  },
  emailLogs: [
    { id: "m-1", to: "alex.rivera@gmail.com", subject: "Vetting Invitation: Senior Frontend Engineer", template: "Frontend Screening Invite", sentAt: "2026-05-12T10:10:00Z", status: "Delivered" },
    { id: "m-2", to: "sarah.chen@techcorp.io", subject: "Vetting Invitation: Senior Frontend Engineer", template: "Frontend Screening Invite", sentAt: "2026-05-14T11:30:00Z", status: "Delivered" }
  ],
  recruiterNotes: {}
};

// ==========================================
// 📡 FIRESTORE DATABASE INITIALIZATION
// ==========================================
const CONFIG_FILE = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));

const firebaseApp = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// Core operation types for error tracking
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: "SERVER_SERVICE_ROLE",
      email: "server-agent@google.com",
      emailVerified: true
    },
    operationType,
    path
  };
  console.error('Firestore Server Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection verified and active!");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration: Firebase is offline.");
    } else {
      console.log("Firebase connection initialized.");
    }
  }
}
testConnection();

// Seeding helper to load initial data if the database is empty
async function seedFirestoreIfNeeded() {
  try {
    // Force/migrate sandbox branding to Raincrew.AI
    const sandboxRef = doc(db, "branding", "sandbox");
    const sandboxSnap = await getDoc(sandboxRef);
    if (!sandboxSnap.exists() || !sandboxSnap.data().appName || sandboxSnap.data().appName === "FoloUp" || sandboxSnap.data().companyName?.includes("FoloUp")) {
      console.log("Migrating live sandbox branding documentation in Firestore to Raincrew.AI...");
      await setDoc(sandboxRef, {
        appName: "Raincrew.AI",
        logoUrl: "/logo.svg",
        companyName: "Raincrew.AI",
        themeColor: "#0ea5e9",
        gdprText: "By proceeding with this vocal interview screen, you consent to let the AI assessment pipeline analyze your voice speech patterns and proctoring video indicators for hiring evaluation.",
        emailProvider: "simulated"
      });
    }

    const campaignsCol = collection(db, "campaigns");
    const snapshot = await getDocs(campaignsCol);
    if (snapshot.empty) {
      console.log("Firestore 'campaigns' collection is empty. Seeding initial templates...");
      
      // Seed Campaigns
      for (const campaign of INITIAL_DATABASE.campaigns) {
        await setDoc(doc(db, "campaigns", campaign.id), campaign);
      }
      
      // Seed Candidates
      for (const candidate of INITIAL_DATABASE.candidates) {
        await setDoc(doc(db, "candidates", candidate.id), candidate);
      }
      
      // Seed Audit Logs
      for (const log of INITIAL_DATABASE.auditLogs) {
        await setDoc(doc(db, "auditLogs", log.id), log);
      }

      // Seed Branding
      await setDoc(doc(db, "branding", "config"), {
        ...INITIAL_DATABASE.branding,
        logoUrl: "/logo.svg",
        appName: "Raincrew.AI",
        companyName: "Raincrew.AI"
      });
      
      console.log("Firestore seeding completed successfully!");
    } else {
      console.log("Firestore is already initialized. Skipping seeding.");
    }
  } catch (err) {
    console.error("Failed to seed Firestore database on boot:", err);
  }
}

// Trigger asynchronous database seeding on boot
seedFirestoreIfNeeded().catch(console.error);

// ==========================================
// 🚀 FIRESTORE CRUD HELPER METHODS 
// ==========================================

async function getFirestoreCampaigns(workspaceId: string = "sandbox"): Promise<any[]> {
  try {
    const colRef = collection(db, "campaigns");
    let snapshot;
    if (workspaceId === "sandbox") {
      snapshot = await getDocs(colRef);
    } else {
      const q = query(colRef, where("workspaceId", "==", workspaceId));
      snapshot = await getDocs(q);
    }
    const list: any[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (workspaceId === "sandbox" && data.workspaceId && data.workspaceId !== "sandbox") {
        return;
      }
      list.push(data);
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, "campaigns");
    return [];
  }
}

async function saveFirestoreCampaign(campaign: any, workspaceId: string = "sandbox"): Promise<void> {
  try {
    const dataToSave = { ...campaign, workspaceId };
    await setDoc(doc(db, "campaigns", campaign.id), dataToSave);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `campaigns/${campaign.id}`);
  }
}

async function deleteFirestoreCampaign(campId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "campaigns", campId));
    // Cascade delete candidates belonging to this campaign
    const candidatesCol = collection(db, "candidates");
    const q = query(candidatesCol, where("campaignId", "==", campId));
    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      await deleteDoc(docSnap.ref);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `campaigns/${campId}`);
  }
}

async function getFirestoreCandidates(campaignId?: string, workspaceId: string = "sandbox"): Promise<any[]> {
  try {
    const colRef = collection(db, "candidates");
    let list: any[] = [];
    if (campaignId) {
      const q = query(colRef, where("campaignId", "==", campaignId));
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => {
        list.push(docSnap.data());
      });
    } else {
      const snapshot = await getDocs(colRef);
      snapshot.forEach(docSnap => {
        list.push(docSnap.data());
      });
    }
    // Filter candidates by workspace context
    return list.filter(data => {
      if (workspaceId !== "sandbox" && data.workspaceId !== workspaceId) {
        return false;
      }
      if (workspaceId === "sandbox" && data.workspaceId && data.workspaceId !== "sandbox") {
        return false;
      }
      return true;
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, "candidates");
    return [];
  }
}

async function saveFirestoreCandidate(candidate: any, workspaceId: string = "sandbox"): Promise<void> {
  try {
    const dataToSave = { ...candidate, workspaceId };
    await setDoc(doc(db, "candidates", candidate.id), dataToSave);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `candidates/${candidate.id}`);
  }
}

async function deleteFirestoreCandidate(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "candidates", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `candidates/${id}`);
  }
}

async function getFirestoreAuditLogs(workspaceId: string = "sandbox"): Promise<any[]> {
  try {
    const colRef = collection(db, "auditLogs");
    const snapshot = await getDocs(colRef);
    const list: any[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (workspaceId !== "sandbox" && data.workspaceId !== workspaceId) {
        return;
      }
      if (workspaceId === "sandbox" && data.workspaceId && data.workspaceId !== "sandbox") {
        return;
      }
      list.push(data);
    });
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, "auditLogs");
    return [];
  }
}

async function saveFirestoreAuditLog(log: any, workspaceId: string = "sandbox"): Promise<void> {
  try {
    const dataToSave = { ...log, workspaceId };
    await setDoc(doc(db, "auditLogs", log.id), dataToSave);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `auditLogs/${log.id}`);
  }
}

async function getFirestoreBranding(workspaceId: string = "sandbox"): Promise<any> {
  try {
    const docRef = doc(db, "branding", workspaceId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return {
      ...INITIAL_DATABASE.branding,
      companyName: workspaceId === "sandbox" ? "Raincrew.AI" : workspaceId.split('.')[0].toUpperCase() + " Workspace"
    };
  } catch (err) {
    return INITIAL_DATABASE.branding;
  }
}

async function saveFirestoreBranding(branding: any, workspaceId: string = "sandbox"): Promise<void> {
  try {
    await setDoc(doc(db, "branding", workspaceId), branding);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `branding/${workspaceId}`);
  }
}

async function getFirestoreRecruiterNotes(candidateId: string): Promise<string[]> {
  try {
    const docRef = doc(db, "recruiterNotes", candidateId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().notes || [];
    }
    return [];
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `recruiterNotes/${candidateId}`);
    return [];
  }
}

async function saveFirestoreRecruiterNote(candidateId: string, note: string): Promise<string[]> {
  try {
    const notes = await getFirestoreRecruiterNotes(candidateId);
    notes.push(note);
    await setDoc(doc(db, "recruiterNotes", candidateId), { candidateId, notes });
    return notes;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `recruiterNotes/${candidateId}`);
    return [];
  }
}

async function getFirestoreEmailLogs(workspaceId: string = "sandbox"): Promise<any[]> {
  try {
    const colRef = collection(db, "emailLogs");
    const snapshot = await getDocs(colRef);
    const list: any[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (workspaceId !== "sandbox" && data.workspaceId !== workspaceId) {
        return;
      }
      if (workspaceId === "sandbox" && data.workspaceId && data.workspaceId !== "sandbox") {
        return;
      }
      list.push(data);
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, "emailLogs");
    return [];
  }
}

async function saveFirestoreEmailLog(email: any, workspaceId: string = "sandbox"): Promise<void> {
  try {
    const dataToSave = { ...email, workspaceId };
    await setDoc(doc(db, "emailLogs", email.id), dataToSave);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `emailLogs/${email.id}`);
  }
}

// Helper to deliver emails via simulated, Resend or SendGrid Gateway
async function sendRealOrSimulatedEmail(to: string, subject: string, template: string, workspaceId: string = "sandbox"): Promise<boolean> {
  try {
    const branding = await getFirestoreBranding();
    
    // Check if there is configured email configurations in branding document or environment:
    let provider = branding.emailProvider;
    if (!provider || provider === 'simulated') {
      if (process.env.RESEND_API_KEY) {
        provider = 'resend';
      } else if (process.env.SENDGRID_API_KEY) {
        provider = 'sendgrid';
      } else {
        provider = 'simulated';
      }
    }
    const apiKey = branding.emailApiKey || (provider === 'resend' ? process.env.RESEND_API_KEY : process.env.SENDGRID_API_KEY) || '';
    const fromEmail = branding.senderEmail || 'onboarding@resend.dev';
    
    let deliveryStatus = 'Delivered (Simulated)';
    let actualProviderUsed = 'simulated';
    let errorMessage = '';

    const htmlBody = template.replace(/\n/g, '<br/>');

    if (provider === 'resend' && apiKey) {
      try {
        actualProviderUsed = 'resend';
        console.log(`Delivering real email to ${to} via Resend...`);
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [to],
            subject: subject,
            html: htmlBody
          })
        });
        
        if (response.ok) {
          deliveryStatus = 'Delivered via Resend';
          console.log(`Successfully dispatched email to ${to} via Resend API!`);
        } else {
          const errText = await response.text();
          errorMessage = `HTTP ${response.status}: ${errText}`;
          deliveryStatus = `Failed (Resend error: ${errorMessage})`;
          console.error(`Resend API dispatch failed: ${errText}`);
        }
      } catch (err: any) {
        deliveryStatus = `Error (Resend exception: ${err.message})`;
        console.error('Resend exception:', err);
      }
    } else if (provider === 'sendgrid' && apiKey) {
      try {
        actualProviderUsed = 'sendgrid';
        console.log(`Delivering real email to ${to} via SendGrid...`);
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: fromEmail },
            subject: subject,
            content: [{ type: 'text/html', value: htmlBody }]
          })
        });
        
        if (response.ok) {
          deliveryStatus = 'Delivered via SendGrid';
          console.log(`Successfully dispatched email to ${to} via SendGrid API!`);
        } else {
          const errText = await response.text();
          errorMessage = `HTTP ${response.status}: ${errText}`;
          deliveryStatus = `Failed (SendGrid error: ${errorMessage})`;
          console.error(`SendGrid API dispatch failed: ${errText}`);
        }
      } catch (err: any) {
        deliveryStatus = `Error (SendGrid exception: ${err.message})`;
        console.error('SendGrid exception:', err);
      }
    } else {
      console.log(`Simulated email dispatch to ${to}: ${subject}`);
    }

    // Save logs to Firestore email logs
    const newEmail = {
      id: `m-${Date.now()}`,
      to,
      subject,
      template,
      sentAt: new Date().toISOString(),
      status: deliveryStatus,
      provider: actualProviderUsed
    };
    await saveFirestoreEmailLog(newEmail, workspaceId);
    
    return deliveryStatus.startsWith('Delivered');
  } catch (err) {
    console.error('Error in sendRealOrSimulatedEmail:', err);
    return false;
  }
}


let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Please navigate to Settings > Secrets in AI Studio and configure your key.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// 1. Health-check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 2. Question Generation Endpoint
app.post("/api/generate_questions", async (req, res): Promise<any> => {
  try {
    const { title, description, experience } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required parameters." });
    }

    const ai = getAiClient();
    const prompt = `You are an expert HR Lead and Technical Recruiter.
Generate 4 highly tailored, conversational screening questions to interview a candidate for the following role:
Role: ${title}
Experience Level required: ${experience || "Not specified"}
Job Description: ${description}

The questions should be clear, direct, and conversational (suitable for oral screening). Each question must assess a single core competence (e.g. theoretical knowledge, practical debugging/problem-solving, cultural motivation, or situational logic).
Avoid generic questions ("where do you see yourself in 5 years"). Make them specific to the requirements in the job description.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional recruiting assistant specialized in crafting technical, precise, yet conversational screening questions.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: "A flat JSON array of exactly 4 strings representing the created evaluation questions."
        }
      }
    });

    const parsedQuestions = JSON.parse(response.text || '[]');
    res.json({ questions: parsedQuestions });

  } catch (err: any) {
    console.error("Error generating questions:", err);
    res.status(500).json({ 
      error: err.message || "Failed to generate questions. Ensure your GEMINI_API_KEY is valid.",
      isKeyMissing: !process.env.GEMINI_API_KEY
    });
  }
});

// 3. Candidate Evaluation Endpoint
app.post("/api/evaluate", async (req, res): Promise<any> => {
  try {
    const { jobTitle, jobDescription, questions, transcript } = req.body;
    if (!jobTitle || !transcript || !Array.isArray(transcript)) {
      return res.status(400).json({ error: "Job title and transcript are required parameters." });
    }

    const compiledTranscript = transcript.map(t => `${t.speaker}: ${t.text}`).join("\n");
    const ai = getAiClient();

    const prompt = `You are an AI Hiring Manager. Evaluate the following oral interview transcript and rate the candidate's alignment with the role.
    
    In addition to basic metrics, you MUST perform a comprehensive Skills Gap Analysis for this candidate versus the ideal job profile. Identify what critical or standard competencies they are missing or have demonstrated lag in. Suggest highly actionable learning resources (such as specific courses, official documentation sites, video lectures, or reference books) and formulate strategic follow-up interview focus areas for recruiters.

--- JOB ROLE DETAILS ---
Title: ${jobTitle}
Description: ${jobDescription || "Not specified"}

--- INTERVIEW QUESTIONS ASKED ---
${(questions || []).map((q: string, i: number) => `Q${i + 1}: ${q}`).join("\n")}

--- CANDIDATE DIALOG TRANSCRIPT ---
${compiledTranscript}

Your goal is to parse this dialogue, score the candidate fairly (under standard recruitment guidelines), categorize them ('Hire', 'Shortlist', or 'Reject'), and list clear strengths, weaknesses, a question-by-question breakdown with rating (0-100), and a structured Skills Gap Analysis vs. the Ideal Profile.

NOTE: If the candidate transcript is in a foreign language (e.g., Spanish, French, Hindi, German, Japanese, etc.), evaluate their answers carefully by translating and evaluating contextually. However, your resulting report fields (strengths, weaknesses, overallEvaluation, detailed question-by-question feedback, and skills gap labels) MUST be written in classical professional English. This enables recruiting staff of different regions to review candidate scores consistently.

Be objective, constructive, and highly diagnostic. Ensure the scores are realistic based on their depth:
- High depth, realistic trade-offs mentioned -> Score 85-95.
- Competent, correct but standard answers -> Score 70-84.
- High-level, missing details, or vague -> Score 50-69.
- Unfocused or critical gaps (such as poor objection handling or wrong patterns) -> Score under 50.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a senior hiring auditor that evaluates candidate interview responses (which may be in Spanish, French, Hindi, etc.) against job requirements using thorough technical standards, producing outputs in professional English. You excel at drafting constructive skills gaps, actionable learning paths, and tailored interview follow-ups.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["score", "fitCategory", "overallEvaluation", "strengths", "weaknesses", "detailedScores", "qnaPairs", "skillsGap", "learningResources", "followUpFocusAreas"],
          properties: {
            score: {
              type: Type.INTEGER,
              description: "The overall fit score from 0 to 100."
            },
            fitCategory: {
              type: Type.STRING,
              description: "Recruiter recommendations, must be exact: 'Hire', 'Shortlist', or 'Reject'."
            },
            overallEvaluation: {
              type: Type.STRING,
              description: "A paragraph summarizing the candidate's technical level, communication behavior, and fit for the workspace."
            },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 2-3 specific technical or personal strengths identified."
            },
            weaknesses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 1-2 specific areas for growth or potential red flags."
            },
            detailedScores: {
              type: Type.ARRAY,
              description: "Score segments mapped to competency metrics (Technical Depth, Communication, etc.).",
              items: {
                type: Type.OBJECT,
                required: ["criteria", "score", "maxScore", "feedback"],
                properties: {
                  criteria: { type: Type.STRING, description: "Name of competency evaluated (e.g. Technical Mastery, Communication, Scenario Handling)." },
                  score: { type: Type.INTEGER },
                  maxScore: { type: Type.INTEGER },
                  feedback: { type: Type.STRING }
                }
              }
            },
            qnaPairs: {
              type: Type.ARRAY,
              description: "Evaluation on each individual question-answer pair from the transcript.",
              items: {
                type: Type.OBJECT,
                required: ["question", "answer", "rating", "feedback"],
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING, description: "Synthesized candidate answer to this specific question." },
                  rating: { type: Type.INTEGER, description: "Score from 0 to 100 for this response." },
                  feedback: { type: Type.STRING, description: "A few sentences detailing what they explained well and what was missing." }
                }
              }
            },
            skillsGap: {
              type: Type.ARRAY,
              description: "Rigorous alignment gaps indicating specific skills the candidate is missing or needs improvement on.",
              items: {
                type: Type.OBJECT,
                required: ["skillName", "importance", "gapDescription"],
                properties: {
                  skillName: { type: Type.STRING, description: "Name of the missing or incomplete skill (e.g., 'React Concurrent Rendering' or 'Advanced Objection Handling')." },
                  importance: { type: Type.STRING, description: "Relevance of this skill gap for the ideal profile. Must be exact: 'High', 'Medium', or 'Low'." },
                  gapDescription: { type: Type.STRING, description: "Clear explanation of how the candidate fell short on this skill during the interview." }
                }
              }
            },
            learningResources: {
              type: Type.ARRAY,
              description: "Highly relevant learning suggestions tailored to cover the candidate's skills gap.",
              items: {
                type: Type.OBJECT,
                required: ["title", "type", "url", "description"],
                properties: {
                  title: { type: Type.STRING, description: "Name of the suggested resource (e.g. 'Advanced React State Patterns course' or 'NextJS official guides')." },
                  type: { type: Type.STRING, description: "Format of the resource: Course, Book, Article, Documentation, or Video." },
                  url: { type: Type.STRING, description: "A realistic reference URL (e.g., pointing to nextjs.org/learn, react.dev, freecodecamp.org, mdn, etc.)." },
                  description: { type: Type.STRING, description: "High-level summary of how this resource addresses their gaps." }
                }
              }
            },
            followUpFocusAreas: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 2-3 recommended follow-up questions or tactical topics for follow-up interviews/assessments."
            }
          }
        }
      }
    });

    const report = JSON.parse(response.text || '{}');
    res.json(report);

  } catch (err: any) {
    console.error("Error evaluating candidate:", err);
    res.status(500).json({ 
      error: err.message || "Failed to evaluate response transcript.",
      isKeyMissing: !process.env.GEMINI_API_KEY
    });
  }
});

// 3.5. Adaptive Conversational Follow-Up Generator Endpoint
app.post("/api/generate_followup", async (req, res): Promise<any> => {
  try {
    const { jobTitle, jobDescription, question, answer, transcriptHistory } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: "question and answer are required parameters." });
    }

    const ai = getAiClient();
    const compiledHistory = (transcriptHistory || [])
      .map((t: { speaker: string; text: string }) => `${t.speaker}: ${t.text}`)
      .join("\n");

    const prompt = `You are an expert technical and architectural interviewer for the role: ${jobTitle || 'Expert Specialist'}.
The job description details is: ${jobDescription || 'N/A'}.

The interview contains preset static questions, but we are conducting a professional adaptive follow-up to emulate a real high-fidelity discussion.
Our active preset question asked was: "${question}"
The candidate's response was: "${answer}"

Use this transcript history for contextual background:
${compiledHistory}

    Generate exactly ONE natural, direct, highly focused follow-up question (maximum 2 sentences) to probe the candidate's background on their statement. Explore technical gaps, structural trade-offs, or ask them to elaborate on specific keywords/projects mentioned in their answer. 
    You MUST generate the follow-up question in the SAME language as the candidate's answer and the ongoing discussion (e.g., if they answered in Spanish, ask in Spanish; if in French, ask in French; if in Hindi, ask in Hindi; if in German, ask in German, etc.). Do NOT mix languages.
    Do NOT include any introduction like "Here is a follow up" or "Sure!". Return the question raw as a single line, ready for speech-to-text oral synthesis.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert recruiter and technical lead who creates outstanding, precise, and highly contextual interviewer follow-ups in the respective conversation language.",
      }
    });

    const followupText = response.text?.trim() || "Could you expand slightly on your experience handling that specific system setup?";
    res.json({ followup: followupText });

  } catch (err: any) {
    console.error("Error generating follow-up:", err);
    res.status(500).json({ 
      error: err.message || "Failed to generate follow-up question.",
      isKeyMissing: !process.env.GEMINI_API_KEY
    });
  }
});

// 3.6 Language Detection Endpoint (AI/ML Auto-detect language enhancement)
app.post("/api/detect_language", async (req, res): Promise<any> => {
  try {
    const { text, currentDialect } = req.body;
    if (!text || !text.trim()) {
      return res.json({
        detectedLanguage: "English",
        detectedLanguageTag: "en-US",
        dialectName: "English (US Accent)",
        languageChanged: false,
        confidence: 0
      });
    }

    const ai = getAiClient();
    const prompt = `You are an expert voice and language analytics model.
Analyze the following text submitted by a candidate during an interview and detect its primary language.

Candidate Text: "${text}"

Match the language to one of these dialects and languages:
1. English -> return "English", code "en-US", name "English (US Accent)"
2. Spanish / Español -> return "Spanish", code "es-ES", dialectName "Spanish (Standard es-ES)"
3. French / Français -> return "French", code "fr-FR", dialectName "French (Standard fr-FR)"
4. German / Deutsch -> return "German", code "de-DE", dialectName "German (Standard de-DE)"
5. Japanese / 日本語 -> return "Japanese", code "ja-JP", dialectName "Japanese (Standard ja-JP)"
6. Hindi / हिन्दी -> return "Hindi", code "hi-IN", dialectName "Hindi (Standard hi-IN)"
7. Italian / Italiano -> return "Italian", code "it-IT", dialectName "Italian (Standard it-IT)"
8. Portuguese / Português -> return "Portuguese", code "pt-BR", dialectName "Portuguese (Standard pt-BR)"
9. Chinese / 中文 -> return "Chinese", code "zh-CN", dialectName "Chinese (Standard zh-CN)"
10. Arabic / العربية -> return "Arabic", code "ar-SA", dialectName "Arabic (Standard ar-SA)"

Only trigger a different language if you are highly confident (confidence score >= 0.8) and it is clearly Spanish, French, Hindi, German, Japanese, Italian, Portuguese, Arabic, or Chinese rather than English. Short words like "Yes", "No", "OK", "React", "Docker", "Java" or brief English technical phrases should default to the current active language or "English (US Accent)".

Your response MUST be a single flat JSON object with these exact keys:
- "detectedLanguage": "Spanish" | "French" | "Hindi" | "German" | "Japanese" | "English" | "Italian" | "Portuguese" | "Arabic" | "Chinese"
- "detectedLanguageTag": "es-ES" | "fr-FR" | "hi-IN" | "de-DE" | "ja-JP" | "en-US" | "it-IT" | "pt-BR" | "ar-SA" | "zh-CN"
- "dialectName": the matched dialect options string
- "confidence": percentage probability (0 to 1.0)
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional linguistics classifier. Your output must strictly be raw, valid JSON matching the schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["detectedLanguage", "detectedLanguageTag", "dialectName", "confidence"],
          properties: {
            detectedLanguage: { type: Type.STRING },
            detectedLanguageTag: { type: Type.STRING },
            dialectName: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    // Programmatic change comparison
    const targetDialectClean = (result.dialectName || "").toLowerCase();
    const currentDialectClean = (currentDialect || "").toLowerCase();
    
    let languageChanged = false;
    if (result.confidence >= 0.8 && result.detectedLanguage && result.detectedLanguage !== "English") {
      // Check if it matches Spanish, French, Hindi, German, Japanese, etc.
      // and isn't already active
      const isCurrentSameBase = currentDialectClean.includes(result.detectedLanguage.toLowerCase()) || 
                                (result.detectedLanguage === "Spanish" && currentDialectClean.includes("hispanic"));
      if (!isCurrentSameBase) {
        languageChanged = true;
      }
    }

    res.json({
      detectedLanguage: result.detectedLanguage || "English",
      detectedLanguageTag: result.detectedLanguageTag || "en-US",
      dialectName: result.dialectName || "English (US Accent)",
      languageChanged,
      confidence: result.confidence || 0
    });

  } catch (err: any) {
    console.error("Error in /api/detect_language:", err);
    res.json({
      detectedLanguage: "English",
      detectedLanguageTag: "en-US",
      dialectName: "English (US Accent)",
      languageChanged: false,
      confidence: 0
    });
  }
});

// 3.7 Language Translation Endpoint (AI/ML Multi-Language Question translation)
app.post("/api/translate_questions", async (req, res): Promise<any> => {
  try {
    const { questions, targetLanguage } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0 || !targetLanguage) {
      return res.status(400).json({ error: "questions array and targetLanguage are required." });
    }

    const ai = getAiClient();
    const prompt = `You are an expert professional translator.
Translate the following interview screening questions perfectly into ${targetLanguage}.
Keep the professional tone, recruiting standards, and technical terms (like 'REST API', 'React', 'Docker', etc. should usually remain in English, but translated naturally inside the sentence grammar structure).

Questions to translate:
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Return exactly a JSON array containing the translated questions in the SAME sequential order.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional recruiting copytranslator. Translate questions with pristine grammar, matching technical standards. Return a raw JSON array of strings.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: "An array of same length containing translated questions strings."
        }
      }
    });

    const translatedQuestions = JSON.parse(response.text || '[]');
    res.json({ translatedQuestions });

  } catch (err: any) {
    console.error("Error in /api/translate_questions:", err);
    res.status(500).json({ error: "Failed to translate questions." });
  }
});

async function extractTextFromFile(fileBase64: string, mimeType: string, fileName: string): Promise<string> {
  const buffer = Buffer.from(fileBase64, 'base64');
  try {
    if (mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {
      const data = await pdf(buffer);
      return data.text || '';
    } else if (
      mimeType.includes('word') || 
      mimeType.includes('officedocument') || 
      fileName.toLowerCase().endsWith('.docx') || 
      fileName.toLowerCase().endsWith('.doc')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } else {
      return buffer.toString('utf-8');
    }
  } catch (err: any) {
    console.error(`Error parsing file ${fileName}:`, err);
    throw new Error(`Failed to extract text from file (${fileName}): ${err.message}`);
  }
}

// 4. Resume Parsing and Fit Scoring Endpoint
app.post("/api/parse_resume", async (req, res): Promise<any> => {
  try {
    let { resumeText, fileBase64, mimeType, fileName, jobTitle, jobDescription } = req.body;
    
    if (fileBase64 && mimeType && fileName) {
      console.log(`Received file upload for resume parsing: ${fileName} (${mimeType})`);
      resumeText = await extractTextFromFile(fileBase64, mimeType, fileName);
    }
    
    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({ error: "Resume text or uploaded file content is required." });
    }

    const ai = getAiClient();
    const prompt = `You are an expert AI Resume Evaluator and Talent Sourcer.
Analyze the following candidate's resume/CV details and extract their contact details.
Then, cross-reference their experience against our active Job Opening details:

--- VACANCY OPENING ---
Title: ${jobTitle || "Not specified"}
Requirements: ${jobDescription || "Not specified"}

--- CANDIDATE RESUME ---
${resumeText}

Extract the candidate's Name, Email, and Phone.
Also perform an initial pre-screening matching search to estimate their Alignment Fit Score (0-100), Fit Category ('Hire', 'Shortlist', 'Reject'), a brief pre-evaluation explanation, and bullet-pointed strengths/weaknesses list.
If contact info is not found, extract reasonable names or leave empty.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional recruiting assistant specialized in parsing candidate resumes and providing highly diagnostic alignment ratings.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["name", "email", "phone", "score", "fitCategory", "explanation", "strengths", "weaknesses"],
          properties: {
            name: { type: Type.STRING, description: "Candidate's full name" },
            email: { type: Type.STRING, description: "Candidate's extracted email address" },
            phone: { type: Type.STRING, description: "Candidate's extracted phone number, or empty" },
            score: { type: Type.INTEGER, description: "Initial predicted alignment score from 0 to 100 based on resume matching." },
            fitCategory: { type: Type.STRING, description: "Initial evaluation recommendation, must be 'Hire', 'Shortlist', or 'Reject'." },
            explanation: { type: Type.STRING, description: "A concise paragraph explaining why this candidate matches or doesn't match the job qualifications." },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 2-3 matching tech skills or experience highlights found in their resume."
            },
            weaknesses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 1-2 potential experience gaps or keywords missing relative to the JD."
            }
          }
        }
      }
    });

    const report = JSON.parse(response.text || '{}');
    res.json(report);

  } catch (err: any) {
    console.error("Error parsing resume:", err);
    res.status(500).json({ 
      error: err.message || "Failed to parse resume.",
      isKeyMissing: !process.env.GEMINI_API_KEY
    });
  }
});

// 4.5. Candidate Dynamic Resume Upload & Question Customizer
app.post("/api/custom_resume_questions", async (req, res): Promise<any> => {
  try {
    const { fileBase64, mimeType, fallbackText, jobTitle, jobDescription } = req.body;
    const ai = getAiClient();
    
    let promptText = `Extract candidates contact details (Name, Email Address, and Phone number)
Cross-reference their experience details against our Job vacancy details:
Job Title: ${jobTitle || "Not specified"}
Requirements: ${jobDescription || "Not specified"}

Generate exactly 4 highly-tailored, personalized interview questions (contained in the "questions" field as an array of strings) based on their specific work experience, listed technical stack, and past projects on their resume. These must be customized specifically for them to probe their claims on their CV.
Make the questions conversational and direct, great for an oral voice screening. Avoid generic questions like "where do you see yourself in 5 years". Make them highly diagnostic of their resume claims.`;

    let contents: any[] = [];
    if (fileBase64 && mimeType) {
      contents.push({
        inlineData: {
          data: fileBase64,
          mimeType: mimeType
        }
      });
      contents.push(promptText);
    } else if (fallbackText) {
      contents.push(`Analyze this candidate's Resume/CV text:
${fallbackText}

${promptText}`);
    } else {
      return res.status(400).json({ error: "resume text or resume file is required." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: "You are an expert HR Recruiting Lead. Your task is to inspect a candidate resume, extract their details, and create 4 specialized, deeply customized screening questions for that specific candidate's projects/credentials.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["name", "email", "phone", "questions"],
          properties: {
            name: { type: Type.STRING },
            email: { type: Type.STRING },
            phone: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "JSON array of exactly 4 strings representing personalized screening questions."
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    res.json(result);

  } catch (err: any) {
    console.error("Error customizing resume questions:", err);
    res.status(500).json({ 
      error: err.message || "Failed to customize resume screening questions.",
      isKeyMissing: !process.env.GEMINI_API_KEY
    });
  }
});

// ==========================================
// 🚀 FULL-STACK AUTHENTICATION & MULTI-TENANT API ROUTES
// ==========================================

app.post("/api/auth/magic-link-send", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email address is required." });
    }
    const token = `mag-${Math.random().toString(36).substring(2, 11)}`;
    const workspaceId = email.split("@")[1].toLowerCase();
    
    // Save token in sessions collection
    await setDoc(doc(db, "sessions", token), {
      email,
      token,
      workspaceId,
      createdAt: new Date().toISOString()
    });

    const subject = "🔑 Your FoloUp Recruiter Secure Magic Login Link";
    const baseUrl = process.env.APP_URL || (req.headers.origin ? req.headers.origin : `${req.secure ? "https://" : "http://"}${req.headers.host}`);
    const magicLinkUrl = `${baseUrl}/magic-verify?token=${token}&email=${encodeURIComponent(email)}`;
    const template = `Hello Recruiter,

Verify and activate your high-security recruitment session using this direct login link:

${magicLinkUrl}

Workspace Isolation ID: ${workspaceId}

Best regards,
FoloUp Identity Management System`;
    
    // Dispatch real/simulated magic login email link (internally handles logging)
    await sendRealOrSimulatedEmail(email, subject, template, workspaceId);

    // Track in audits
    await saveFirestoreAuditLog({
      id: `log-${Date.now()}`,
      action: "AUTH_MAGIC_LINK_SENT",
      details: `Generated and sent recruiter magic login link to ${email}`,
      operator: "Security Gateway",
      timestamp: new Date().toISOString()
    }, workspaceId);

    res.json({ success: true, email, token, workspaceId, magicLinkUrl, url: magicLinkUrl });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to issue magic login transaction: " + err.message });
  }
});

// Support both GET and POST for verifying recruiter magic link
app.all("/api/auth/magic-link-verify", async (req, res) => {
  try {
    const token = (req.method === "POST" ? req.body?.token : req.query?.token) as string || "";
    const email = (req.method === "POST" ? req.body?.email : req.query?.email) as string || "";

    if (!token) {
      return res.status(400).json({ error: "Active login token index is required." });
    }
    
    const docRef = doc(db, "sessions", token);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return res.status(400).json({ error: "Login token is invalid, expired, or deactivated." });
    }
    
    const sessionData = docSnap.data();
    const workspaceId = sessionData.workspaceId;
    const provider = "magic-link";
    const name = email ? email.split("@")[0].split(".")[0].toUpperCase() : sessionData.email.split("@")[0].toUpperCase();
    const organization = workspaceId.split(".")[0].toUpperCase() + " Workspace";

    // Trace in system audits inside the newly loaded workspace
    await saveFirestoreAuditLog({
      id: `log-${Date.now()}`,
      action: "AUTH_MAGIC_LINK_SUCCESS",
      details: `Authorized recruiter login via Magic Link (${sessionData.email})`,
      operator: name,
      timestamp: new Date().toISOString()
    }, workspaceId);

    res.json({
      success: true,
      user: {
        email: sessionData.email,
        name,
        provider,
        organization,
        workspaceId,
      },
      session: {
        token
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "Identity verification failed: " + err.message });
  }
});

app.post("/api/auth/oauth-login", async (req, res) => {
  try {
    const { email, provider, name } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email address is required to parse SaaS workspace settings." });
    }
    const workspaceId = email.split("@")[1].toLowerCase();
    const organization = workspaceId.split(".")[0].toUpperCase() + " Workspace";
    const finalName = name || email.split("@")[0].split(".")[0].toUpperCase();

    // Log the SSO audit log under the tenant
    await saveFirestoreAuditLog({
      id: `log-${Date.now()}`,
      action: "AUTH_SSO_SUCCESS",
      details: `Recruiter authenticated successfully using provider '${provider}'`,
      operator: finalName,
      timestamp: new Date().toISOString()
    }, workspaceId);

    res.json({
      success: true,
      user: {
        email,
        name: finalName,
        provider: provider || "google",
        organization,
        workspaceId,
      },
      session: {
        token: `oauth-${Date.now()}`
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "SSO Authentication handshake failure: " + err.message });
  }
});


// ==========================================
// 🚀 FULL-STACK DATABASE CRUD API ROUTES (WORKSPACE TENANTED)
// ==========================================

// --- CAMPAIGNS ---
app.get("/api/campaigns", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    const list = await getFirestoreCampaigns(workspaceId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load campaigns from Firestore." });
  }
});

app.post("/api/campaigns", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    const campaign = req.body;
    
    if (!campaign.id) {
      campaign.id = `camp-${Date.now()}`;
      campaign.createdAt = new Date().toISOString();
      campaign.candidateCount = 0;
      await saveFirestoreCampaign(campaign, workspaceId);
      
      // Log audit
      const newLog = {
        id: `log-${Date.now()}`,
        action: "CAMPAIGN_CREATE",
        details: `Created campaign: ${campaign.title}`,
        operator: campaign.operator || "Eleanor Vance",
        timestamp: new Date().toISOString()
      };
      await saveFirestoreAuditLog(newLog, workspaceId);
    } else {
      const existingCampaigns = await getFirestoreCampaigns(workspaceId);
      const existing = existingCampaigns.find(c => c.id === campaign.id);
      const updated = { ...existing, ...campaign };
      await saveFirestoreCampaign(updated, workspaceId);
      
      // Log audit
      const newLog = {
        id: `log-${Date.now()}`,
        action: "CAMPAIGN_UPDATE",
        details: `Updated campaign: ${campaign.title}`,
        operator: campaign.operator || "Eleanor Vance",
        timestamp: new Date().toISOString()
      };
      await saveFirestoreAuditLog(newLog, workspaceId);
    }
    
    res.status(201).json(campaign);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save campaign to Firestore." });
  }
});

app.delete("/api/campaigns/:id", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    const campId = req.params.id;
    const campaigns = await getFirestoreCampaigns(workspaceId);
    const camp = campaigns.find(c => c.id === campId);
    
    await deleteFirestoreCampaign(campId);
    
    const newLog = {
      id: `log-${Date.now()}`,
      action: "CAMPAIGN_DELETE",
      details: `Deleted campaign: ${camp ? camp.title : campId}`,
      operator: "Eleanor Vance",
      timestamp: new Date().toISOString()
    };
    await saveFirestoreAuditLog(newLog, workspaceId);
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete campaign." });
  }
});

// --- CANDIDATES ---
app.get("/api/candidates", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    const campaignId = req.query.campaignId as string | undefined;
    const candidates = await getFirestoreCandidates(campaignId, workspaceId);
    res.json(candidates);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve candidates." });
  }
});

app.post("/api/candidates", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    const candidate = req.body;
    
    if (!candidate.id) {
      candidate.id = `cand-${Date.now()}`;
      candidate.appliedDate = new Date().toISOString();
      if (!candidate.status) candidate.status = "Pending";
      await saveFirestoreCandidate(candidate, workspaceId);
      
      // Increment campaign candidate counter
      const campaigns = await getFirestoreCampaigns(workspaceId);
      const camp = campaigns.find(c => c.id === candidate.campaignId);
      if (camp) {
        camp.candidateCount = (camp.candidateCount || 0) + 1;
        await saveFirestoreCampaign(camp, workspaceId);
      }
      
      // Log audit
      const newLog = {
        id: `log-${Date.now()}`,
        action: "CANDIDATE_INVITE",
        details: `Invited candidate: ${candidate.name} (${candidate.email})`,
        operator: "Eleanor Vance",
        timestamp: new Date().toISOString()
      };
      await saveFirestoreAuditLog(newLog, workspaceId);
    } else {
      await saveFirestoreCandidate(candidate, workspaceId);
    }
    
    res.status(201).json(candidate);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to register candidate in Firestore." });
  }
});

app.put("/api/candidates/:id", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    const id = req.params.id;
    const candidates = await getFirestoreCandidates(undefined, workspaceId);
    const idx = candidates.findIndex(c => c.id === id);
    
    if (idx > -1) {
      const existing = candidates[idx];
      const previousStatus = existing.status;
      const updated = { ...existing, ...req.body };
      await saveFirestoreCandidate(updated, workspaceId);
      
      // Track status changes for audit logs (Kanban dragging)
      if (req.body.status && req.body.status !== previousStatus) {
        const newLog = {
          id: `log-${Date.now()}`,
          action: "CANDIDATE_STATUS_CHANGE",
          details: `Moved candidate ${updated.name} from '${previousStatus}' to '${req.body.status}'`,
          operator: "Eleanor Vance",
          timestamp: new Date().toISOString()
        };
        await saveFirestoreAuditLog(newLog, workspaceId);

        // Recruiter email alert upon interview completion
        const finishedStates = ['Completed', 'Evaluated'];
        if (finishedStates.includes(req.body.status) && !finishedStates.includes(previousStatus)) {
          try {
            const branding = await getFirestoreBranding(workspaceId);
            const alertRecipient = branding.recruiterAlertEmail || 'recruiter@foloup.ai';
            
            const campaigns = await getFirestoreCampaigns(workspaceId);
            const campaign = campaigns.find(c => c.id === updated.campaignId);
            const campaignTitle = campaign ? campaign.title : 'Active Job Post';

            const alertSubject = `[FoloUp Alert] Candidate Screening Complete: ${updated.name} for ${campaignTitle}`;
            const alertBody = `Dear Hiring Team,

Candidate ${updated.name} (${updated.email}) has successfully completed their oral vetting screen for the ${campaignTitle} assignment.

Assessment Insights:
- Candidate Name: ${updated.name}
- Vetting Score: ${updated.score ? `${updated.score}/100` : 'AI evaluation in progress'}
- Candidate Fit Recommendation: ${updated.fitCategory || 'Needs Manual Review'}
- Vetting Summary: ${updated.overallEvaluation || 'Processing evaluation report.'}

Please review the candidate's detailed visual score breakout, dialogue transcripts, and vocal metrics in your recruitment manager portal.

Best regards,
FoloUp Automated Screening Daemon`;

            console.log(`Sending recruiter completion alert to ${alertRecipient}...`);
            await sendRealOrSimulatedEmail(alertRecipient, alertSubject, alertBody);
          } catch (mailErr) {
            console.error("Failed to deliver recruiter notification alert:", mailErr);
          }
        }
      }
      
      res.json(updated);
    } else {
      res.status(404).json({ error: "Candidate not found." });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update candidate record." });
  }
});

app.delete("/api/candidates/:id", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    const id = req.params.id;
    const candidates = await getFirestoreCandidates(undefined, workspaceId);
    const cand = candidates.find(c => c.id === id);
    
    if (cand) {
      await deleteFirestoreCandidate(id);
      
      // Decrement campaign candidate counter
      const campaigns = await getFirestoreCampaigns(workspaceId);
      const camp = campaigns.find(c => c.id === cand.campaignId);
      if (camp && camp.candidateCount > 0) {
        camp.candidateCount -= 1;
        await saveFirestoreCampaign(camp, workspaceId);
      }
      
      const newLog = {
        id: `log-${Date.now()}`,
        action: "CANDIDATE_DELETE",
        details: `Removed candidate record: ${cand.name}`,
        operator: "Eleanor Vance",
        timestamp: new Date().toISOString()
      };
      await saveFirestoreAuditLog(newLog, workspaceId);
      
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Candidate not found." });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to remove candidate." });
  }
});

// --- AUDIT SYSTEM TELEMETRY LOGS ---
app.get("/api/audit-logs", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    const list = await getFirestoreAuditLogs(workspaceId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to load audit logs." });
  }
});

app.post("/api/audit-logs", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    const newLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...req.body
    };
    await saveFirestoreAuditLog(newLog, workspaceId);
    res.status(201).json(newLog);
  } catch (err) {
    res.status(500).json({ error: "Failed to record audit log." });
  }
});

// --- BRANDING COMPLIANCE CONTEXT ---
app.get("/api/branding", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    const config = await getFirestoreBranding(workspaceId);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "Failed to read branding configurations." });
  }
});

app.post("/api/branding", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    const original = await getFirestoreBranding(workspaceId);
    const updated = { ...original, ...req.body };
    await saveFirestoreBranding(updated, workspaceId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to persist branding settings." });
  }
});

// --- SIMULATED EMAIL NOTIFICATIONS & LOGS ---
app.get("/api/emails", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    const logs = await getFirestoreEmailLogs(workspaceId);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch email logs." });
  }
});

app.post("/api/send-email", async (req, res) => {
  try {
    const workspaceId = (req.headers["x-workspace-id"] as string) || "sandbox";
    let { to, subject, template, email, candidateName, campaignTitle, interviewLink } = req.body;
    
    // Support Candidate Invite payload signature dynamically
    if (email && candidateName) {
      to = email;
      subject = `[FoloUp Vetting Invite] Screening request for ${campaignTitle}`;
      template = `Hi ${candidateName},

We would love to invite you to complete a secure oral screening evaluation for the ${campaignTitle} hiring campaign at our firm.

You can configure your microphone and engage the digital AI interviewer anytime by clicking the link below:
${interviewLink}

Best of luck with your evaluation,
Hiring Operations Group`;
    }

    const success = await sendRealOrSimulatedEmail(to, subject, template, workspaceId);
    
    const newLog = {
      id: `log-${Date.now()}`,
      action: "EMAIL_SENT",
      details: success 
        ? `Dispatched secure vetting invite to ${to || email} for campaign ${campaignTitle || subject}` 
        : `Email delivery attempt to ${to || email} returned errors (check Integrations Logs).`,
      operator: "AI Mailer System",
      timestamp: new Date().toISOString()
    };
    await saveFirestoreAuditLog(newLog, workspaceId);
    
    res.status(201).json({ success, to: to || email, subject, gatewayResponse: success ? 'Delivered successfully via Sandbox Relay' : 'Delivery channel error' });
  } catch (err) {
    console.error('Error in /api/send-email:', err);
    res.status(500).json({ error: "Failed to dispatch email transaction." });
  }
});

// --- NOTES AND PRIVATE COMMENTS ---
app.get("/api/recruiter-notes/:candidateId", async (req, res) => {
  try {
    const candidateId = req.params.candidateId;
    const notes = await getFirestoreRecruiterNotes(candidateId);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch candidate notes." });
  }
});

app.post("/api/recruiter-notes/:candidateId", async (req, res) => {
  try {
    const candidateId = req.params.candidateId;
    const { note } = req.body;
    
    const formattedNote = `[${new Date().toLocaleDateString()} @ ${new Date().toLocaleTimeString()}] Eleanor Vance: ${note}`;
    const updatedNotes = await saveFirestoreRecruiterNote(candidateId, formattedNote);
    
    res.json(updatedNotes);
  } catch (err) {
    res.status(500).json({ error: "Failed to save comment note." });
  }
});

// Configure Vite middleware and static routes
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started. Running on port ${PORT}`);
  });

  // Attach WebSocket Server on a dedicated path for real-time transcription
  const wss = new WebSocketServer({ server, path: "/api/transcribe-live" });

  wss.on("connection", async (clientWs) => {
    console.log("[WebSocket] Client connected for live interview transcription.");
    
    let liveSession: any = null;
    let accumulatedAudioChunks: string[] = []; // Base64 PCM elements
    let isTranscribingFallback = false;
    let accumulatedTranscriptText = "";

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
      }

      console.log("[WebSocket] Handshaking with Gemini Live API...");
      const ai = getAiClient();
      
      // Setup real-time voice / audio bridge
      liveSession = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: ["AUDIO" as any],
          systemInstruction: "You are a passive transcription assistant. Listen to the user's speech and output the transcription verbatim. Do not reply or carry conversation.",
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (msg: any) => {
            console.log("[Gemini Live Message]", JSON.stringify(msg));
            let text = "";
            
            // Check for user speech transcription event
            if (msg.serverContent?.userTurn?.parts) {
              const part = msg.serverContent.userTurn.parts.find((p: any) => p.text);
              if (part) {
                text = part.text;
                clientWs.send(JSON.stringify({ type: "transcript", text, isFinal: true }));
              }
            } else if (msg.serverContent?.modelTurn?.parts) {
              const part = msg.serverContent.modelTurn.parts.find((p: any) => p.text);
              if (part) {
                text = part.text;
                clientWs.send(JSON.stringify({ type: "model-text", text }));
              }
            }
          },
          onclose: () => {
            console.log("[Gemini Live Session Closed]");
            liveSession = null;
            clientWs.send(JSON.stringify({ type: "status", status: "fallback", message: "Gemini live session closed" }));
          },
          onerror: (err: any) => {
            console.error("[Gemini Live Error]", err);
            liveSession = null;
            clientWs.send(JSON.stringify({ type: "status", status: "fallback", message: "Live STT session warning" }));
          }
        }
      });

      console.log("[WebSocket] Gemini Live session handshaked successfully!");
      clientWs.send(JSON.stringify({ type: "status", status: "connected" }));

    } catch (err: any) {
      console.log("[WebSocket] Gemini Live unavailable. Standing up robust rolling transcription fallback...", err.message);
      clientWs.send(JSON.stringify({ type: "status", status: "fallback", message: "Smart rolling transcription standby" }));
    }

    // Process client audio chunks of WebRTC microphone track or commands
    clientWs.on("message", async (data) => {
      try {
        const payload = JSON.parse(data.toString());
        
        if (payload.type === "audio" && payload.data) {
          const rawBase64 = payload.data;
          accumulatedAudioChunks.push(rawBase64);

          if (liveSession) {
            try {
              // Stream audio chunk directly to the live session
              await liveSession.sendRealtimeInput({
                audio: { data: rawBase64, mimeType: "audio/pcm;rate=16000" }
              });
            } catch (sendErr: any) {
              console.warn("[WebSocket] Live session send failed. Redirecting to backup custom rolling fallback...", sendErr.message);
              liveSession = null;
              if (accumulatedAudioChunks.length % 5 === 0) {
                triggerFallbackRollingTranscription();
              }
            }
          } else {
            // Rolling fallback transcription: trigger every 5 chunks (~2 seconds)
            if (accumulatedAudioChunks.length % 5 === 0) {
              triggerFallbackRollingTranscription();
            }
          }
        } else if (payload.type === "reset") {
          accumulatedAudioChunks = [];
          if (liveSession) {
            // Reinitialize or clean session
          }
          clientWs.send(JSON.stringify({ type: "reset-done" }));
        }
      } catch (e) {
        console.error("[WebSocket Handler Error]", e);
      }
    });

    function getWavDataFromPcmChunks(chunks: string[], sampleRate: number = 16000): string {
      try {
        const buffers = chunks.map(c => Buffer.from(c, 'base64'));
        const pcmBuffer = Buffer.concat(buffers);
        const bufferLength = pcmBuffer.length;
        const header = Buffer.alloc(44);

        header.write('RIFF', 0);
        header.writeUInt32LE(36 + bufferLength, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(1, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(sampleRate * 2, 28);
        header.writeUInt16LE(2, 32);
        header.writeUInt16LE(16, 34);
        header.write('data', 36);
        header.writeUInt32LE(bufferLength, 40);

        const wavBuffer = Buffer.concat([header, pcmBuffer]);
        return wavBuffer.toString('base64');
      } catch (wavErr) {
        console.error("[WAV Fallback Generator Error]", wavErr);
        return chunks.join("");
      }
    }

    // Fallback Rolling transcription mechanism
    async function triggerFallbackRollingTranscription() {
      if (isTranscribingFallback || accumulatedAudioChunks.length === 0) return;
      isTranscribingFallback = true;

      try {
        const len = accumulatedAudioChunks.length;
        // Take a sliding window of the last 20 chunks (~6 seconds of conversation context)
        const windowSize = Math.min(len, 20);
        const activeWindow = accumulatedAudioChunks.slice(len - windowSize);
        const combinedWavBase64 = getWavDataFromPcmChunks(activeWindow, 16000);

        const ai = getAiClient();
        console.log("[STT Fallback] Conducting rolling transcription on verified WAV buffer with historical offset...");
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            {
              inlineData: {
                data: combinedWavBase64,
                mimeType: "audio/wav"
              }
            },
            {
              text: `Perform exact, verbatim speech-to-text transcription of this audio. 
Align any spoken words with the text that has been transcribed so far from the beginning of this turn:
"${accumulatedTranscriptText}"

Append any newly spoken words that occur in this audio window to that text and return the entire, updated accumulated transcription.
Do NOT output anything other than the exact updated transcription of this turn. If there is no new speech or silence, output the previous text unmodified. Do not repeat words if they are already in the transcription.`
            }
          ]
        });

        const textOutput = response.text || "";
        const cleanText = textOutput.trim();
        if (cleanText) {
          accumulatedTranscriptText = cleanText;
          clientWs.send(JSON.stringify({ type: "transcript", text: accumulatedTranscriptText, isFinal: false }));
        }
      } catch (err: any) {
        console.warn("[Rolling Fallback Error]", err.message);
      } finally {
        isTranscribingFallback = false;
      }
    }

    clientWs.on("close", () => {
      console.log("[WebSocket] Client disconnected.");
      if (liveSession) {
        try {
          liveSession.close();
        } catch (closeErr) {
          console.warn("Could not close Gemini Live session cleanly:", closeErr);
        }
      }
    });
  });
}

startServer();
