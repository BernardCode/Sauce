export function withoutCompletedBlocks<T extends { done: boolean }>(
  blocks: T[],
): T[] {
  return blocks.filter((block) => !block.done);
}
