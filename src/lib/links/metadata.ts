import "server-only";

import { lookup } from "node:dns/promises";
import { z } from "zod";
import { isPrivateAddress } from "./network";

const htmlSchema = z.string().max(1_000_000);

export async function validatePublicLinkUrl(url: URL) {
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hostname.toLowerCase() === "localhost"
  ) {
    throw new Error("Only public HTTP links are allowed.");
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Private network links are not allowed.");
  }
}

async function limitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1_000_000) {
      await reader.cancel();
      throw new Error("The page is too large to inspect.");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchLinkMetadata(initialUrl: URL) {
  let url = new URL(initialUrl);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    await validatePublicLinkUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
      headers: { "user-agent": "PersonalDashboardLinkPreview/1.0" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The redirect has no destination.");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error("The page could not be loaded.");
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return { title: url.hostname, faviconUrl: new URL("/favicon.ico", url).toString() };
    }
    const parsedHtml = htmlSchema.safeParse(await limitedText(response));
    if (!parsedHtml.success) throw new Error("The page metadata is not valid.");
    const html = parsedHtml.data;
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const iconMatch = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i.exec(html)
      ?? /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/i.exec(html);
    return {
      title: plainText(titleMatch?.[1] ?? "").slice(0, 300) || url.hostname,
      faviconUrl: new URL(iconMatch?.[1] ?? "/favicon.ico", url).toString(),
    };
  }
  throw new Error("The page redirected too many times.");
}
