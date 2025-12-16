/**
 * Custom color definitions for product variants
 * (extend to your needs)
 * Maps color names to their hex values when CSS named colors are not sufficient
 */
export const CUSTOM_COLORS: Record<string, string> = {
  graphite: '#41424C',
  anthracite: '#36454F',
  charcoal: '#36454F',
  beige: '#F5F5DC',
  ivory: '#FFFFF0',
  limestone: '#E6E6FA',
};

/**
 * Gets the appropriate color value for a given color key
 * First checks if it's a valid CSS color name, then falls back to custom colors
 * @param colorKey The color key/name
 * @returns The color value (hex code or CSS color name)
 */
export function getColorValue(colorKey: string): string {
  const normalizedKey = colorKey.toLowerCase().trim();

  // Check if it's already a hex color
  if (normalizedKey.startsWith('#')) {
    return normalizedKey;
  }

  // Check custom colors first
  if (CUSTOM_COLORS[normalizedKey]) {
    return CUSTOM_COLORS[normalizedKey];
  }

  // For standard CSS colors, return as-is
  // This includes colors like: red, blue, green, black, white, etc.
  return normalizedKey;
}

/**
 * Checks if a color key needs a custom color definition
 * @param colorKey The color key/name
 * @returns True if the color has a custom definition
 */
export function hasCustomColor(colorKey: string): boolean {
  const normalizedKey = colorKey.toLowerCase().trim();
  return normalizedKey in CUSTOM_COLORS;
}
