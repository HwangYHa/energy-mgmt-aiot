import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 로그인
   */
  async login(email: string, password: string, ipAddress?: string) {
    // 1. 사용자 조회
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. 계정 잠금 확인
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Account is locked. Try again in ${remainingMinutes} minutes`,
      );
    }

    // 3. 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // 로그인 시도 횟수 증가
      const newAttempts = user.loginAttempts + 1;
      const maxAttempts = 5;

      if (newAttempts >= maxAttempts) {
        // 계정 잠금 (30분)
        const lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + 30);

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: newAttempts,
            lockedUntil,
          },
        });

        throw new UnauthorizedException(
          `Account locked due to too many failed attempts`,
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: newAttempts,
        },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // 4. 활성화 여부 확인
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // 5. 테넌트 상태 확인
    if (user.tenant.status !== 'active') {
      throw new UnauthorizedException('Tenant is not active');
    }

    // 6. 토큰 생성
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION', '3600s'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    // 7. 로그인 정보 업데이트
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 7);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        loginAttempts: 0,
        lockedUntil: null,
        refreshToken: await bcrypt.hash(refreshToken, 10),
        refreshTokenExpiresAt,
      },
    });

    // 8. 감사 로그
    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: 'auth.login',
        result: 'success',
        ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
        },
      },
    };
  }

  /**
   * 토큰 갱신
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          tenantId: true,
          role: true,
          tokenVersion: true,
          refreshToken: true,
          refreshTokenExpiresAt: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 토큰 버전 확인
      if (user.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException('Token has been revoked');
      }

      // Refresh Token 검증
      if (!user.refreshToken || !user.refreshTokenExpiresAt) {
        throw new UnauthorizedException('No refresh token found');
      }

      if (user.refreshTokenExpiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token expired');
      }

      const isRefreshTokenValid = await bcrypt.compare(
        refreshToken,
        user.refreshToken,
      );

      if (!isRefreshTokenValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 새 토큰 생성
      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
        tokenVersion: user.tokenVersion,
      };

      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION', '3600s'),
      });

      return {
        accessToken: newAccessToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * 로그아웃
   */
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        refreshTokenExpiresAt: null,
      },
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * 비밀번호 변경
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      user.passwordHash,
    );

    if (!isOldPasswordValid) {
      throw new BadRequestException('Invalid old password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedPassword,
        tokenVersion: user.tokenVersion + 1, // 모든 토큰 무효화
        refreshToken: null,
        refreshTokenExpiresAt: null,
      },
    });

    return { message: 'Password changed successfully' };
  }
}