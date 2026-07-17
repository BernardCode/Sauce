import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

const encodedSecretSchema = z.tuple([
  z.string().min(1),
  z.string().min(1),
  z.string().min(1),
]);

export const googleSourceSecretSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).nullable(),
  expiresAt: z.iso.datetime({ offset: true }),
});

export type GoogleSourceSecret = z.infer<typeof googleSourceSecretSchema>;

export const icsSourceSecretSchema = z.object({
  url: z.url(),
});

function getEncryptionKey(): Buffer {
  const encoded = z.string().min(1).safeParse(process.env.SOURCE_SECRET_KEY);
  if (!encoded.success) {
    throw new Error("SOURCE_SECRET_KEY is not configured.");
  }
  const key = Buffer.from(encoded.data, "base64");
  if (key.length !== 32) {
    throw new Error("SOURCE_SECRET_KEY must decode to exactly 32 bytes.");
  }
  return key;
}

export function encryptSourceSecret(value: unknown): string {
  const plaintext = JSON.stringify(value);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptSourceSecret(value: string): unknown {
  const parts = encodedSecretSchema.safeParse(value.split("."));
  if (!parts.success) {
    throw new Error("The source credential is malformed.");
  }
  const [encodedIv, encodedCiphertext, encodedTag] = parts.data;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error("The source credential could not be decoded.");
  }
  return parsed;
}

export function decryptGoogleSourceSecret(value: string): GoogleSourceSecret {
  const secret = googleSourceSecretSchema.safeParse(decryptSourceSecret(value));
  if (!secret.success) {
    throw new Error("The source credential has an invalid shape.");
  }
  return secret.data;
}
