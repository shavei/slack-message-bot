import crypto from "node:crypto";
import { getConfig } from "@/lib/config";

const algorithm = "aes-256-gcm";

export function hashSecret(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decrypt(payload) {
  const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = crypto.createDecipheriv(algorithm, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function encryptionKey() {
  return crypto.createHash("sha256").update(getConfig().slackTokenEncryptionKey).digest();
}
