/**
 * Soft-delete helper for users, preserving access-logs and
 * activity-tracker history instead of cascading a hard delete that
 * destroys the audit trail.
 */
export interface SoftDeletableUser {
  deletedAt?: Date | null;
  isDeleted?: boolean;
}

export function markUserDeleted<T extends SoftDeletableUser>(user: T): T {
  return {
    ...user,
    isDeleted: true,
    deletedAt: new Date(),
  };
}
