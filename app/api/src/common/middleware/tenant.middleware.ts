import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    try {
      // JWT에서 tenantId 추출
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const decoded = this.jwtService.verify(token);
      
      // Request에 tenantId 주입 (모든 후속 로직에서 사용)
      req['tenantId'] = decoded.tenantId;
      req['userId'] = decoded.userId;
      req['role'] = decoded.role;
      
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}