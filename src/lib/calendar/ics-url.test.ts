import { describe, expect, it } from "vitest";
import { normalizeIcsFeedUrl } from "./ics-url";

describe("ICS feed URL normalization", () => {
  it("turns a Schoology webcal subscription into an HTTPS URL", () => {
    const url = normalizeIcsFeedUrl(
      "webcal://fuhsd.schoology.com/calendar/feed/iCal/private-token",
    );

    expect(url?.toString()).toBe(
      "https://fuhsd.schoology.com/calendar/feed/iCal/private-token",
    );
  });

  it("keeps an HTTPS feed URL unchanged", () => {
    const url = normalizeIcsFeedUrl("https://example.com/assignments.ics");

    expect(url?.toString()).toBe("https://example.com/assignments.ics");
  });

  it("rejects unsupported URL schemes and malformed input", () => {
    expect(normalizeIcsFeedUrl("file:///tmp/assignments.ics")).toBeNull();
    expect(normalizeIcsFeedUrl("not a URL")).toBeNull();
  });
});
