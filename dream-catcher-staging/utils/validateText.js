// Validation helper
export function validateText(text) {
  const maxDreamChars = Number(process.env.MAX_DREAM_CHARS || 1000);

  // Type check
  if (typeof text !== 'string') {
    return { valid: false, error: 'Dream text must be a string' };
  }

  // Sanitization: trim whitespace
  const trimmed = text.trim();

  // Required field check
  if (trimmed.length === 0) {
    return { valid: false, error: 'Dream text is required' };
  }

  // Length limit check
  if (trimmed.length > maxDreamChars) {
    return { valid: false, error: `Dream text must be less than ${maxDreamChars} characters` };
  }

  return { valid: true, value: trimmed };
}
