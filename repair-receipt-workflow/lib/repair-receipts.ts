/**
 * Generate a repair receipt number: <year>-<6 random digits>.
 * Override for project-specific formats.
 */
export function generateReceiptNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `${year}-${rand}`;
}

export type RepairStatus = "intake" | "in_progress" | "ready" | "picked_up";

/**
 * Allowed status transitions. The workflow flows in one direction except
 * a "ready → in_progress" rollback when more work is needed.
 */
export const STATUS_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  intake: ["in_progress"],
  in_progress: ["ready"],
  ready: ["picked_up", "in_progress"],
  picked_up: [],
};

export function canTransition(from: RepairStatus, to: RepairStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}
