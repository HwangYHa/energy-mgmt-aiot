// app/api/src/modules/auth/guards/role.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_MATRIX } from '../../common/constants/permission-matrix';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.get<string>(
      'permission',
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.role;

    const userPermissions = PERMISSION_MATRIX[userRole] || [];

    // 와일드카드 체크
    if (userPermissions.includes('*')) {
      return true;
    }

    // 정확한 매칭 또는 리소스 와일드카드 체크
    return userPermissions.some(perm => {
      if (perm === requiredPermission) return true;
      if (perm.endsWith(':*')) {
        const prefix = perm.split(':')[0];
        return requiredPermission.startsWith(prefix + ':');
      }
      return false;
    });
  }
}

// 사용 예시
@Delete(':id')
@UseGuards(RoleGuard)
@SetMetadata('permission', 'device:delete')
async deleteDevice(@Param('id') id: string) {
  // site_manager 이상만 실행 가능
}