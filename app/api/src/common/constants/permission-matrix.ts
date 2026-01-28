// app/api/src/common/constants/permission-matrix.ts
export const PERMISSION_MATRIX = {
  super_admin: ['*'], // 모든 권한

  tenant_admin: [
    'tenant:read',
    'tenant:update',
    'user:*',
    'site:*',
    'device:*',
    'gateway:*',
    'control:*',
    'alert:*',
    'report:*',
    'subscription:read',
    'subscription:update',
  ],

  site_manager: [
    'site:read',
    'site:update',
    'device:*',
    'gateway:read',
    'control:*',
    'alert:*',
    'report:read',
  ],

  operator: [
    'device:read',
    'device:update',
    'control:execute',
    'alert:read',
    'alert:acknowledge',
  ],

  viewer: [
    'site:read',
    'device:read',
    'measurement:read',
    'alert:read',
  ],
};