import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ItemCard } from "./item-card";

describe("ItemCard task movement", () => {
  it("makes only the move handle draggable", () => {
    const markup = renderToStaticMarkup(
      createElement(ItemCard, {
        item: {
          id: "6f4f1f32-74c1-4dc8-a8c3-04b20e7dd5c4",
          title: "Write the outline",
          course: null,
          dueAt: null,
          plannedDate: "2026-08-24",
          estMinutes: 30,
          isProject: false,
          origin: "manual",
        },
        now: null,
        onDone: vi.fn(),
        reorder: {
          disabled: false,
          isDragging: false,
          dropPosition: null,
          onDragStart: vi.fn(),
          onDragEnd: vi.fn(),
          onDragOver: vi.fn(),
          onDrop: vi.fn(),
          onKeyDown: vi.fn(),
        },
      }),
    );

    expect(markup).not.toMatch(/<li[^>]*draggable/);
    expect(markup).toMatch(
      /<button[^>]*draggable="true"[^>]*aria-label="Move &quot;Write the outline&quot;"/,
    );
    expect(markup.match(/draggable="true"/g)).toHaveLength(1);
  });
});
