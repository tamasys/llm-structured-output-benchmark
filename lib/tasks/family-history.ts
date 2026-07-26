import { z } from 'zod';
import { registerTask, type Task } from '../task';
import { getRetryPrompt } from '../prompts';

const ambiguitySchema = z.object({
  type: z.enum(['geographic', 'onomastic', 'contextual', 'transcription']),
  line_no: z.number(),
  phrase: z.string(),
  issue: z.string(),
  possibilities: z.array(z.string()).optional().default([]),
  certainty: z.enum(['high', 'low', 'speculative', 'contradiction']),
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
  roles: z.array(z.object({
    title: z.string(),
    type: z.enum(['OCCUPATION', 'EDUCATION', 'VOLUNTEER', 'CLERGY', 'MILITARY']).optional(),
    line_no: z.number(), phrase: z.string()
  }).passthrough()).optional().default([]),
  attributes: z.array(z.object({
    name: z.string(),
    type: z.enum(['medical_condition', 'trait', 'skill', 'language']).optional(),
    description: z.string().optional(), line_no: z.number(), phrase: z.string()
  }).passthrough()).optional().default([]),
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
});

const sequentialStep1Schema = z.object({
  people: z.array(z.object({
    id: z.string(),
    names: z.array(z.object({ value: z.string(), type: z.string().optional(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    birth: z.object({ year: z.number(), precision: z.string(), line_no: z.number(), phrase: z.string() }).passthrough().optional().nullable(),
    death: z.object({ year: z.number(), precision: z.string(), line_no: z.number(), phrase: z.string() }).passthrough().optional().nullable(),
    sex: z.string().optional(),
    gender: z.string().optional(),
    roles: z.array(z.object({ title: z.string(), type: z.string().optional(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
    attributes: z.array(z.object({ name: z.string(), type: z.string().optional(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
  }).passthrough()).optional().default([]),
});

const sequentialStep2Schema = z.object({
  events: z.array(z.object({ id: z.string(), name: z.string(), event_type: z.string().optional(), date: z.object({ year: z.number(), precision: z.string() }).passthrough().optional().nullable(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
  places: z.array(z.object({ id: z.string(), name: z.string(), place_type: z.string().optional(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
  groups: z.array(z.object({ id: z.string(), name: z.string(), group_type: z.string().optional(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
});

const sequentialStep3Schema = z.object({
  relationships: z.array(z.object({
    person_id: z.string(),
    parents: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    partners: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    children: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    member_of: z.array(z.object({ group_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    located_at: z.array(z.object({ place_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
  }).passthrough()).optional().default([]),
  ambiguities: z.array(ambiguitySchema).optional().default([]),
});

export const systemPrompt = `You are a family history analyst. Given an oral history transcript with [LINE_NUMBER] prefixes:

Identify EVERY person, group, place, event, role, and attribute mentioned. Be thorough.

Infer implied relationships from context. For example, if someone refers to another person in a way that implies a relationship (e.g. "my mother", "your brother", "mum"), connect them. If the exact relationship is unclear, flag it in ambiguities.

Return ONLY valid JSON. No markdown, no commentary, no code fences.

Enum values for each field:
- person.sex: "M", "F", or "X"
- name.type: "BIRTH", "MARRIED", "NICKNAME", "RELIGIOUS", "PROFESSIONAL", "ALTER"
- group.group_type: "FAMILY", "HOUSEHOLD", "FRIENDSHIP", "CREW", "ORGANISATION", "EMPLOYER"
- event.event_type: "BIRTH", "DEATH", "MIGRATION", "CONSTRUCTION", "WEDDING", "BUILT", "DESTROYED", "PURCHASED", "SOLD", "VISITED", "OTHER"
- place.place_type: "COUNTRY", "STATE", "COUNTY", "CITY", "SUBURB", "ADDRESS", "LANDMARK"
- role.type: "OCCUPATION", "EDUCATION", "VOLUNTEER", "CLERGY", "MILITARY"
- attribute.type: "medical_condition" for diagnoses/injuries/illnesses, "trait" for personality descriptors, "skill" for learned abilities, "language" for languages spoken
- date.precision: "DECADE", "YEAR", "MONTH", "DAY"
- date.modifier: "CIRCA", "BEFORE", "AFTER"
- ambiguity.type: "geographic" (place confusion), "onomastic" (name confusion), "contextual" (situational uncertainty), "transcription" (unclear wording)
- ambiguity.certainty: "high" (nearly certain), "low" (best guess), "speculative" (possible but unconfirmed), "contradiction" (conflicting information)

For every entity, include:
- line_no: the line number from the [LINE_NUMBER] prefix where this entity is mentioned
- phrase: the EXACT transcript text that mentions this entity, quoted verbatim

For ambiguities:
- issue: Explain what is ambiguous and why
- possibilities: List the possible interpretations as strings. This can be possible identities for an unknown person ("Thomas Baker (the neighbour's son)", "Thomas Baker (the cousin from Liverpool)"), possible explanations for contradictory data ("Sarah was older than 30 at marriage", "Marriage year was 1905, not 1900"), or possible choices for an unclear relationship ("List Arthur and James as probable partners", "List Arthur and James as business associates").

Do not fabricate entities or relationships not grounded in the transcript. But DO connect dots that the transcript clearly implies. If something is ambiguous or contradictory, flag it in ambiguities rather than remaining silent.`;

export const transcript = `[1] Sammy: Thanks for sitting down with me today. Could we start with your full name and when you were born?
[2] Margaret: Margaret, uh, Margaret Ellen Bishop. Born 1908, in Oxford. My father was a lecturer at the college.
[3] Sammy: And your parents? What were their names?
[4] Margaret: My mother was Eleanor, Eleanor Bishop. She was a nurse before she married. And my father was Harold.
[5] Harold Bishop, that is. He taught history at Oriel College for... oh, nearly forty years.
[6] Sammy: Do you have any siblings?
[7] Margaret: I had a brother, William. William Arthur Bishop. He was older by about four years.
[8] Sammy: What happened to William?
[9] Margaret: He died. In the war. The Great War, I mean. 1917 it was. He was only nineteen. My mother never really got over it.
[10] Sammy: I'm sorry to hear that. And what about after the war - did you marry?
[11] Margaret: Yes. I met a man named George. George Watson. He was a... well, a carpenter I suppose you'd say, but cabinetmaker, he always insisted on cabinetmaker.
[12] We married in 1930. At St. Ebbe's, that was her church... my mother's church, I mean.
[13] Sammy: And where did you and George live?
[14] Margaret: We had a flat on Iffley Road, just off the Iffley Road, in Oxford. It was small but it was home.
[15] Sammy: Did you have children?
[16] Margaret: We had two. A girl first, Eleanor-
[17] Sammy: Oh, after your mother?
[18] Margaret: Yes, She was so proud. Born 1932.
[19] And then a boy, Harold. After my father. He was born in 19... let me think - 1935? No, 1936. Yes, 1936.
[20] Sammy: And what did George do for work later on?
[21] Margaret: He worked at the Morris plant, Morris Motors, in Cowley. Started on the line, worked his way up to supervisor by the time he retired.
[22] He was there for, oh, thirty years? Maybe thirty-five. From about 1932 until he retired in 1965.
[23] Sammy: Did you work as well?
[24] Margaret: I worked at the library, The Bodleian, actually. Not as a librarian, I was in the catalogue room. Started in 1926, before I was married. I left when Eleanor was born.
[25] Then later, after the children were grown, I went back. Part-time, in the mid-fifties, I suppose. Stayed until 1970.
[26] Sammy: What happened to George?
[27] Margaret: He passed in 1978. Heart trouble. He'd had problems for years, but he wouldn't see a doctor. Stubborn.
[28] Sammy: And how are your children going now?
[29] Margaret: Eleanor - we called her Ellie - she became a teacher. Married a man named David, David Cook. They moved to Canada, of all places. Toronto. That was in 1958.
[30] Harold - he went to university. First in the family to go. He studied engineering at, uh, at Bristol, I think it was. Or was it Birmingham? No, Bristol. He works in aerospace.
[31] Sammy: Any other family you remember? Aunts, uncles, cousins?
[32] Margaret: And then there's my mother's sister, Aunt Gertrude, lived with us for a while after Uncle Arthur passed. He died in... 1933? Something like that. She stayed until she passed in the early sixties.
[33] And there was my father's brother, Charles. Uncle Charles. He never married. He was a missionary in Africa.
[34] Sammy: Oh yes mum mentioned I should ask about him! She said she visited him once when she was little.
[35] Margaret: Ah, yes. We'd get letters from him and his travelmate Stephen - they were a bit more than travelmates from the sounds of it - maybe once or twice a year.
[36] I remember him mentioning that Charlotte visited. I don't know what happened to them after my father died.
[37] Sammy: Is there anything else you'd like to add?
[38] Margaret: Just that... my brother William was the smart one, everyone said so. But he went to war and that was that. I often wonder what he would have made of everything.`;

export const oneShotNonStrictPrompt = `Extract ALL entities from the transcript above into this exact JSON structure:

{
  "ambiguities": [
    {
      "type": "contextual",
      "line_no": 99,
      "phrase": "my great aunt Mildred who lived in Brighton",
      "issue": "Mildred is called 'great aunt' but it is not specified whether she was the grandmother's sister or the grandfather's sister, nor which side of the family she belongs to.",
      "possibilities": ["Mildred was the grandmother's sister (maternal great aunt)", "Mildred was the grandfather's sister (paternal great aunt)"],
      "certainty": "low"
    }
  ],
  "people": [
    {
      "id": "p1",
      "names": [
        { "value": "John Smith", "type": "BIRTH", "line_no": 99, "phrase": "my name is John Smith" }
      ],
      "birth": { "year": 1890, "precision": "YEAR", "line_no": 99, "phrase": "I was born in 1890" },
      "death": null,
      "sex": "M",
      "parents": [{ "person_id": "p2", "line_no": 99, "phrase": "my father was a farmer" }],
      "partners": [],
      "children": [],
      "member_of": [],
      "located_at": [{ "place_id": "pl4", "line_no": 99, "phrase": "grew up in a small village" }, { "place_id": "pl2", "line_no": 99, "phrase": "went to university in Portsmouth" }],
      "attributes": [
        { "name": "Arthritis", "type": "medical_condition", "line_no": 99, "phrase": "suffered from arthritis in later years" },
        { "name": "Skilled musician", "type": "trait", "line_no": 99, "phrase": "could sit at the piano and play any tune we asked for" }
      ],
      "roles": [
        { "title": "Schoolteacher", "type": "OCCUPATION", "line_no": 99, "phrase": "worked as a schoolteacher for thirty years", "groups": ["g2"]},
        { "title": "Nursing student", "type": "EDUCATION", "line_no": 99, "phrase": "went to nursing school in... Berlin, I think", "places": ["pl3"]}
      ]
    }
  ],
  "groups": [
    { "id": "g1", "name": "Church Choir", "group_type": "FRIENDSHIP", "line_no": 99, "phrase": "sang in the church choir" },
    { "id": "g2", "name": "Stonehill State School", "group_type": "EMPLOYER", "line_no": 99, "phrase": "at Stonehill, it was what you'd call a public school" }
  ],
  "events": [
    { "id": "e1", "name": "Wedding", "event_type": "WEDDING", "date": { "year": 1923, "precision": "YEAR" }, "line_no": 99, "phrase": "they got married in the spring of 23" }
  ],
  "places": [
    { "id": "pl1", "name": "Dover", "place_type": "CITY", "line_no": 99, "phrase": "moved to Dover after the war" }
  ]
}

Return ONLY the JSON object. No markdown, no backticks, no commentary.`;

export const oneShotStrictPrompt = `Extract ALL genealogical entities from the transcript above.

Your response MUST be a valid JSON object with these keys:
- "ambiguities": array of ambiguous references, contradictions, or unclear relationships (each with: type, line_no, phrase, issue, possibilities[], certainty)
- "people": array of person objects (each with: id, names[], birth, death, sex, parents[], partners[], children[], member_of[], located_at[], roles[], attributes[])
- "groups": array of group objects (each with: id, name, group_type, line_no, phrase)
- "events": array of event objects (each with: id, name, event_type, date, line_no, phrase)
- "places": array of place objects (each with: id, name, place_type, line_no, phrase)
- "relationships": array of relationships between entities

Include the line_no and exact phrase from the transcript for every entity. Use proper enum values as described in the system prompt. Do not return empty arrays for entity types that ARE present in the transcript.

For ambiguities: issue describes what is uncertain, possibilities lists possible resolutions, certainty is one of "high", "low", "speculative", "contradiction".`;

export const sequentialPrompts = {
  step1: {
    nonStrict: `Extract ALL people mentioned in the transcript — their names, dates of birth and death, sex, gender, roles, and attributes. Other details will be added in subsequent steps.

Return JSON like this exact example:
{"people": [{"id": "p1", "names": [{"value": "John Smith", "type": "BIRTH", "line_no": 99, "phrase": "my name is John Smith"}], "birth": {"year": 1890, "precision": "YEAR", "line_no": 99, "phrase": "I was born in 1890"}, "death": null, "sex": "M"} "roles": [{"title": "Schoolteacher", "type": "OCCUPATION", "line_no": 99, "phrase": "worked as a teacher"}], "attributes": [{"name": "Arthritis", "type": "medical_condition", "line_no": 99, "phrase": "suffered from arthritis"}]]}

Include EVERY person mentioned, even implied ones (like Sammy, who may be a child/grandchild). Set death to null if the person is still alive. Use "CIRCA", "BEFORE", or "AFTER" as modifier when the date is approximate. Precision must be "DECADE", "YEAR", "MONTH", or "DAY".

Return ONLY the JSON object. No markdown.`,
    strict: `Extract ALL people mentioned in the transcript — their names, dates of birth and death, sex, gender, roles, and attributes.

Your response MUST contain a "people" array. Each person has:
- id: unique identifier like "p1", "p2"
- names: array of name objects with value, type, line_no, phrase
- birth: object with year, precision, line_no, phrase (or null)
- death: object with year, precision, line_no, phrase (or null)
- sex: "M", "F", or "X"
- gender: optional string
- roles: optional array of role objects (each with: title, type, line_no, phrase)
- attributes: optional array of attribute objects (each with: name, type (medical_condition/trait/skill/language), line_no, phrase)

Include line_no and exact phrase for every field. Be thorough — include implied people like Sammy.`,
  },
  step2: {
    nonStrict: `Identify the events, places, groups, and locations.

Return JSON like this exact example:
{"events": [{"id": "e1", "name": "Wedding", "event_type": "WEDDING", "date": {"year": 1920, "precision": "YEAR"}, "line_no": 99, "phrase": "married in 1920"}], "places": [{"id": "pl1", "name": "Dover", "place_type": "CITY", "line_no": 99, "phrase": "moved to Dover"}], "groups": [{"id": "g1", "name": "Village Council", "group_type": "ORGANIZATION", "line_no": 99, "phrase": "served on the village council"}]}

Event types: BIRTH, DEATH, MIGRATION, WEDDING, etc.
Place types: CITY, COUNTRY, ADDRESS, LANDMARK, etc.
Return ONLY the JSON. No markdown.`,
    strict: `Identify the events, places, groups, and locations.

Your response MUST contain:
- "events": array of event objects (each with id, name, event_type, date, line_no, phrase)
- "places": array of place objects (each with id, name, place_type, line_no, phrase)
- "groups": array of group objects (each with id, name, group_type, line_no, phrase)

The person_id values must match the "id" values from step 1's output. Infer implied relationships where the transcript clearly connects people.`,
  },
  step3: {
    nonStrict: `Identify relationships between the entities you found and ambiguities from the transcript.

Return JSON like this exact example:
{"relationships": [{"person_id": "p1", "parents": [{"person_id": "p2", "line_no": 99, "phrase": "my father was a farmer"}], "partners": [{"person_id": "p3", "line_no": 99, "phrase": "married my wife in 1910"}], "children": [{"person_id": "p4", "line_no": 99, "phrase": "our daughter Sarah"}], "member_of": [{"group_id": "g1", "line_no": 99, "phrase": "joined the village council"}], "located_at": [{"place_id": "pl1", "line_no": 99, "phrase": "lived on Mill Road"}]}], "ambiguities": [{"type": "contextual", "line_no": 99, "phrase": "my great aunt Mildred", "issue": "Mildred's exact relationship is unclear — not specified which grandparent she is sibling to", "possibilities": ["Maternal great aunt (grandmother's sister)", "Paternal great aunt (grandfather's sister)"], "certainty": "low"}]}

The person_id values must match the "id" values from step 1.
Infer implied relationships (e.g. Sammy refers to "mum" on line 34, meaning Sammy is a descendant of Margaret). Flag uncertain relationships in ambiguities.
For ambiguities: possibilities lists possible explanations; certainty is high/low/speculative/contradiction
Return ONLY the JSON. No markdown.`,
    strict: `Identify relationships between the entities you found and ambiguities from the transcript.

Your response MUST contain:
- "relationships": array of relationship objects (each with person_id, parents[], partners[], children[], member_of[], located_at[])
- "ambiguities": array of ambiguity objects (each with type, line_no, phrase, issue, possibilities[], certainty)

Use proper enum values from the system prompt. Include line_no and exact phrase for every entity. For ambiguities, issue describes what is uncertain, possibilities lists possible interpretations, certainty is one of "high"/"low"/"speculative"/"contradiction".`,
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
    ambiguities?: Array<Record<string, unknown>>;
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
    ambiguities: p3?.ambiguities ?? [],
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
