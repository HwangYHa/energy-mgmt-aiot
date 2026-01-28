import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Config
  const configService = app.get(ConfigService);
  const port = configService.get('API_PORT', 4000);
  const corsOrigin = configService.get('CORS_ORIGIN', 'http://localhost:3000');

  // Global Prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({
    origin: corsOrigin.split(','),
    credentials: true,
  });

  // Helmet (보안 헤더)
  app.use(helmet());

  // Validation Pipe (전역)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 없는 필드 제거
      forbidNonWhitelisted: true, // DTO에 없는 필드가 있으면 에러
      transform: true, // 자동 타입 변환
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Energy Management System API')
    .setDescription('EMS API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', '인증')
    .addTag('Tenants', '테넌트')
    .addTag('Users', '사용자')
    .addTag('Sites', '사업장')
    .addTag('Devices', '설비')
    .addTag('Measurements', '측정 데이터')
    .addTag('Analytics', '분석')
    .addTag('Alerts', '알람')
    .addTag('Control', '제어')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(port);

  console.log(`
    🚀 Application is running on: http://localhost:${port}
    📚 API Documentation: http://localhost:${port}/api-docs
  `);
}

bootstrap();