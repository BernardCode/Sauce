"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchLinkMetadata, validatePublicLinkUrl } from "@/lib/links/metadata";
import { createClient } from "@/lib/supabase/server";

const addLinkSchema = z.object({
  url: z.url().max(2_000),
  tag: z.string().trim().min(1).max(80),
});
const idSchema = z.object({ id: z.uuid() });
const reorderSchema = z.object({
  tag: z.string().trim().min(1).max(80),
  orderedIds: z.array(z.uuid()).max(500),
});
type ActionResult = { error: string | null };

export async function addLink(input: unknown): Promise<ActionResult> {
  const parsed = addLinkSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a valid public URL and tag." };
  const url = new URL(parsed.data.url);
  if (!["http:", "https:"].includes(url.protocol)) {
    return { error: "Only HTTP and HTTPS links are supported." };
  }
  try {
    await validatePublicLinkUrl(url);
  } catch {
    return { error: "Only public web links are supported." };
  }
  let metadata: { title: string; faviconUrl: string };
  try {
    metadata = await fetchLinkMetadata(url);
  } catch {
    metadata = { title: url.hostname, faviconUrl: new URL("/favicon.ico", url).toString() };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { data: last } = await supabase
    .from("links")
    .select("position")
    .eq("user_id", user.id)
    .eq("tag", parsed.data.tag)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("links").insert({
    user_id: user.id,
    title: metadata.title,
    url: url.toString(),
    tag: parsed.data.tag,
    favicon_url: metadata.faviconUrl,
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { error: "Could not save that link." };
  revalidatePath("/links");
  return { error: null };
}

export async function deleteLink(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That link id is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { error } = await supabase.from("links").delete().eq("id", parsed.data.id).eq("user_id", user.id);
  if (error) return { error: "Could not delete that link." };
  revalidatePath("/links");
  return { error: null };
}

export async function reorderLinks(input: unknown): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { error: "That link order is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { error } = await supabase.rpc("reorder_links", {
    tag_arg: parsed.data.tag,
    ordered_link_ids: parsed.data.orderedIds,
  });
  if (error) return { error: "Could not reorder those links." };
  revalidatePath("/links");
  return { error: null };
}
