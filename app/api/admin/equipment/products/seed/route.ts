/**
 * POST /api/admin/equipment/products/seed
 *
 * super_admin 전용 — 제품 카탈로그 초기 데이터를 DB에 등록합니다.
 * 이미 존재하는 모델번호는 건너뜁니다 (멱등).
 */

import { NextRequest } from 'next/server';
import { verifyAuth, isSuperAdmin } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export const dynamic = 'force-dynamic';

// ─── 초기 제품 카탈로그 ─────────────────────────────────────────

const SEED_PRODUCTS = [
  // ── 게이트웨이 ──────────────────────────────────────────────────
  {
    name: 'EMS-GW-B1000 빌딩용 게이트웨이',
    modelNumber: 'EMS-GW-B1000',
    manufacturer: '탄소이음',
    category: 'gateway',
    facilityTypes: ['building'],
    specs: { 전원: 'DC 24V', 통신: 'Ethernet+LTE', 포트: 'RS-485×4 / RS-232×1', 온도: '0~50°C', 보호등급: 'IP40' },
    protocols: ['modbus_tcp', 'modbus_rtu', 'bacnet_ip', 'mqtt', 'http'],
    unitPrice: 1250000,
    description: '빌딩 에너지 관리 전용 게이트웨이. BACnet IP 지원으로 기존 BMS와 통합, 이더넷+LTE 이중화.',
    installDifficulty: 'medium',
    warrantyMonths: 24,
    isActive: true,
  },
  {
    name: 'EMS-GW-F2000 산업용 게이트웨이',
    modelNumber: 'EMS-GW-F2000',
    manufacturer: '탄소이음',
    category: 'gateway',
    facilityTypes: ['factory'],
    specs: { 전원: 'DC 12~24V', 통신: 'Ethernet+LTE', 포트: 'RS-485×8 / RS-232×2', 온도: '-20~70°C', 보호등급: 'IP67', 마운트: 'DIN 레일' },
    protocols: ['modbus_tcp', 'modbus_rtu', 'opc_ua', 'mqtt', 'profibus'],
    unitPrice: 1850000,
    description: '공장 설비 전용 산업용 게이트웨이. IP67 방진방수, 광범위 온도, OPC-UA 지원.',
    installDifficulty: 'hard',
    warrantyMonths: 24,
    isActive: true,
  },
  {
    name: 'EMS-GW-H500 가정용 스마트 허브',
    modelNumber: 'EMS-GW-H500',
    manufacturer: '탄소이음',
    category: 'gateway',
    facilityTypes: ['residential'],
    specs: { 전원: 'DC 5V (USB-C)', 통신: 'Wi-Fi 6 + RS-485', 포트: 'RS-485×2', 온도: '0~40°C', 보호등급: 'IP20', 크기: '90×90×25mm' },
    protocols: ['modbus_rtu', 'mqtt', 'http', 'zigbee'],
    unitPrice: 380000,
    description: '가정·공동주택용 초소형 스마트 에너지 허브. USB-C 전원, Wi-Fi 6, Zigbee 지원.',
    installDifficulty: 'easy',
    warrantyMonths: 12,
    isActive: true,
  },
  // ── 계량기 ──────────────────────────────────────────────────────
  {
    name: 'EM-3P-100A 3상 전력계량기',
    modelNumber: 'EM-3P-100A',
    manufacturer: '탄소이음',
    category: 'meter',
    facilityTypes: ['building', 'factory'],
    specs: { 전압: '3상 4선 380V', 전류: '5(100)A', 정밀도: '클래스 1', 통신: 'RS-485 Modbus RTU', 보호등급: 'IP51' },
    protocols: ['modbus_rtu'],
    unitPrice: 185000,
    description: '3상 분전반·배전반 전력 계측 전용. 유효/무효전력·역률·전력품질(THD) 측정.',
    installDifficulty: 'medium',
    warrantyMonths: 24,
    isActive: true,
  },
  {
    name: 'EM-3P-800A 고전류 전력계량기',
    modelNumber: 'EM-3P-800A',
    manufacturer: '탄소이음',
    category: 'meter',
    facilityTypes: ['factory'],
    specs: { 전압: '3상 4선 380V', 전류: '5(800)A', 정밀도: '클래스 0.5S', 통신: 'RS-485 Modbus RTU', CT비: '800/5A 외장 CT' },
    protocols: ['modbus_rtu'],
    unitPrice: 320000,
    description: '대형 모터·압축기·수전설비 고전류 계측 전용. 0.5S 클래스 고정밀.',
    installDifficulty: 'hard',
    warrantyMonths: 24,
    isActive: true,
  },
  {
    name: 'SM-1P-40A 스마트 단상 계량기',
    modelNumber: 'SM-1P-40A',
    manufacturer: '탄소이음',
    category: 'meter',
    facilityTypes: ['residential'],
    specs: { 전압: '단상 2선 220V', 전류: '5(40)A', 정밀도: '클래스 1', 통신: 'RS-485 / Wi-Fi', AMI: '한전 AMI 연동 지원' },
    protocols: ['modbus_rtu', 'mqtt'],
    unitPrice: 95000,
    description: '공동주택 세대 분전반 내 DIN 레일 설치형. 한전 AMI 연동 가능.',
    installDifficulty: 'easy',
    warrantyMonths: 12,
    isActive: true,
  },
  // ── 센서 ────────────────────────────────────────────────────────
  {
    name: 'TH-CO2-WALL 실내환경 복합센서',
    modelNumber: 'TH-CO2-WALL',
    manufacturer: '탄소이음',
    category: 'sensor',
    facilityTypes: ['building'],
    specs: { 온도: '±0.3°C', 습도: '±2%RH', CO2: '400~5000ppm (±30ppm)', 통신: 'RS-485 / 이더넷', 전원: 'PoE 또는 DC 12V' },
    protocols: ['modbus_rtu', 'modbus_tcp'],
    unitPrice: 145000,
    description: '빌딩 실내공기질 통합 모니터링 센서. 온습도·CO2 복합 측정, PoE 지원.',
    installDifficulty: 'easy',
    warrantyMonths: 24,
    isActive: true,
  },
  {
    name: 'EN-VIBR-I 진동·전류 복합센서',
    modelNumber: 'EN-VIBR-I',
    manufacturer: '탄소이음',
    category: 'sensor',
    facilityTypes: ['factory'],
    specs: { 진동: '0~50g (±0.5%)', 전류: '0~200A (클램프)', 온도: '-10~85°C', 통신: 'RS-485 / Bluetooth 5.0' },
    protocols: ['modbus_rtu', 'mqtt'],
    unitPrice: 285000,
    description: '공장 모터·펌프 상태 모니터링. 진동+전류 동시 측정으로 이상 조기 탐지.',
    installDifficulty: 'medium',
    warrantyMonths: 24,
    isActive: true,
  },
  {
    name: 'PLUG-SMART 스마트 플러그',
    modelNumber: 'PLUG-SMART',
    manufacturer: '탄소이음',
    category: 'sensor',
    facilityTypes: ['residential'],
    specs: { 전압: '220V AC', 전류: '최대 16A', 측정: 'W/kWh/PF', 통신: 'Wi-Fi 2.4GHz', 제어: '원격 ON/OFF 지원' },
    protocols: ['mqtt', 'http'],
    unitPrice: 35000,
    description: '가정용 개별 가전 소비전력 측정 및 원격 제어. 앱으로 간편 설정.',
    installDifficulty: 'easy',
    warrantyMonths: 12,
    isActive: true,
  },
  {
    name: 'TH-MINI 소형 온습도 센서',
    modelNumber: 'TH-MINI',
    manufacturer: '탄소이음',
    category: 'sensor',
    facilityTypes: ['residential'],
    specs: { 온도: '±0.3°C (-10~50°C)', 습도: '±2%RH (0~100%RH)', 통신: 'Wi-Fi 2.4GHz', 전원: 'USB-C 또는 AA 배터리×2', 배터리수명: '약 12개월' },
    protocols: ['mqtt', 'http'],
    unitPrice: 48000,
    description: '가정용 방별 온습도 모니터링 센서. 배터리로 배선 없이 어디든 설치.',
    installDifficulty: 'easy',
    warrantyMonths: 12,
    isActive: true,
  },
  // ── 컨트롤러 ────────────────────────────────────────────────────
  {
    name: 'CTRL-HVAC-B 공조제어 컨트롤러',
    modelNumber: 'CTRL-HVAC-B',
    manufacturer: '탄소이음',
    category: 'controller',
    facilityTypes: ['building'],
    specs: { 입출력: 'AI×8 / AO×4 / DI×8 / DO×4', 통신: 'BACnet IP / Modbus TCP', 전원: 'DC 24V', 마운트: 'DIN 레일' },
    protocols: ['bacnet_ip', 'modbus_tcp'],
    unitPrice: 520000,
    description: '빌딩 공조기(AHU/FCU) BACnet 제어 컨트롤러. DR 시나리오 내장.',
    installDifficulty: 'hard',
    warrantyMonths: 24,
    isActive: true,
  },
  {
    name: 'CTRL-PLC-LINK PLC 연동 모듈',
    modelNumber: 'CTRL-PLC-LINK',
    manufacturer: '탄소이음',
    category: 'controller',
    facilityTypes: ['factory'],
    specs: { 통신: 'Modbus RTU/TCP / OPC-UA', 입력: 'RS-485 / 이더넷', 출력: 'RS-485 / 이더넷', 전원: 'DC 24V', 마운트: 'DIN 레일' },
    protocols: ['modbus_rtu', 'modbus_tcp', 'opc_ua'],
    unitPrice: 380000,
    description: '공장 PLC·SCADA 데이터 수집 전용 모듈. OPC-UA 지원으로 다양한 PLC 브랜드 연동.',
    installDifficulty: 'hard',
    warrantyMonths: 24,
    isActive: true,
  },
  // ── 디스플레이 ──────────────────────────────────────────────────
  {
    name: 'DSP-10-LOBBY 로비용 에너지 보드',
    modelNumber: 'DSP-10-LOBBY',
    manufacturer: '탄소이음',
    category: 'display',
    facilityTypes: ['building'],
    specs: { 화면: '10.1인치 터치스크린', 해상도: '1280×800', 통신: '이더넷 / Wi-Fi', 전원: 'DC 12V / PoE', 밝기: '500 nit' },
    protocols: ['http', 'mqtt'],
    unitPrice: 680000,
    description: '빌딩 로비·복도에 설치하는 실시간 에너지 현황 표시 보드.',
    installDifficulty: 'easy',
    warrantyMonths: 24,
    isActive: true,
  },
  {
    name: 'DSP-WALL-7 월패드 에너지 위젯',
    modelNumber: 'DSP-WALL-7',
    manufacturer: '탄소이음',
    category: 'display',
    facilityTypes: ['residential'],
    specs: { 화면: '7인치 터치스크린', 해상도: '1024×600', 통신: 'Wi-Fi / RS-485', 전원: 'DC 12V', 설치: '매립형 또는 표면부착' },
    protocols: ['mqtt', 'http'],
    unitPrice: 285000,
    description: '가정용 월패드 에너지 위젯. 세대 에너지 사용량·요금 실시간 표시.',
    installDifficulty: 'medium',
    warrantyMonths: 12,
    isActive: true,
  },
  // ── 액세서리 ────────────────────────────────────────────────────
  {
    name: 'RS485-EXT RS-485 신호 연장기',
    modelNumber: 'RS485-EXT',
    manufacturer: '탄소이음',
    category: 'accessory',
    facilityTypes: ['building', 'factory'],
    specs: { 거리: '최대 1200m (RS-485)', 입출력: 'RS-485 × 2포트', 전원: 'DC 12V', 보호등급: 'IP40' },
    protocols: ['modbus_rtu'],
    unitPrice: 45000,
    description: 'RS-485 통신 거리 연장기. 긴 배선 경로 또는 신호 손실 구간에 사용.',
    installDifficulty: 'easy',
    warrantyMonths: 12,
    isActive: true,
  },
  {
    name: 'WIFI-EXT Wi-Fi 신호 증폭기',
    modelNumber: 'WIFI-EXT',
    manufacturer: '탄소이음',
    category: 'accessory',
    facilityTypes: ['residential'],
    specs: { 표준: 'Wi-Fi 5 (802.11ac)', 커버리지: '최대 150m²', 전원: 'AC 220V (콘센트 직결)', 포트: 'LAN×1' },
    protocols: ['http'],
    unitPrice: 38000,
    description: '가정용 Wi-Fi 신호 증폭기. 넓은 평형·지하층 음영지역 신호 보완.',
    installDifficulty: 'easy',
    warrantyMonths: 12,
    isActive: true,
  },
];

// ─── POST ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    let created = 0;
    let skipped = 0;

    for (const product of SEED_PRODUCTS) {
      // 중복 체크 (raw SQL — prisma generate EPERM 회피)
      const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        'SELECT COUNT(*) AS cnt FROM equipment_product WHERE model_number = ?',
        product.modelNumber,
      );
      if (Number(rows[0]?.cnt ?? 0) > 0) { skipped++; continue; }

      const { randomUUID } = await import('crypto');
      const id  = randomUUID();
      const now = new Date();
      await prisma.$executeRawUnsafe(
        `INSERT INTO equipment_product
           (id, name, model_number, manufacturer, category,
            facility_types, specs, protocols, unit_price, description,
            install_difficulty, warranty_months, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        product.name,
        product.modelNumber,
        product.manufacturer,
        product.category,
        JSON.stringify(product.facilityTypes),
        JSON.stringify(product.specs),
        JSON.stringify(product.protocols),
        product.unitPrice,
        product.description,
        product.installDifficulty,
        product.warrantyMonths,
        product.isActive ? 1 : 0,
        now,
        now,
      );
      created++;
    }

    console.info(`[제품 시드] 등록: ${created}개, 건너뜀: ${skipped}개`);
    return successResponse({ created, skipped, total: SEED_PRODUCTS.length });
  } catch (error) {
    console.error('[제품 시드] 오류:', error);
    return serverErrorResponse();
  }
}
