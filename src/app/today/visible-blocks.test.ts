import { describe, expect, it } from "vitest";
import { withoutCompletedBlocks } from "./visible-blocks";

describe("withoutCompletedBlocks", () => {
  it("removes completed blocks instead of leaving a crossed-out card", () => {
    expect(
      withoutCompletedBlocks([
        { id: "open", done: false },
        { id: "complete", done: true },
      ]),
    ).toEqual([{ id: "open", done: false }]);
  });
});
