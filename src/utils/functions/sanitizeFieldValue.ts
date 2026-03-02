export function sanitizeFieldValue(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  const stringValue = String(value).trim();
  if (stringValue.length > maxLength) {
    return stringValue.substring(0, maxLength);
  }
  return stringValue || null;
}
