/**
 * Default fallback for parallel route slots.
 * Renders nothing so Next.js does not fall back to NotFound when a slot has no matching segment.
 */
export default function Default() {
  return null
}
