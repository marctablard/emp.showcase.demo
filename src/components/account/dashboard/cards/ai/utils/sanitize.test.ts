import { containsDangerousPatterns, sanitizeUserInput } from './sanitize';

describe('sanitizeUserInput', () => {
  it('should return sanitized string with no modification for clean input', () => {
    const result = sanitizeUserInput('Hello world');
    expect(result.sanitized).toBe('Hello world');
    expect(result.wasModified).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it('should trim whitespace', () => {
    const result = sanitizeUserInput('  Hello world  ');
    expect(result.sanitized).toBe('Hello world');
    expect(result.wasModified).toBe(true);
  });

  it('should truncate long messages', () => {
    const longMessage = 'a'.repeat(2500);
    const result = sanitizeUserInput(longMessage);
    expect(result.sanitized.length).toBe(2000);
    expect(result.wasModified).toBe(true);
  });

  it('should remove script tags', () => {
    const result = sanitizeUserInput('Hello <script>alert("xss")</script> world');
    expect(result.sanitized).toBe('Hello  world');
    expect(result.wasModified).toBe(true);
  });

  it('should remove javascript: protocol', () => {
    const result = sanitizeUserInput('Click here: javascript:alert("xss")');
    expect(result.sanitized).not.toContain('javascript:');
    expect(result.wasModified).toBe(true);
  });

  it('should remove event handlers', () => {
    const result = sanitizeUserInput('Image <img onerror=alert("xss")> here');
    expect(result.sanitized).not.toContain('onerror=');
    expect(result.wasModified).toBe(true);
  });

  it('should return error for null input', () => {
    const result = sanitizeUserInput(null as unknown as string);
    expect(result.sanitized).toBe('');
    expect(result.wasModified).toBe(true);
    expect(result.error).toBe('Invalid input');
  });

  it('should return error for undefined input', () => {
    const result = sanitizeUserInput(undefined as unknown as string);
    expect(result.sanitized).toBe('');
    expect(result.wasModified).toBe(true);
    expect(result.error).toBe('Invalid input');
  });

  it('should return error for non-string input', () => {
    const result = sanitizeUserInput(123 as unknown as string);
    expect(result.sanitized).toBe('');
    expect(result.error).toBe('Invalid input');
  });

  it('should handle empty string as invalid input', () => {
    const result = sanitizeUserInput('');
    expect(result.sanitized).toBe('');
    expect(result.wasModified).toBe(true);
    expect(result.error).toBe('Invalid input');
  });

  it('should handle string with only whitespace', () => {
    const result = sanitizeUserInput('   ');
    expect(result.sanitized).toBe('');
    expect(result.wasModified).toBe(true);
  });
});

describe('containsDangerousPatterns', () => {
  it('should detect script tags', () => {
    expect(containsDangerousPatterns('<script>alert("xss")</script>')).toBe(true);
  });

  it('should detect javascript: protocol', () => {
    expect(containsDangerousPatterns('javascript:void(0)')).toBe(true);
  });

  it('should detect event handlers', () => {
    expect(containsDangerousPatterns('onclick=handleClick()')).toBe(true);
  });

  it('should return false for safe content', () => {
    expect(containsDangerousPatterns('Hello world')).toBe(false);
  });

  it('should return false for normal HTML-like text', () => {
    expect(containsDangerousPatterns('I want to <buy> something')).toBe(false);
  });
});
