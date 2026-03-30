// Platform-level type utilities

/** Returns true if the given role string is a super-admin role. */
export function isSuperAdmin(role: string): boolean {
  return role === "super_admin";
}
