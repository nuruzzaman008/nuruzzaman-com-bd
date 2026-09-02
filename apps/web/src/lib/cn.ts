type ClassValue = string | number | null | false | undefined | ClassValue[];

/**
 * Joins conditional class names.
 *
 * Deliberately tiny and non-merging: Tailwind classes here are written as
 * complete literals so the build-time scanner can see every one of them, and
 * nothing constructs a utility name from a runtime string.
 */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  for (const value of values) {
    if (!value && value !== 0) {
      continue;
    }

    if (Array.isArray(value)) {
      const nested = cn(...value);

      if (nested) {
        out.push(nested);
      }

      continue;
    }

    out.push(String(value));
  }

  return out.join(' ');
}
