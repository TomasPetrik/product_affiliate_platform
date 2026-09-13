import { randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { scrypt as scryptCallback } from "crypto";

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 64;

/**
 * Password hashing using Node's built-in `crypto.scrypt` (a memory-hard KDF,
 * same family as bcrypt/argon2 in terms of brute-force resistance) rather
 * than an external dependency like bcrypt/argon2. This keeps admin auth
 * dependency-free and avoids native-binding install issues, while still
 * being a sound, widely-recommended choice for password storage.
 *
 * Stored format: `<saltHex>:<hashHex>` — self-describing, no separate
 * column needed for the salt.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(plainPassword, salt, KEY_LENGTH)) as Buffer;
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derivedKey = (await scrypt(plainPassword, salt, expected.length)) as Buffer;

  if (derivedKey.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expected);
}
