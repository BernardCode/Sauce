import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "./network";

describe("link address safety", () => {
  it("rejects loopback and private ranges", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("192.168.1.4")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
  });

  it("accepts public IP addresses", () => {
    expect(isPrivateAddress("1.1.1.1")).toBe(false);
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });
});
