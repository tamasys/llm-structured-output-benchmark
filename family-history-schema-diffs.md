# Schema Differences: Benchmark vs Original `analysisSchema`

## 1. Ambiguity Schema

**Original (`llm.ts`):**
```typescript
const ambiguitySchema = z.object({
  type: z.enum(['geographic', 'onomastic', 'contextual', 'transcription']),
  span: z.tuple([z.number(), z.number()]),       // char offsets, computed server-side
  original: z.string(),
  suggestion: z.string(),                         // single "best guess"
  alternatives: z.array(z.string()).optional().default([]),
  reasoning: z.string(),
}).passthrough();
```

**Benchmark:**
```typescript
const ambiguitySchema = z.object({
  type: z.enum(['geographic', 'onomastic', 'contextual', 'transcription']),
  line_no: z.number(),                            // line number instead of char span
  phrase: z.string(),                             // exact transcript quote
  original: z.string(),
  issue: z.string(),                              // renamed from "reasoning"
  possibilities: z.array(z.string()).optional().default([]),  // multiple options instead of single suggestion
  certainty: z.enum(['high', 'low', 'speculative', 'contradiction']),  // new field
}).passthrough();
```

**Changes to port back:**
- `span` → `line_no` + `phrase` (more LLM-friendly, span is computed server-side anyway)
- `suggestion` + `alternatives` → `possibilities` (list of possible options rather than single best guess + extras)
- `reasoning` → `issue` (clearer name for what the ambiguity actually is)
- New: `certainty` enum (`high`/`low`/`speculative`/`contradiction`)

## 2. Attribute Type Enum

**Original (`llm.ts`):**
```typescript
type: z.string().optional(),   // free-form string
```

**Benchmark:**
```typescript
type: z.enum(['medical_condition', 'trait', 'skill', 'language']).optional(),
```

**Changes to port back:**
- `"condition"` → `"medical_condition"` (clearer, prevents confusion with arbitrary attributes)
- Added `"trait"` for personality descriptors (stubborn, talented)
- Added enum constraint rather than free-form string (helps LLM consistency)

## 3. Person Event Dates

**Original (`llm.ts`):**
```typescript
birth: z.object({
  year: z.number(), month: z.number().optional(), day: z.number().optional(),
  modifier: z.string().optional(),   // free-form string, not enum
  precision: z.string(),             // free-form string, not enum
  line_no: z.number(), phrase: z.string()
}).passthrough().optional().nullable(),
```

**Benchmark:**
```typescript
birth: z.object({
  year: z.number(), month: z.number().optional(), day: z.number().optional(),
  modifier: z.enum(['CIRCA', 'BEFORE', 'AFTER']).optional(),  // enum constrained
  precision: z.enum(['DECADE', 'YEAR', 'MONTH', 'DAY']),      // enum constrained
  line_no: z.number(), phrase: z.string()
}).passthrough().optional().nullable(),
```

**Changes to port back:**
- `modifier` constrained to enum instead of free-form string
- `precision` constrained to enum instead of free-form string

## 4. Groups

**Original (`llm.ts`):**
```typescript
groups: z.array(z.object({
  id: z.string(), name: z.string(),
  group_type: z.string().optional(),
  line_no: z.number(), phrase: z.string()
}).passthrough()).optional().default([]),
```

**Benchmark:**
```typescript
groups: z.array(z.object({
  id: z.string(), name: z.string(),
  group_type: z.enum(['FAMILY', 'HOUSEHOLD', 'FRIENDSHIP', 'CREW', 'ORGANIZATION', 'EMPLOYER']).optional(),
  line_no: z.number(), phrase: z.string()
}).passthrough()).optional().default([]),
```

**Changes to port back:**
- `group_type` constrained to enum instead of free-form string

## 5. Events

**Original (`llm.ts`):**
```typescript
events: z.array(z.object({
  id: z.string(), name: z.string(),
  event_type: z.string().optional(),
  date: z.object({ /* same fields, free-form precision/modifier */ }).passthrough().optional().nullable(),
  line_no: z.number(), phrase: z.string()
}).passthrough()).optional().default([]),
```

**Benchmark:**
```typescript
events: z.array(z.object({
  id: z.string(), name: z.string(),
  event_type: z.enum(['BIRTH', 'DEATH', 'MIGRATION', 'CONSTRUCTION', 'WEDDING', 'BUILT', 'DESTROYED', 'PURCHASED', 'SOLD', 'VISITED', 'OTHER']).optional(),
  date: z.object({ /* enum constrained precision/modifier */ }).passthrough().optional().nullable(),
  line_no: z.number(), phrase: z.string()
}).passthrough()).optional().default([]),
```

**Changes to port back:**
- `event_type` constrained to enum instead of free-form string

## 6. Places

**Original (`llm.ts`):**
```typescript
place_type: z.string().optional(),
```

**Benchmark:**
```typescript
place_type: z.enum(['COUNTRY', 'STATE', 'COUNTY', 'CITY', 'SUBURB', 'ADDRESS', 'LANDMARK']).optional(),
```

**Changes to port back:**
- `place_type` constrained to enum instead of free-form string

## 7. Roles

**Original (`llm.ts`):**
```typescript
type: z.string().optional(),
```

**Benchmark:**
```typescript
type: z.enum(['OCCUPATION', 'EDUCATION', 'VOLUNTEER', 'CLERGY', 'MILITARY']).optional(),
```

**Changes to port back:**
- `role.type` constrained to enum instead of free-form string
