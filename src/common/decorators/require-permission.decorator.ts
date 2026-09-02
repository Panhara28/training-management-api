import { SetMetadata } from '@nestjs/common';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

export interface RequiredPermission {
  module: string;
  action: PermissionAction;
}

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

export const RequirePermission = (module: string, action: PermissionAction) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { module, action });
