// Stub: password hashing utilities (PBKDF2 + legacy SHA-256 migration)

/**
 * Hash a password using PBKDF2.
 * Returns a string in the format "pbkdf2:<iterations>:<salt>:<hash>".
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:600000:${saltHex}:${hashHex}`;
}

/**
 * Verify a password against a stored hash.
 * Supports PBKDF2 (new) and plain SHA-256 hex (legacy).
 * Returns { valid, newHash } where newHash is set if the stored hash was legacy and should be upgraded.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<{ valid: boolean; newHash?: string }> {
  if (storedHash.startsWith("pbkdf2:")) {
    const [, iterStr, saltHex, expectedHash] = storedHash.split(":");
    const iterations = parseInt(iterStr, 10);
    const salt = new Uint8Array((saltHex.match(/.{2}/g) || []).map((h) => parseInt(h, 16)));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      keyMaterial,
      256,
    );
    const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return { valid: hashHex === expectedHash };
  }

  // Legacy SHA-256 hex hash
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hashHex === storedHash) {
    const newHash = await hashPassword(password);
    return { valid: true, newHash };
  }
  return { valid: false };
}

/**
 * Legacy SHA-256 hash (deterministic, no salt).
 * Used only for migration verification — new passwords should use hashPassword.
 */
export async function legacySha256Hash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
