/**
 * Configuration for the PIN content gate. Adjust to taste — the API routes
 * import these constants directly.
 */
export const PIN_GATE_CONFIG = {
  /** Settings table key where the bcrypt hash lives. */
  pinHashKey: "gate_pin_hash",
  /** Cookie name used to mark a session as unlocked. */
  cookieName: "gate_unlocked",
  /** Minimum PIN length on creation. */
  minPinLength: 4,
  /** Bcrypt cost factor. */
  bcryptRounds: 12,
};
