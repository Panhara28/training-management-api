import type { Role } from '@prisma/client';

export type AuthenticatedStaff = {
  userId: number;
  staffRoleId: number | null;
  role: Role;
};
