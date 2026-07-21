import { z } from 'zod';
import { registerTask, type Task } from '../task';
import { getRetryPrompt } from '../prompts';

// ========================
// Schemas (from schemas.ts)
// ========================

export const ModelTypeSchema = z.enum(['reasoning', 'semantic'])
  .describe('Model type: "reasoning" for analytical/logical tasks, "semantic" for creative/conversational tasks');

export const ActorSchema = z.object({
  title: z.string()
    .min(2)
    .describe('Job title for the recommended team member (e.g., "Database Administrator", "DevOps Engineer")'),

  reason: z.string()
    .min(20)
    .describe('Explanation of why this role is needed and how it addresses the team\'s skill gap'),

  skills: z.array(z.string())
    .describe('Array of 3-7 specific technical skills required for this role'),

  prompt: z.string()
    .min(30)
    .describe('System prompt to configure an AI assistant for this role, describing their expertise and approach'),

  model: ModelTypeSchema,
});

export const ActionSchema = z.object({
  type: z.literal('create_actor')
    .describe('Action type identifier'),

  actor: ActorSchema
    .describe('Details of the team member to add'),
});

export const ResponseSchema = z.object({
  recommendation: z.string()
    .min(20)
    .describe('A conversational message explaining the hiring recommendation, starting with "I think you need to hire..."'),

  action: ActionSchema.nullable()
    .describe('The action to take: create_actor to recommend a new team member, or null if no recommendation is appropriate'),
});

export const SequentialPart1Schema = z.object({
  recommendation: z.string()
    .min(20)
    .describe('A conversational message explaining the hiring recommendation'),

  action: z.literal('create_actor').nullable()
    .describe('Set to "create_actor" if recommending a new team member, or null if not'),
});

export const SequentialPart2Schema = z.object({
  title: z.string()
    .min(2)
    .describe('Job title for the recommended team member'),

  reason: z.string()
    .min(20)
    .describe('Explanation of why this role is needed'),

  skills: z.array(z.string())
    .describe('Array of 3-7 specific technical skills required')
});

export const SequentialPart3Schema = z.object({
  prompt: z.string()
    .min(30)
    .describe('System prompt to configure an AI assistant for this role'),

  model: ModelTypeSchema
    .describe('Model type suited for this role'),
});

export type ModelType = z.infer<typeof ModelTypeSchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Response = z.infer<typeof ResponseSchema>;
export type SequentialPart1 = z.infer<typeof SequentialPart1Schema>;
export type SequentialPart2 = z.infer<typeof SequentialPart2Schema>;
export type SequentialPart3 = z.infer<typeof SequentialPart3Schema>;

export function mergeSequentialParts(
  part1: SequentialPart1,
  part2: SequentialPart2,
  part3: SequentialPart3
): Response {
  return {
    recommendation: part1.recommendation,
    action: part1.action === 'create_actor' ? {
      type: 'create_actor',
      actor: {
        title: part2.title,
        reason: part2.reason,
        skills: part2.skills,
        prompt: part3.prompt,
        model: part3.model,
      },
    } : null,
  };
}

// ========================
// Conversation data (from conversation.ts)
// ========================

export interface Message {
  participant: string;
  message: string;
}

export const participants = [
  { name: 'Alex', role: 'Tech Lead', expertise: 'Full-stack, React, Node.js' },
  { name: 'Jordan', role: 'Backend Developer', expertise: 'Python, APIs, microservices' },
  { name: 'Sam', role: 'Frontend Developer', expertise: 'React, TypeScript, UI/UX' },
  { name: 'Casey', role: 'Product Manager', expertise: 'Requirements, roadmap, customer feedback' },
  { name: 'Morgan', role: 'DevOps Engineer', expertise: 'CI/CD, Docker, basic AWS' },
] as const;

export const conversation: Message[] = [
  {
    participant: 'Casey',
    message: "Hey team, we've got a problem. Three enterprise customers are complaining about slow load times on the dashboard. One of them is threatening to churn if we don't fix it by end of month.",
  },
  {
    participant: 'Alex',
    message: "I've been looking into it. The main dashboard query is taking 8-12 seconds on accounts with more than 50k records. It's definitely a database issue.",
  },
  {
    participant: 'Jordan',
    message: "I added some basic indexes last week but it didn't help much. The query is joining across 4 tables and aggregating a lot of data.",
  },
  {
    participant: 'Sam',
    message: "From the frontend side, I can add loading skeletons and pagination, but that's just masking the problem. Users are going to notice the wait regardless.",
  },
  {
    participant: 'Morgan',
    message: "I checked the database server metrics. CPU and memory look fine, but I'm seeing a lot of disk I/O. Not sure what that means for query performance though.",
  },
  {
    participant: 'Alex',
    message: "I tried rewriting the query to use subqueries instead of joins, but it actually made it slower. I'm kind of out of ideas here.",
  },
  {
    participant: 'Jordan',
    message: 'Should we look at caching? We could cache the dashboard data in Redis and refresh it every few minutes.',
  },
  {
    participant: 'Casey',
    message: "The customers want real-time data, or at least near real-time. A few minutes delay isn't going to work for their use case.",
  },
  {
    participant: 'Sam',
    message: "What about lazy loading sections of the dashboard? We could load the critical metrics first and the rest async.",
  },
  {
    participant: 'Alex',
    message: "That helps with perceived performance, but the underlying query is still slow. And some customers have dashboards with all sections visible - they'd still see the delay.",
  },
  {
    participant: 'Morgan',
    message: 'I could spin up a read replica to offload the dashboard queries from the primary database. Would that help?',
  },
  {
    participant: 'Jordan',
    message: "It might reduce load on the primary, but the query itself would still be slow. We need to optimise the actual query execution.",
  },
  {
    participant: 'Casey',
    message: "What about the table structure itself? Maybe we need to redesign how we're storing this data?",
  },
  {
    participant: 'Alex',
    message: "That's crossed my mind. But honestly, I'm not confident about making schema changes without knowing exactly what's causing the bottleneck. We could make it worse.",
  },
  {
    participant: 'Jordan',
    message: "I looked at EXPLAIN ANALYZE on the query. There's a sequential scan on the events table that takes most of the time. But I'm not sure how to fix it without breaking other queries that depend on that table.",
  },
  {
    participant: 'Morgan',
    message: "Should we consider moving to a different database? I've heard TimescaleDB is good for time-series data, and a lot of our data is event-based.",
  },
  {
    participant: 'Alex',
    message: "That's a huge migration. We'd need someone who really knows what they're doing to evaluate whether it's worth it and plan the migration properly.",
  },
  {
    participant: 'Sam',
    message: "It feels like we're all guessing at this point. None of us are database experts. We know enough to be dangerous but not enough to fix this properly.",
  },
  {
    participant: 'Casey',
    message: "I agree. We've been circling on this for two weeks now. Maybe we need to bring in someone who specialises in this stuff?",
  },
  {
    participant: 'Alex',
    message: "Yeah, I think that's the right call. We need someone who can analyse the query plans, optimise the schema, set up proper indexing strategies, and maybe advise on whether we need a different database architecture altogether.",
  },
];

export function formatConversation(): string {
  return conversation
    .map((msg) => `${msg.participant}: ${msg.message}`)
    .join('\n\n');
}

export function getConversationMessages(): Array<{ role: 'user' | 'assistant'; content: string }> {
  return [
    {
      role: 'user' as const,
      content: `Here is a conversation between team members discussing a problem:\n\n${formatConversation()}`,
    },
  ];
}

// ========================
// Hiring-specific prompts (from prompts.ts)
// ========================

export const systemPrompt = `You are a recruiter AI assistant. Your job is to analyse team conversations and recommend new team members who could help solve problems the team is facing.

When you identify a skill gap in the team, recommend a specific role that would fill that gap. Provide:
- A clear job title
- An explanation of why this role is needed
- The specific skills required
- A system prompt that could be used to configure an AI assistant for this role
- Whether the role requires "reasoning" (analytical/logical) or "semantic" (creative/conversational) capabilities

Be specific and practical in your recommendations.`;

export function getOneShotPrompt(): string {
  return `Based on the conversation above, recommend a team member who could help solve their problem.

Respond ONLY with valid JSON like this example:
{
  "recommendation": "I think you need to hire a [role] because [explanation of how they address the team's problem]...",
  "action": {
    "type": "create_actor",
    "actor": {
      "title": "Job Title Here",
      "reason": "Why this role addresses the team's skill gap",
      "skills": ["skill1", "skill2", "skill3"],
      "prompt": "You are an expert in [domain]. You help teams by [description of approach]...",
      "model": "reasoning"
    }
  }
}

Important:
- Return ONLY valid JSON, no markdown code blocks or backticks
- The "recommendation" field should start with "I think you need to hire..."
- Skills array should have 3-7 specific technical skills
- "model" should be "reasoning" for analytical tasks or "semantic" for creative tasks
- Set "action" to null if no recommendation is appropriate`;
}

export const oneShotStrictPrompt = `Based on the conversation above, recommend a team member who could help solve their problem.

Respond with a JSON object containing:
- "recommendation": Your explanation of why you're recommending this role
- "action": An object with "type": "create_actor" and "actor" containing:
  - "title": The job title
  - "reason": Why this role addresses the team's problem
  - "skills": Array of 3-7 required skills
  - "prompt": A system prompt for an AI in this role
  - "model": Either "reasoning" or "semantic"`;

export const sequentialPrompts = {
  step1: {
    nonStrict: `Based on the conversation, what type of team member should this team add?

Respond with JSON like this example:
{"recommendation": "I recommend hiring a [role] because [reason]...", "action": "create_actor"}

Important:
- Return ONLY valid JSON, no markdown code blocks
- The "recommendation" should explain your hiring recommendation (at least 20 characters)
- Set "action" to "create_actor" if recommending someone, or null if not`,

    strict: `Based on the conversation, what type of team member should this team add?

Respond with a JSON object containing:
- "recommendation": A string explaining who should be hired and why
- "action": Either "create_actor" to recommend someone, or null

Example: {"recommendation": "I recommend hiring...", "action": "create_actor"}`,
  },

  step2: {
    nonStrict: `For the role you recommended, provide their details.

Respond with JSON like this example:
{"title": "Database Administrator", "reason": "The team needs database expertise to optimize their slow queries and design scalable schemas", "skills": ["PostgreSQL", "Query Optimization", "Database Design"]}

Important:
- Return ONLY valid JSON, no markdown code blocks
- Provide 3-7 specific technical skills
- The "reason" should explain how this role addresses the team's problem (at least 20 characters)`,

    strict: `For the role you recommended, provide their details.

Respond with a JSON object containing:
- "title": The job title (e.g., "Database Administrator")
- "reason": Why this role addresses the team's skill gap
- "skills": An array of 3-7 specific technical skills

Example: {"title": "Senior DBA", "reason": "The team needs...", "skills": ["PostgreSQL", "Query Optimization"]}`,
  },

  step3: {
    nonStrict: `For this role, provide the AI system prompt and model type.

Respond with JSON like this example:
{"prompt": "You are an expert database administrator. You help teams optimize queries, design schemas, and ensure data integrity...", "model": "reasoning"}

Important:
- Return ONLY valid JSON, no markdown code blocks
- The "prompt" should be a detailed system prompt (at least 30 characters)
- "model" should be "reasoning" for analytical tasks or "semantic" for creative tasks`,

    strict: `For this role, provide the AI configuration.

Respond with a JSON object containing:
- "prompt": A system prompt for configuring an AI assistant in this role
- "model": Either "reasoning" (for analytical/logical tasks) or "semantic" (for creative/conversational tasks)

Example: {"prompt": "You are an expert database administrator...", "model": "reasoning"}`,
  },
};

// ========================
// Task registration
// ========================

export const hiringTask: Task = {
  id: 'hiring',
  name: 'Hiring Recommendation',
  description: 'Analyze a team conversation and recommend a new team member to fill a skill gap',
  systemPrompt: systemPrompt,
  context: formatConversation(),
  scenarios: {
    oneShot: {
      nonStrict: { prompt: getOneShotPrompt(), schema: ResponseSchema },
      strict: { prompt: oneShotStrictPrompt, schema: ResponseSchema },
    },
    sequential: {
      nonStrict: {
        step1: { prompt: sequentialPrompts.step1.nonStrict, schema: SequentialPart1Schema },
        step2: { prompt: sequentialPrompts.step2.nonStrict, schema: SequentialPart2Schema },
        step3: { prompt: sequentialPrompts.step3.nonStrict, schema: SequentialPart3Schema },
      },
      strict: {
        step1: { prompt: sequentialPrompts.step1.strict, schema: SequentialPart1Schema },
        step2: { prompt: sequentialPrompts.step2.strict, schema: SequentialPart2Schema },
        step3: { prompt: sequentialPrompts.step3.strict, schema: SequentialPart3Schema },
      },
      merge: (parts: [unknown, unknown, unknown]) =>
        mergeSequentialParts(parts[0] as SequentialPart1, parts[1] as SequentialPart2, parts[2] as SequentialPart3),
    },
  },
  retryPrompt: getRetryPrompt,
};

registerTask(hiringTask);
