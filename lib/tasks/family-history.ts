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

const personSchema = z.object({
  id: z.string(),
  names: z.array(z.object({
    value: z.string(),
    type: z.enum(['BIRTH', 'MARRIED', 'NICKNAME', 'RELIGIOUS', 'PROFESSIONAL', 'ALTER']).optional(),
    line_no: z.number(),
    phrase: z.string(),
  })).optional().default([]),
  birth: z.object({
    year: z.number(), month: z.number().optional(), day: z.number().optional(),
    modifier: z.enum(['CIRCA', 'BEFORE', 'AFTER']).optional(),
    precision: z.enum(['DECADE', 'YEAR', 'MONTH', 'DAY']), line_no: z.number(), phrase: z.string()
  }).passthrough().optional().nullable(),
  death: z.object({
    year: z.number(), month: z.number().optional(), day: z.number().optional(),
    modifier: z.enum(['CIRCA', 'BEFORE', 'AFTER']).optional(),
    precision: z.enum(['DECADE', 'YEAR', 'MONTH', 'DAY']), line_no: z.number(), phrase: z.string()
  }).passthrough().optional().nullable(),
  sex: z.enum(['M', 'F', 'X']).optional(),
  gender: z.string().optional(),
  parents: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
  partners: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
  children: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
  member_of: z.array(z.object({ group_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
  located_at: z.array(z.object({ place_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
}).passthrough();

const analysisSchema = z.object({
  ambiguities: z.array(ambiguitySchema).optional().default([]),
  people: z.array(personSchema).optional().default([]),
  groups: z.array(z.object({
    id: z.string(), name: z.string(),
    group_type: z.enum(['FAMILY', 'HOUSEHOLD', 'FRIENDSHIP', 'CREW', 'ORGANIZATION', 'EMPLOYER']).optional(),
    line_no: z.number(), phrase: z.string()
  }).passthrough()).optional().default([]),
  events: z.array(z.object({
    id: z.string(), name: z.string(),
    event_type: z.enum(['BIRTH', 'DEATH', 'MIGRATION', 'CONSTRUCTION', 'WEDDING', 'BUILT', 'DESTROYED', 'PURCHASED', 'SOLD', 'VISITED', 'OTHER']).optional(),
    date: z.object({
      year: z.number(), month: z.number().optional(), day: z.number().optional(),
      modifier: z.enum(['CIRCA', 'BEFORE', 'AFTER']).optional(),
      precision: z.enum(['DECADE', 'YEAR', 'MONTH', 'DAY'])
    }).passthrough().optional().nullable(),
    line_no: z.number(), phrase: z.string()
  }).passthrough()).optional().default([]),
  places: z.array(z.object({
    id: z.string(), name: z.string(),
    place_type: z.enum(['COUNTRY', 'STATE', 'COUNTY', 'CITY', 'SUBURB', 'ADDRESS', 'LANDMARK']).optional(),
    line_no: z.number(), phrase: z.string()
  }).passthrough()).optional().default([]),
  roles: z.array(z.object({
    id: z.string(), title: z.string(),
    type: z.enum(['OCCUPATION', 'EDUCATION', 'VOLUNTEER', 'CLERGY', 'MILITARY']).optional(),
    line_no: z.number(), phrase: z.string()
  }).passthrough()).optional().default([]),
  attributes: z.array(z.object({
    id: z.string(), name: z.string(),
    type: z.enum(['condition', 'trait', 'skill', 'language']).optional(),
    description: z.string().optional(), line_no: z.number(), phrase: z.string()
  }).passthrough()).optional().default([]),
  duplicates: z.array(duplicateSchema).optional().default([]),
});

const sequentialStep1Schema = z.object({
  people: z.array(z.object({
    id: z.string(),
    names: z.array(z.object({ value: z.string(), type: z.string().optional(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    birth: z.object({ year: z.number(), precision: z.string(), line_no: z.number(), phrase: z.string() }).passthrough().optional().nullable(),
    death: z.object({ year: z.number(), precision: z.string(), line_no: z.number(), phrase: z.string() }).passthrough().optional().nullable(),
    sex: z.string().optional(),
    gender: z.string().optional(),
  }).passthrough()).optional().default([]),
});

const sequentialStep2Schema = z.object({
  relationships: z.array(z.object({
    person_id: z.string(),
    parents: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    partners: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    children: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    member_of: z.array(z.object({ group_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    located_at: z.array(z.object({ place_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
  }).passthrough()).optional().default([]),
  groups: z.array(z.object({ id: z.string(), name: z.string(), group_type: z.string().optional(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
});

const sequentialStep3Schema = z.object({
  events: z.array(z.object({ id: z.string(), name: z.string(), event_type: z.string().optional(), date: z.object({ year: z.number(), precision: z.string() }).passthrough().optional().nullable(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
  places: z.array(z.object({ id: z.string(), name: z.string(), place_type: z.string().optional(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
  roles: z.array(z.object({ id: z.string(), title: z.string(), type: z.string().optional(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
  attributes: z.array(z.object({ id: z.string(), name: z.string(), type: z.string().optional(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
  ambiguities: z.array(ambiguitySchema).optional().default([]),
  duplicates: z.array(duplicateSchema).optional().default([]),
});

export const systemPrompt = `You are a family history analyst. Given an oral history transcript with [LINE_NUMBER] prefixes:

Identify EVERY person, group, place, event, role, and attribute mentioned. Be thorough — do not skip any entity.

Return ONLY valid JSON. No markdown, no commentary, no code fences.

Enum values for each field:
- person.sex: "M", "F", or "X"
- name.type: "BIRTH", "MARRIED", "NICKNAME", "RELIGIOUS", "PROFESSIONAL", "ALTER"
- group.group_type: "FAMILY", "HOUSEHOLD", "FRIENDSHIP", "CREW", "ORGANIZATION", "EMPLOYER"
- event.event_type: "BIRTH", "DEATH", "MIGRATION", "CONSTRUCTION", "WEDDING", "BUILT", "DESTROYED", "PURCHASED", "SOLD", "VISITED", "OTHER"
- place.place_type: "COUNTRY", "STATE", "COUNTY", "CITY", "SUBURB", "ADDRESS", "LANDMARK"
- role.type: "OCCUPATION", "EDUCATION", "VOLUNTEER", "CLERGY", "MILITARY"
- attribute.type: "condition", "trait", "skill", "language"
- date.precision: "DECADE", "YEAR", "MONTH", "DAY"
- date.modifier: "CIRCA", "BEFORE", "AFTER"
- ambiguity.type: "geographic", "onomastic", "contextual", "transcription"

For every entity, include:
- line_no: the line number from the [LINE_NUMBER] prefix where this entity is mentioned
- phrase: the EXACT transcript text that mentions this entity, quoted verbatim

Do not include entities that are not present in the transcript.
Do not make up information not stated in the transcript.`;

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

export const oneShotNonStrictPrompt = `Extract ALL entities from the transcript above into this exact JSON structure:

{
  "ambiguities": [
    {
      "type": "geographic",
      "span": [0, 0],
      "original": "ambiguous text",
      "suggestion": "best guess",
      "alternatives": ["other possibility"],
      "reasoning": "why this is ambiguous"
    }
  ],
  "people": [
    {
      "id": "p1",
      "names": [
        { "value": "John Smith", "type": "BIRTH", "line_no": 1, "phrase": "My name is John Smith" }
      ],
      "birth": { "year": 1890, "precision": "YEAR", "line_no": 1, "phrase": "I was born in 1890" },
      "death": null,
      "sex": "M",
      "parents": [{ "person_id": "p2", "line_no": 2, "phrase": "my father" }],
      "partners": [],
      "children": [],
      "member_of": [],
      "located_at": [{ "place_id": "pl1", "line_no": 1, "phrase": "born in 1890 in Manchester" }]
    }
  ],
  "groups": [
    { "id": "g1", "name": "Salvation Army", "group_type": "ORGANIZATION", "line_no": 5, "phrase": "joined the Salvation Army" }
  ],
  "events": [
    { "id": "e1", "name": "Wedding", "event_type": "WEDDING", "date": { "year": 1920, "precision": "YEAR" }, "line_no": 3, "phrase": "married Mary Jones in 1920" }
  ],
  "places": [
    { "id": "pl1", "name": "Manchester", "place_type": "CITY", "line_no": 1, "phrase": "born in 1890 in Manchester" }
  ],
  "roles": [
    { "id": "r1", "title": "Coal miner", "type": "OCCUPATION", "line_no": 2, "phrase": "worked as a coal miner" }
  ],
  "attributes": [
    { "id": "a1", "name": "Lung disease", "type": "condition", "line_no": 8, "phrase": "died in 1932 from lung disease" }
  ],
  "duplicates": []
}

Return ONLY the JSON object. No markdown, no backticks, no commentary.`;

export const oneShotStrictPrompt = `Extract ALL genealogical entities from the transcript above.

Your response MUST be a valid JSON object with these keys:
- "ambiguities": array of ambiguous references (each with: type, span, original, suggestion, alternatives, reasoning)
- "people": array of person objects (each with: id, names[], birth, death, sex, parents[], partners[], children[], member_of[], located_at[])
- "groups": array of group objects (each with: id, name, group_type, line_no, phrase)
- "events": array of event objects (each with: id, name, event_type, date, line_no, phrase)
- "places": array of place objects (each with: id, name, place_type, line_no, phrase)
- "roles": array of role objects (each with: id, title, type, line_no, phrase)
- "attributes": array of attribute objects (each with: id, name, type, line_no, phrase)
- "duplicates": array of duplicate flag objects

Include the line_no and exact phrase from the transcript for every entity. Use proper enum values as described in the system prompt. Do not return empty arrays for entity types that ARE present in the transcript.`;

export const sequentialPrompts = {
  step1: {
    nonStrict: `Extract ALL people mentioned in the transcript — their names, dates of birth and death, sex, and gender.

Return JSON like this exact example:
{"people": [{"id": "p1", "names": [{"value": "John Smith", "type": "BIRTH", "line_no": 1, "phrase": "My name is John Smith"}], "birth": {"year": 1890, "precision": "YEAR", "line_no": 1, "phrase": "I was born in 1890"}, "death": null, "sex": "M"}]}

Include EVERY person mentioned. Set death to null if the person is still alive (not stated as deceased). Use "CIRCA", "BEFORE", or "AFTER" as modifier when the date is approximate. Precision must be "DECADE", "YEAR", "MONTH", or "DAY".

Return ONLY the JSON object. No markdown.`,
    strict: `Extract ALL people mentioned in the transcript — their names, dates of birth and death, and sex.

Your response MUST contain a "people" array. Each person has:
- id: unique identifier like "p1", "p2"
- names: array of name objects with value, type, line_no, phrase
- birth: object with year, precision, line_no, phrase (or null)
- death: object with year, precision, line_no, phrase (or null)
- sex: "M", "F", or "X"
- gender: optional string

Include line_no and exact phrase for every field. Be thorough.`,
  },
  step2: {
    nonStrict: `Identify the relationships between the people you found, their group memberships, and locations.

Return JSON like this exact example:
{"relationships": [{"person_id": "p1", "parents": [{"person_id": "p2", "line_no": 2, "phrase": "My father was Robert Smith"}], "partners": [], "children": [{"person_id": "p4", "line_no": 4, "phrase": "Thomas born 1921"}], "member_of": [{"group_id": "g1", "line_no": 5, "phrase": "joined the Salvation Army"}], "located_at": [{"place_id": "pl1", "line_no": 1, "phrase": "born in 1890 in Manchester"}]}], "groups": [{"id": "g1", "name": "Salvation Army", "group_type": "ORGANIZATION", "line_no": 5, "phrase": "joined the Salvation Army"}]}

The person_id values must match the "id" values from step 1.
Return ONLY the JSON. No markdown.`,
    strict: `Identify the relationships between the people you found, their group memberships, and locations.

Your response MUST contain:
- "relationships": array of relationship objects (each with person_id, parents[], partners[], children[], member_of[], located_at[])
- "groups": array of group objects (each with id, name, group_type, line_no, phrase)

The person_id values must match the "id" values from step 1's output. Be thorough.`,
  },
  step3: {
    nonStrict: `Identify events, places, roles, attributes, ambiguities, and duplicates from the transcript.

Return JSON like this exact example:
{"events": [{"id": "e1", "name": "Wedding", "event_type": "WEDDING", "date": {"year": 1920, "precision": "YEAR"}, "line_no": 3, "phrase": "I married Mary Jones in 1920"}], "places": [{"id": "pl1", "name": "Manchester", "place_type": "CITY", "line_no": 1, "phrase": "born in 1890 in Manchester"}], "roles": [{"id": "r1", "title": "Coal miner", "type": "OCCUPATION", "line_no": 2, "phrase": "worked as a coal miner"}], "attributes": [{"id": "a1", "name": "Lung disease", "type": "condition", "line_no": 8, "phrase": "lung disease"}], "ambiguities": [], "duplicates": []}

Event types: BIRTH, DEATH, MIGRATION, WEDDING, etc.
Place types: CITY, COUNTRY, ADDRESS, LANDMARK, etc.
Role types: OCCUPATION, EDUCATION, MILITARY, etc.
Attribute types: condition, trait, skill, language
Return ONLY the JSON. No markdown.`,
    strict: `Identify events, places, roles, attributes, ambiguities, and duplicates from the transcript.

Your response MUST contain:
- "events": array of event objects (each with id, name, event_type, date, line_no, phrase)
- "places": array of place objects (each with id, name, place_type, line_no, phrase)
- "roles": array of role objects (each with id, title, type, line_no, phrase)
- "attributes": array of attribute objects (each with id, name, type, line_no, phrase)
- "ambiguities": array of ambiguity objects (each with type, span, original, suggestion, alternatives, reasoning)
- "duplicates": array of duplicate flag objects

Use proper enum values from the system prompt. Include line_no and exact phrase for every entity. Be thorough.`,
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
      const { person_id, ...rest } = relData;
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
      merge: (parts: [unknown, unknown, unknown]) => mergeSequentialAnalysis(parts[0], parts[1], parts[2]),
    },
  },
  retryPrompt: getRetryPrompt,
};

registerTask(familyHistoryTask);
