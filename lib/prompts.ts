export function extractJson(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

export function getRetryPrompt(
  previousResponse: string,
  validationErrors: Array<{ path: string[]; message: string }>
): string {
  const errorList = validationErrors
    .map((err) => {
      const path = err.path.length > 0 ? err.path.join('.') : 'root';
      return `\u2022 ${path}: ${err.message}`;
    })
    .join('\n');
  return `<validation_retry>\nYour previous response failed JSON validation:\n\n<previous_response>\n${previousResponse}</previous_response>\n\n<validation_errors>\n${errorList}</validation_errors>\n\n<instructions>\n1. Review the specific validation errors above\n2. Identify what needs to be fixed in your response\n3. Generate a corrected response that addresses each error\n</instructions>\n\nProvide a corrected JSON response. Return ONLY valid JSON with no additional text, explanations, or markdown formatting.\n</validation_retry>`;
}
