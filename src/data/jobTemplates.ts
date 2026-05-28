export interface JobTemplate {
  id: string;
  title: string;
  department: string;
  experience: string;
  description: string;
  questions: string[];
  sttEngine?: 'deepgram' | 'assemblyai' | 'whisper';
  isCommunity?: boolean;
  sharedBy?: string;
  downloads?: number;
}

export const PRE_BUILT_TEMPLATES: JobTemplate[] = [
  {
    id: 'frontend-engineer',
    title: 'Senior Frontend Engineer (React/TypeScript)',
    department: 'Engineering',
    experience: 'Senior (5+ years)',
    description: 'Expertise in modern React architectures, browser-native rendering optimization, high-fidelity responsive layouts modeled with Tailwind CSS, and core state synchronization frameworks like Zustand, Redux, or Context APIs.',
    sttEngine: 'deepgram',
    questions: [
      'How do you identify, profile, and optimize excessive or redundant re-renders in a complex React tree?',
      'When working under fluid design specs, how do you use Tailwind responsiveness directives structure styling to avoid visual layout shifts (CLS)?',
      'Explain your workflow for organizing asynchronous side-effects, server state caches, and global updates inside single page applications.',
      'Which Core Web Vitals (LCP, FID, CLS, INP) do you prioritize, and what practical strategies do you use to improve them?'
    ]
  },
  {
    id: 'backend-engineer',
    title: 'Senior Backend Systems Engineer',
    department: 'Engineering',
    experience: 'Senior (5+ years)',
    description: 'Focuses on designing high-throughput REST or GraphQL APIs, executing complex database indexing, microservices orchestration, schema migrations, and event-driven pipeline consistency under high read/write loads.',
    sttEngine: 'deepgram',
    questions: [
      'Describe how you design database indices, connection pools, and query isolation levels to handle sudden spikes in database read and write traffic.',
      'How do you structure robust security filters, rate limiters, and JWT-based authentication to defend high-exposure APIs from common vulnerability vectors?',
      'Describe a scenario where you had to manage event consistency, transaction rollbacks, or deadlocks across distributed database states.',
      'How do you approach real-time performance instrumentation, slow-query logging, and profiling for production-scale microservices?'
    ]
  },
  {
    id: 'devops-cloud',
    title: 'DevOps & Site Reliability Engineer',
    department: 'Engineering',
    experience: 'Mid-Senior (4+ years)',
    description: 'Focuses on Infrastructure as Code (IaC) architectures via Terraform, continuous deployment pipelines, container engines management, Docker, Kubernetes orchestration, load balancer optimization, and network security compliance.',
    sttEngine: 'whisper',
    questions: [
      'How do you establish secure, highly-available VPC architectures featuring private subnets, NAT gateways, and load balancers inside public clouds?',
      'What represents your standard strategy for propagating environment variables, config files, and API credentials securely in CI/CD automation?',
      'Describe how you implement and coordinate safe, zero-downtime blue-green or canary deployments on a live Kubernetes cluster.',
      'Walk through a production failure where you had to quickly trace heavy packet drops, memory leaks, or disk IO bottlenecks.'
    ]
  },
  {
    id: 'product-manager',
    title: 'Technical Product Manager',
    department: 'Product',
    experience: 'Lead (6+ years)',
    description: 'Bridges market strategy, client problems, and technical design. Synthesizes qualitative and quantitative usage data, organizes feature priorities, coordinates product roadmaps, and aligns diverse stakeholder goals.',
    sttEngine: 'assemblyai',
    questions: [
      'Describe your quantitative process for assessing high-complexity feature backlogs. How do you balance client requests with engineering debt?',
      'How do you communicate complex technical tradeoffs or roadmaps to non-technical stakeholders in Sales, Marketing, or Finance to sustain general alignment?',
      'Discuss a product launch that failed to meet key metrics. What variables did you measure, and how did you adapt the product scope following the setback?',
      'Describe your strategy for translating raw user interview notes and quantitative telemetry (such as Mixpanel) into actionable PRDs.'
    ]
  },
  {
    id: 'ui-ux-designer',
    title: 'Senior UI/UX Product Designer',
    department: 'Design',
    experience: 'Senior (5+ years)',
    description: 'Crafts interactive user flows, design system structures, accessible displays, typographic hierarchies, responsive wireframes, and ensures frictionless transitions from high-fidelity prototypes to working front-end layouts.',
    sttEngine: 'deepgram',
    questions: [
      'How do you transform core brand guidelines and strict accessibility constraints (WCAG AA/AAA) into a balanced color palette and type scale?',
      'Describe a situation where a client or developer pushed back strongly on your design choices. How did you advocate for the user while remaining collaborative?',
      'How do you coordinate your handoff workflows to front-end engineers to make sure design styles, screen sizes, and custom transitions are built exactly as intended?',
      'What is your user-testing approach to identify usability friction when wireframing a complex nested dashboard layout?'
    ]
  },
  {
    id: 'sales-growth',
    title: 'Enterprise Account Executive',
    department: 'Sales & Growth',
    experience: 'Mid-Senior (4+ years)',
    description: 'Specializes in high-ticket B2B business development, enterprise relationships management, handling complex procurement pipelines, strategic objection handling, and consistently meeting sales objectives.',
    sttEngine: 'assemblyai',
    questions: [
      'How do you map and approach decision-makers inside a complex enterprise organization featuring multiple siloed stakeholder nodes?',
      'Walk me through your framework for handling a prospect who claims your solution exceeds their allocated budget by a wide margin.',
      'How do you structure research and outline personalized product demonstrations or business cases for a highly skeptical technical buyer?',
      'Explain your process for building and maintaining healthy client partnerships following a sales contract closure to encourage renewal and account expansion.'
    ]
  }
];

export const COMMUNITY_TEMPLATES: JobTemplate[] = [
  {
    id: 'yc-seed-fit',
    title: 'Y-Combinator Startup Seed Fit Accelerator',
    department: 'Engineering',
    experience: 'Generalist (Varies)',
    description: 'Curated by the YC Founders Circle. Tailored for early-stage startup vetting where adaptability, speed, high ownership, and deep technical resourcefulness are highly valued.',
    sttEngine: 'deepgram',
    isCommunity: true,
    sharedBy: 'YC Founders Network',
    downloads: 1420,
    questions: [
      'Tell us about a passion project or enterprise feature you conceived, architected, and built entirely solo from scratch.',
      'How do you maintain output speed and high code structure quality under short deadlines when detailed specifications do not exist?',
      'Describe a critical technical failure you ran into in a production codebase. How did you react within the first hour of finding it?',
      'Why do you want to join an early-stage startup versus an established corporate organization? What parts of ambiguity excite you most?'
    ]
  },
  {
    id: 'google-ai-studio',
    title: 'Gemini LLM Integrator & Prompt Engineer',
    department: 'Engineering',
    experience: 'Specialist (2+ years)',
    description: 'Shared by the Google AI Studio community. Focuses on integrating Large Language Models client or server-side, evaluating output safety, structure matching, caching, and prompt modeling.',
    sttEngine: 'deepgram',
    isCommunity: true,
    sharedBy: 'AI Studio Dev Team',
    downloads: 940,
    questions: [
      'Describe your strategy for ensuring structured JSON schema compliance when working with Gemini or similar generative models.',
      'How do you handle prompt optimization, prompt caching mechanisms, and system execution limits when designing user-facing AI tools?',
      'Describe when you would select a smaller model alias (such as Gemini 1.5 Flash) versus a larger general model (such as Gemini 1.5 Pro).',
      'Explain how you mitigate model hallucination, protect user secrets, and filter output text patterns for sensitive topics.'
    ]
  },
  {
    id: 'hr-onboarding',
    title: 'Culture-Add & Human Decapitation Vetting',
    department: 'Operations',
    experience: 'Any Experience Level',
    description: 'FoloUp Official HR template. Designed to evaluate active listening, alignment with company objectives, communication, and emotional resilience.',
    sttEngine: 'assemblyai',
    isCommunity: true,
    sharedBy: 'FoloUp Core Team',
    downloads: 2470,
    questions: [
      'How do you handle constructive criticism or highly contradictory opinions from directly within your core operating team?',
      'What represents your strategy for managing work-life boundaries, avoiding burnout, and supporting peers under heavy sprints?',
      'Describe a situation where a misunderstanding caused a workflow bottleneck. How did you resolve the situation and what did you implement to prevent it?'
    ]
  }
];
