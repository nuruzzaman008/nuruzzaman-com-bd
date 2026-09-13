/**
 * "Class-01", "Class-02": how the course player and the course editor number
 * a course's sections, so the admin sees the same label the student does.
 */
export function classLabel(index: number): string {
  return `Class-${String(index + 1).padStart(2, '0')}`;
}
