import {
  getRetryPrompt,
  extractJson,
} from '../lib/prompts';

describe('Prompt Generation', () => {
  describe('getRetryPrompt', () => {
    const mockValidationErrors = [
      { path: ['recommendation'], message: 'String must contain at least 20 character(s)' },
      { path: ['action', 'actor', 'skills'], message: 'Array must contain at least 3 element(s)' },
    ];

    const mockResponse = '{"recommendation": "Short", "action": null}';

    it('should return a string with retry instructions', () => {
      const retryPrompt = getRetryPrompt(mockResponse, mockValidationErrors);

      expect(typeof retryPrompt).toBe('string');
      expect(retryPrompt.length).toBeGreaterThan(0);
    });

    it('should include the previous response', () => {
      const retryPrompt = getRetryPrompt(mockResponse, mockValidationErrors);

      expect(retryPrompt).toContain(mockResponse);
    });

    it('should include validation errors', () => {
      const retryPrompt = getRetryPrompt(mockResponse, mockValidationErrors);

      expect(retryPrompt).toContain('recommendation');
      expect(retryPrompt).toContain('String must contain at least 20 character(s)');
      expect(retryPrompt).toContain('action.actor.skills');
      expect(retryPrompt).toContain('Array must contain at least 3 element(s)');
    });

    it('should include correction instructions', () => {
      const retryPrompt = getRetryPrompt(mockResponse, mockValidationErrors);

      expect(retryPrompt).toMatch(/corrected/i);
      expect(retryPrompt).toMatch(/valid json/i);
      expect(retryPrompt).toMatch(/validation errors/i);
    });

    it('should handle empty path errors', () => {
      const errors = [{ path: [], message: 'Root level error' }];
      const retryPrompt = getRetryPrompt(mockResponse, errors);

      expect(retryPrompt).toContain('root: Root level error');
    });
  });

  describe('extractJson', () => {
    it('should extract JSON from markdown code blocks', () => {
      const jsonContent = '{"test": "data"}';
      const markdownWrapped = '```json\n' + jsonContent + '\n```';

      const extracted = extractJson(markdownWrapped);
      expect(extracted).toBe(jsonContent);
    });

    it('should extract JSON from generic code blocks', () => {
      const jsonContent = '{"test": "data"}';
      const codeWrapped = '```\n' + jsonContent + '\n```';

      const extracted = extractJson(codeWrapped);
      expect(extracted).toBe(jsonContent);
    });

    it('should return original string if no code blocks', () => {
      const plainJson = '{"test": "data"}';

      const extracted = extractJson(plainJson);
      expect(extracted).toBe(plainJson);
    });

    it('should handle strings with only opening code fence', () => {
      const partialWrapped = '```json\n{"test": "data"}';

      const extracted = extractJson(partialWrapped);
      expect(extracted).toBe('{"test": "data"}');
    });

    it('should handle strings with only closing code fence', () => {
      const partialWrapped = '{"test": "data"}\n```';

      const extracted = extractJson(partialWrapped);
      expect(extracted).toBe('{"test": "data"}');
    });

    it('should trim whitespace', () => {
      const withWhitespace = '  \n  {"test": "data"}  \n  ';

      const extracted = extractJson(withWhitespace);
      expect(extracted).toBe('{"test": "data"}');
    });
  });
});
