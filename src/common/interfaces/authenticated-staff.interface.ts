import type { Role } from '@prisma/client';

export type AuthenticatedStaff = {
  userId: string;
  staffRoleId: string | null;
  role: Role;
};
