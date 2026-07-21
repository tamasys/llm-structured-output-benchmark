import { z } from 'zod';
import { registerTask, type Task } from '../task';
import { getRetryPrompt } from '../prompts';

const ambiguitySchema = z.object({
  type: z.enum(['geographic', 'onomastic', 'contextual', 'transcription']),
  span: z.tuple([z.number(), z.number()]),
  original: z.string(),
  suggestion: z.string(),
  alternatives: z.array(z.string()).optional().default([]),
  reasoning: z.string(),
}).passthrough();

const duplicateSchema = z.object({
  existing_rid: z.string(),
  existing_type: z.string(),
  existing_label: z.string(),
  score: z.number().min(0).max(1),
  reasoning: z.string(),
}).passthrough();

const nameSchema = z.object({
  value: z.string(),
  type: z.string().optional(),
  line_no: z.number(),
  phrase: z.string(),
});

const dateSchema = z.object({
  year: z.number(),
  month: z.number().optional(),
  day: z.number().optional(),
  modifier: z.string().optional(),
  precision: z.string(),
}).passthrough();

const personSchema = z.object({
  id: z.string(),
  names: z.array(nameSchema).optional().default([]),
  birth: dateSchema.optional().nullable(),
  death: dateSchema.optional().nullable(),
  sex: z.string().optional(),
  gender: z.string().optional(),
  parents: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
  partners: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
  children: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
  member_of: z.array(z.object({ group_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
  located_at: z.array(z.object({ place_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
}).passthrough();

export const analysisSchema = z.object({
  ambiguities: z.array(ambiguitySchema).optional().default([]),
  people: z.array(personSchema).optional().default([]),
  groups: z.array(z.object({
    id: z.string(), name: z.string(), group_type: z.string().optional(),
    line_no: z.number(), phrase: z.string(),
  }).passthrough()).optional().default([]),
  events: z.array(z.object({
    id: z.string(), name: z.string(), event_type: z.string().optional(),
    date: dateSchema.optional().nullable(),
    line_no: z.number(), phrase: z.string(),
  }).passthrough()).optional().default([]),
  places: z.array(z.object({
    id: z.string(), name: z.string(), place_type: z.string().optional(),
    line_no: z.number(), phrase: z.string(),
  }).passthrough()).optional().default([]),
  roles: z.array(z.object({
    id: z.string(), title: z.string(), type: z.string().optional(),
    line_no: z.number(), phrase: z.string(),
  }).passthrough()).optional().default([]),
  attributes: z.array(z.object({
    id: z.string(), name: z.string(), type: z.string().optional(),
    description: z.string().optional(), line_no: z.number(), phrase: z.string(),
  }).passthrough()).optional().default([]),
  duplicates: z.array(duplicateSchema).optional().default([]),
});

export const sequentialStep1Schema = z.object({
  people: z.array(z.object({
    id: z.string(),
    names: z.array(z.object({ value: z.string(), type: z.string().optional(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    birth: z.object({ year: z.number(), precision: z.string(), line_no: z.number(), phrase: z.string() }).passthrough().optional().nullable(),
    death: z.object({ year: z.number(), precision: z.string(), line_no: z.number(), phrase: z.string() }).passthrough().optional().nullable(),
    sex: z.string().optional(),
    gender: z.string().optional(),
  }).passthrough()).optional().default([]),
});

export const sequentialStep2Schema = z.object({
  relationships: z.array(z.object({
    person_id: z.string(),
    parents: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    partners: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    children: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    member_of: z.array(z.object({ group_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    located_at: z.array(z.object({ place_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
  }).passthrough()).optional().default([]),
  groups: z.array(z.object({
    id: z.string(), name: z.string(), group_type: z.string().optional(),
    line_no: z.number(), phrase: z.string(),
  }).passthrough()).optional().default([]),
});

export const sequentialStep3Schema = z.object({
  events: z.array(z.object({
    id: z.string(), name: z.string(), event_type: z.string().optional(),
    date: z.object({ year: z.number(), precision: z.string() }).passthrough().optional().nullable(),
    line_no: z.number(), phrase: z.string(),
  }).passthrough()).optional().default([]),
  places: z.array(z.object({
    id: z.string(), name: z.string(), place_type: z.string().optional(),
    line_no: z.number(), phrase: z.string(),
  }).passthrough()).optional().default([]),
  roles: z.array(z.object({
    id: z.string(), title: z.string(), type: z.string().optional(),
    line_no: z.number(), phrase: z.string(),
  }).passthrough()).optional().default([]),
  attributes: z.array(z.object({
    id: z.string(), name: z.string(), type: z.string().optional(),
    line_no: z.number(), phrase: z.string(),
  }).passthrough()).optional().default([]),
  ambiguities: z.array(ambiguitySchema).optional().default([]),
  duplicates: z.array(duplicateSchema).optional().default([]),
});

export const systemPrompt = `You are a family history analyst. Given an oral history transcript:
Identify the people, groups, places, events, roles, and attributes mentioned.
Return ONLY valid JSON matching this structure (no markdown, no commentary).
The transcript has [LINE_NUMBER] prefixes. Use line_no and quote the exact phrase.`;

export const transcript = `[1] My name is John Smith, I was born in 1890 in Manchester.
[2] My father was Robert Smith, who worked as a coal miner all his life.
[3] I married Mary Jones in 1920 at St. Mary's Church in Manchester.
[4] We had two children, Thomas born 1921 and Elizabeth born 1923.
[5] I joined the Salvation Army in 1935 where I served for twenty years.
[6] My wife Mary was a talented seamstress who made all our clothes.
[7] We lived on Baker Street in Manchester until we moved out in 1945.
[8] My father Robert died in 1932 from lung disease caused by the coal dust.
[9] After the war, Thomas moved to London to work as a clerk.
[10] Elizabeth married William Brown in 1945 and stayed nearby.`;

export const oneShotNonStrictPrompt = `Extract ALL entities from the transcript above into this JSON format:
{
  "ambiguities": [{ "type": "geographic", "span": [0,0], "original": "...", "suggestion": "...", "alternatives": [], "reasoning": "..." }],
  "people": [{ "id": "p1", "names": [{ "value": "...", "type": "BIRTH", "line_no": 1, "phrase": "..." }], "birth": { "year": 1890, "precision": "YEAR", "line_no": 1, "phrase": "..." }, "death": null, "sex": "M", "parents": [], "partners": [], "children": [], "member_of": [], "located_at": [] }],
  "groups": [{ "id": "g1", "name": "...", "group_type": "ORGANIZATION", "line_no": 5, "phrase": "..." }],
  "events": [{ "id": "e1", "name": "Wedding", "event_type": "WEDDING", "date": { "year": 1920, "precision": "YEAR" }, "line_no": 3, "phrase": "..." }],
  "places": [{ "id": "pl1", "name": "Manchester", "place_type": "CITY", "line_no": 1, "phrase": "..." }],
  "roles": [{ "id": "r1", "title": "Coal miner", "type": "OCCUPATION", "line_no": 2, "phrase": "..." }],
  "attributes": [{ "id": "a1", "name": "Poor health", "type": "condition", "line_no": 8, "phrase": "..." }],
  "duplicates": []
}
Return ONLY valid JSON, no markdown code blocks.`;

export const oneShotStrictPrompt = `Extract ALL genealogical entities from the transcript above. Include people, groups, events, places, roles, attributes, and any ambiguities.`;

export const sequentialPrompts = {
  step1: {
    nonStrict: `From the transcript, identify ALL people mentioned, their names, dates of birth and death, and sex. Return as JSON.
Example:
{"people": [{"id": "p1", "names": [{"value": "John Smith", "line_no": 1, "phrase": "My name is John Smith"}], "birth": {"year": 1890, "precision": "YEAR", "line_no": 1, "phrase": "I was born in 1890"}, "sex": "M"}]}
Return ONLY valid JSON, no markdown code blocks.`,
    strict: `From the transcript, identify ALL people mentioned, their names, dates of birth and death, and sex. Return as JSON.`,
  },
  step2: {
    nonStrict: `From the transcript, identify the relationships between people, group memberships, and locations. Return as JSON.
Example:
{"relationships": [{"person_id": "p1", "parents": [{"person_id": "p2", "line_no": 2, "phrase": "My father was Robert Smith"}], "partners": [{"person_id": "p3", "line_no": 3, "phrase": "I married Mary Jones"}]}], "groups": [{"id": "g1", "name": "Salvation Army", "group_type": "ORGANIZATION", "line_no": 5, "phrase": "I joined the Salvation Army"}]}
Return ONLY valid JSON, no markdown code blocks.`,
    strict: `From the transcript, identify the relationships between people, group memberships, and locations. Return as JSON.`,
  },
  step3: {
    nonStrict: `From the transcript, identify events, places, roles, attributes, ambiguities, and duplicates. Return as JSON.
Example:
{"events": [{"id": "e1", "name": "Wedding", "event_type": "WEDDING", "date": {"year": 1920, "precision": "YEAR"}, "line_no": 3, "phrase": "I married Mary Jones in 1920"}], "places": [{"id": "pl1", "name": "Manchester", "place_type": "CITY", "line_no": 1, "phrase": "born in 1890 in Manchester"}], "roles": [{"id": "r1", "title": "Coal miner", "type": "OCCUPATION", "line_no": 2, "phrase": "worked as a coal miner"}]}
Return ONLY valid JSON, no markdown code blocks.`,
    strict: `From the transcript, identify events, places, roles, attributes, ambiguities, and duplicates. Return as JSON.`,
  },
};

export function mergeSequentialAnalysis(
  part1: unknown,
  part2: unknown,
  part3: unknown
): unknown {
  const p1 = part1 as { people?: Array<Record<string, unknown>> };
  const p2 = part2 as { relationships?: Array<Record<string, unknown>>; groups?: Array<Record<string, unknown>> };
  const p3 = part3 as {
    events?: Array<Record<string, unknown>>;
    places?: Array<Record<string, unknown>>;
    roles?: Array<Record<string, unknown>>;
    attributes?: Array<Record<string, unknown>>;
    ambiguities?: Array<Record<string, unknown>>;
    duplicates?: Array<Record<string, unknown>>;
  };

  const relationshipsByPersonId = new Map<string, Record<string, unknown>>();
  if (p2?.relationships) {
    for (const rel of p2.relationships) {
      const pid = rel.person_id as string;
      relationshipsByPersonId.set(pid, rel);
    }
  }

  const mergedPeople = (p1?.people ?? []).map((person) => {
    const pid = person.id as string;
    const relData = relationshipsByPersonId.get(pid);
    if (relData) {
      const { person_id: _, ...rest } = relData;
      return { ...person, ...rest };
    }
    return person;
  });

  return {
    people: mergedPeople,
    groups: p2?.groups ?? [],
    events: p3?.events ?? [],
    places: p3?.places ?? [],
    roles: p3?.roles ?? [],
    attributes: p3?.attributes ?? [],
    ambiguities: p3?.ambiguities ?? [],
    duplicates: p3?.duplicates ?? [],
  };
}

export const familyHistoryTask: Task = {
  id: 'family-history',
  name: 'Family History Extraction',
  description: 'Extract genealogical entities from an oral history transcript',
  systemPrompt: systemPrompt,
  context: transcript,
  scenarios: {
    oneShot: {
      nonStrict: { prompt: oneShotNonStrictPrompt, schema: analysisSchema },
      strict: { prompt: oneShotStrictPrompt, schema: analysisSchema },
    },
    sequential: {
      nonStrict: {
        step1: { prompt: sequentialPrompts.step1.nonStrict, schema: sequentialStep1Schema },
        step2: { prompt: sequentialPrompts.step2.nonStrict, schema: sequentialStep2Schema },
        step3: { prompt: sequentialPrompts.step3.nonStrict, schema: sequentialStep3Schema },
      },
      strict: {
        step1: { prompt: sequentialPrompts.step1.strict, schema: sequentialStep1Schema },
        step2: { prompt: sequentialPrompts.step2.strict, schema: sequentialStep2Schema },
        step3: { prompt: sequentialPrompts.step3.strict, schema: sequentialStep3Schema },
      },
      merge: (parts: [unknown, unknown, unknown]) =>
        mergeSequentialAnalysis(parts[0], parts[1], parts[2]),
    },
  },
  retryPrompt: getRetryPrompt,
};

registerTask(familyHistoryTask);
