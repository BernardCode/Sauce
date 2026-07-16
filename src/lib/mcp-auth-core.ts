import { timingSafeEqual } from "node:crypto";

export function secretsMatch(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  if (candidateBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(candidateBytes, expectedBytes);
}
