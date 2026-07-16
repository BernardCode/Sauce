import "server-only";

import { z } from "zod";
import { secretsMatch } from "./mcp-auth-core";

const environmentSchema = z.object({
  secret: z.string().min(32),
  userId: z.uuid(),
});

export function getMcpIdentity(candidateSecret: unknown) {
  const environment = environmentSchema.safeParse({
    secret: process.env.MCP_SECRET,
    userId: process.env.MCP_USER_ID,
  });
  const candidate = z.string().min(32).safeParse(candidateSecret);
  if (
    !environment.success ||
    !candidate.success ||
    !secretsMatch(candidate.data, environment.data.secret)
  ) {
    return null;
  }
  return { userId: environment.data.userId };
}
