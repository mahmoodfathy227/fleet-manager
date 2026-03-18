/**
 * Default fallback for the dashboard segment.
 * Prevents "No default component was found for a parallel route" when Next.js cannot match a slot.
 */
export default function Default() {
  return null
}
