export type TodayBlock = {
  id: string;
  itemId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  origin: string;
  locked: boolean;
  done: boolean;
  reason: string | null;
  actualMinutes: number | null;
};

export type TodayEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
};

// DataTransfer type for dragging an item card onto the rail. The payload is
// JSON: { itemId: string, durationMinutes: number }.
export const ITEM_DRAG_MIME = "application/x-dashboard-item";

export type ItemDragPayload = {
  itemId: string;
  durationMinutes: number;
};

// DOM id for a block card, so the todo list's clock badge can scroll to it.
export function blockDomId(blockId: string): string {
  return `block-${blockId}`;
}

// Window event the clock badge fires on hover so the rail can highlight the
// matching block without the two columns holding refs to each other.
export const BLOCK_HIGHLIGHT_EVENT = "dashboard:block-highlight";

export type BlockHighlightDetail = {
  blockId: string;
  on: boolean;
};
