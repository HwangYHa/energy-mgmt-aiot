// app/api/src/modules/tenant/dto/create-tenant.dto.ts
import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'Demo Corporation' })
  @IsString()
  name: string;

  @ApiProperty({ required: false, example: '123-45-67890' })
  @IsString()
  @IsOptional()
  businessNumber?: string;

  @ApiProperty({ required: false, example: 'demo.ems.com' })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiProperty({ enum: ['manufacturing', 'building', 'industrial_complex', 'datacenter', 'retail', 'hospital', 'hotel', 'other'], example: 'manufacturing' })
  @IsEnum(['manufacturing', 'building', 'industrial_complex', 'datacenter', 'retail', 'hospital', 'hotel', 'other'])
  industryType: string;

  @ApiProperty({ required: false, example: '서울특별시 강남구 테헤란로 123' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false, example: '서울' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ required: false, example: 'KR' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ required: false, example: 'Asia/Seoul' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({ required: false, example: { theme: 'light', language: 'ko' } })
  @IsObject()
  @IsOptional()
  settings?: any;
}

// app/api/src/modules/tenant/dto/update-tenant.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateTenantDto } from './create-tenant.dto';

export class UpdateTenantDto extends PartialType(CreateTenantDto) {}

// app/api/src/modules/tenant/dto/index.ts
export * from './create-tenant.dto';
export * from './update-tenant.dto';