'use client';

/**
 * app/(tenant)/admin/equipment/page.tsx
 *
 * Super Admin — 자원 관리 페이지
 *
 * 탭 1. 재고 관리    — 도입기업별 출고·납품 추적 / 재고 현황
 * 탭 2. 제품 카탈로그 — DB 관리 제품 목록 (CRUD)
 * 탭 3. 설치 가이드  — 시설 유형별 설치·세팅 방법
 *
 * 접근 권한: super_admin only
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Shield, Package, BookOpen, Box,
  ChevronRight, RefreshCw, Search, Loader2, X,
  CheckCircle2, Clock, Truck, Wrench, Activity,
  AlertTriangle, RotateCcw, Plus,
  Building2, Factory, Home, Wifi, Cpu,
  Gauge, Monitor, Settings, ChevronDown, ChevronUp,
  ClipboardList, MapPin, Phone, User,
  ArrowRight, Info,
  Edit2, Trash2, ToggleLeft, ToggleRight,
  BarChart3, TrendingUp, PackagePlus, Warehouse, DollarSign, Hash, CalendarCheck,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { apiPatch, apiPost, apiDelete } from '@/lib/api/client';

// ─── 타입 ────────────────────────────────────────────────────────

type Tab = 'inventory' | 'products' | 'guide';
type FacilityType = 'building' | 'factory' | 'residential';
type LotStatus =
  | 'pending' | 'shipped' | 'delivered'
  | 'installing' | 'installed' | 'active' | 'returned';
type ProductCategory =
  | 'gateway' | 'sensor' | 'controller' | 'meter' | 'display' | 'accessory';

interface Lot {
  id: string;
  lotNumber: string;
  facilityType: FacilityType;
  status: LotStatus;
  orderedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  installedAt: string | null;
  technicianName: string | null;
  technicianPhone: string | null;
  siteAddress: string | null;
  siteContact: string | null;
  notes: string | null;
  totalItems: number;
  tenant: { id: string; name: string; industryType: string };
  items: LotItem[];
}

interface LotItem {
  id: string;
  quantity: number;
  serialNumbers: string[];
  status: string;
  deviceId: string | null;
  gatewayId: string | null;
  defectNote: string | null;
  product: { id: string; name: string; modelNumber: string; category: string };
}

interface Product {
  id: string;
  code?: string;
  name: string;
  modelNumber: string;
  manufacturer: string;
  category: ProductCategory;
  facilityTypes: FacilityType[];
  specs: Record<string, string>;
  protocols: string[];
  unitPrice: string | null;
  description: string | null;
  imageUrl?: string | null;
  installDifficulty: string;
  warrantyMonths: number;
  isActive: boolean;
}

interface Tenant {
  id: string;
  name: string;
  industryType: string;
}

interface StockRecord {
  id: string;
  productId: string;
  quantity: number;
  receivedAt: string;
  supplier: string | null;
  unitCost: number | null;
  batchNo: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  product: { id: string; name: string; modelNumber: string; category: string; code: string | null } | null;
}

interface ProductTotal {
  productId: string;
  product: { id: string; name: string; modelNumber: string; category: string; code: string | null };
  totalReceived: number;
  receiptCount: number;
  lastReceivedAt: string | null;
}

// ─── 상수 ────────────────────────────────────────────────────────

const LOT_STATUS_CONFIG: Record<LotStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:    { label: '발주',       color: 'text-gray-400',    bg: 'bg-gray-700/40',    icon: Clock        },
  shipped:    { label: '출하',       color: 'text-blue-400',    bg: 'bg-blue-900/30',    icon: Truck        },
  delivered:  { label: '납품 완료',  color: 'text-cyan-400',    bg: 'bg-cyan-900/30',    icon: Package      },
  installing: { label: '설치 중',    color: 'text-amber-400',   bg: 'bg-amber-900/30',   icon: Wrench       },
  installed:  { label: '설치 완료',  color: 'text-green-400',   bg: 'bg-green-900/30',   icon: CheckCircle2 },
  active:     { label: '운영 중',    color: 'text-emerald-400', bg: 'bg-emerald-900/30', icon: Activity     },
  returned:   { label: '반납',       color: 'text-red-400',     bg: 'bg-red-900/30',     icon: RotateCcw    },
};

const FACILITY_CONFIG: Record<FacilityType, { label: string; icon: typeof Building2; color: string }> = {
  building:    { label: '빌딩',   icon: Building2, color: 'text-blue-400'  },
  factory:     { label: '공장',   icon: Factory,   color: 'text-amber-400' },
  residential: { label: '가정용', icon: Home,      color: 'text-green-400' },
};

const CATEGORY_CONFIG: Record<ProductCategory, { label: string; icon: typeof Cpu; color: string }> = {
  gateway:    { label: '게이트웨이', icon: Wifi,     color: 'text-cyan-400'   },
  sensor:     { label: '센서',       icon: Activity, color: 'text-green-400'  },
  controller: { label: '컨트롤러',   icon: Cpu,      color: 'text-purple-400' },
  meter:      { label: '계량기',     icon: Gauge,    color: 'text-amber-400'  },
  display:    { label: '디스플레이', icon: Monitor,  color: 'text-blue-400'   },
  accessory:  { label: '액세서리',   icon: Settings, color: 'text-gray-400'   },
};

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  easy:   { label: '쉬움',   color: 'text-green-400' },
  medium: { label: '보통',   color: 'text-amber-400' },
  hard:   { label: '어려움', color: 'text-red-400'   },
};

// ─── 설치 가이드 데이터 ──────────────────────────────────────────

const INSTALL_GUIDES: Record<FacilityType, {
  overview: string;
  requiredProducts: { category: ProductCategory; name: string; note: string }[];
  steps: { title: string; desc: string; caution?: string }[];
  checklist: string[];
}> = {
  building: {
    overview: '빌딩(상업용 건물) 에너지 관리 시스템 설치는 전기실·기계실 중심으로 게이트웨이를 배치하고, 층별 분전반 및 주요 부하에 에너지 계량기와 센서를 설치합니다. BACnet/Modbus 프로토콜로 BMS 연동이 필요하며, 빌딩 자동화 시스템(BAS)과의 통합을 고려합니다.',
    requiredProducts: [
      { category: 'gateway',    name: 'EMS-GW-B1000 빌딩용 게이트웨이',   note: '이더넷+LTE 이중화, BACnet IP 지원' },
      { category: 'meter',      name: 'EM-3P-100A 3상 전력계량기',         note: '주간선·층별 분전반 설치' },
      { category: 'sensor',     name: 'TH-CO2-WALL 실내환경 복합센서',     note: '온도·습도·CO2 측정 (층별)' },
      { category: 'controller', name: 'CTRL-HVAC-B 공조제어 컨트롤러',     note: 'BACnet 공조기(AHU/FCU) 연동' },
      { category: 'display',    name: 'DSP-10-LOBBY 로비용 에너지 보드',   note: '실시간 에너지 현황 표시' },
    ],
    steps: [
      { title: '1단계: 현장 조사 및 설계', desc: '전기실 단선결선도 확인, 분전반 위치·용량 확인, BMS 연동 여부 확인, 네트워크 인프라 파악(이더넷 가용성, LTE 신호강도), 층별 설치 위치 도면 작성', caution: '전기실 작업 전 반드시 한전 또는 건물 전기담당자와 협의 필요' },
      { title: '2단계: 게이트웨이 설치', desc: '전기실 또는 통신실 내 DIN 레일 또는 벽면 마운트. 이더넷 케이블(Cat.6 이상) 연결. LTE 안테나 외부 인출. 접지 확인 후 전원 투입. 탄소이음 클라우드 프로비저닝 완료 확인.' },
      { title: '3단계: 전력 계량기 설치', desc: '주간선 CT(전류변환기) 설치 — 전류 방향 주의. 층별 분전반 내 전력계량기 설치. Modbus RTU(RS-485) 배선 — 종단저항 120Ω 설치. 통신 주소(슬레이브 ID) 설정 후 게이트웨이 연동 확인.', caution: '활선 작업 금지. 반드시 분전반 차단 후 작업.' },
      { title: '4단계: 환경 센서 설치', desc: '층별 대표 공간(중앙부)에 벽면 1.5m 높이 설치. RS-485 데이지체인 연결 또는 PoE 이더넷 연결. 직사광선, 공조 토출구 근처 설치 금지. 센서 ID 설정 및 데이터 수신 확인.' },
      { title: '5단계: 공조 컨트롤러 연동', desc: 'BACnet IP 또는 Modbus TCP로 AHU·FCU 연동. 냉난방 설정온도, 풍량, 운전상태 포인트 매핑. 제어 포인트(냉방ON/OFF, 설정온도 변경) 연동 테스트. DR 제어 시나리오 프로그래밍.' },
      { title: '6단계: 시스템 테스트 및 커미셔닝', desc: '전체 계량기 데이터 수신 확인. 에너지 대시보드 표시 확인. 알람 임계값 설정 (전력 이상, 환경 이상). 원격 제어 기능 테스트. 고객 인수인계 교육 진행.' },
    ],
    checklist: [
      '전기실 입장 허가 취득', '단선결선도 및 평면도 확인', '게이트웨이 전원 및 네트워크 연결',
      '전력 계량기 RS-485 통신 확인', '층별 센서 데이터 수신 확인', '공조 제어 연동 테스트',
      '탄소이음 플랫폼 데이터 수신 확인', '고객 계정 설정 및 교육 완료', '유지보수 매뉴얼 전달',
    ],
  },
  factory: {
    overview: '공장(제조업) 에너지 관리는 생산 라인별 전력 계측, 고압 수전설비 모니터링, 생산량 대비 에너지 원단위 분석이 핵심입니다. Modbus RTU/TCP 기반 PLC·인버터 연동을 통해 공정별 에너지를 세분화 측정합니다.',
    requiredProducts: [
      { category: 'gateway',    name: 'EMS-GW-F2000 산업용 게이트웨이',    note: 'DIN 레일 마운트, IP67, 산업용 온도 범위' },
      { category: 'meter',      name: 'EM-3P-800A 고전류 전력계량기',       note: '수전설비·대형 모터 라인 계측' },
      { category: 'meter',      name: 'EM-3P-100A 3상 전력계량기',          note: '개별 생산 라인·설비별 계측' },
      { category: 'sensor',     name: 'EN-VIBR-I 진동·전류 복합센서',       note: '모터·컴프레서 이상 탐지' },
      { category: 'controller', name: 'CTRL-PLC-LINK PLC 연동 모듈',        note: 'Modbus/OPC-UA로 PLC 데이터 수집' },
    ],
    steps: [
      { title: '1단계: 공장 에너지 흐름 분석', desc: '수전 전압·용량 확인. 주요 부하 목록 작성. 전력 계통도 확인. Modbus 지원 PLC·인버터·SCADA 목록 확인. 배선 경로 및 케이블 길이 산출.', caution: '고압 수전설비 접근 시 한국전기안전공사 기준 준수 필수' },
      { title: '2단계: 수전설비 전력 계측', desc: '수전반·변전실 내 주계량 설치. 고전류 CT 선정 및 설치. 전력품질 파라미터 (THD, 역률, 불평형률) 측정 포인트 설정.', caution: '고압 작업은 자격증 소지자(전기공사기사 이상)만 가능' },
      { title: '3단계: 생산 라인별 계측기 설치', desc: '생산 라인별 분전반에 전력계량기 설치. RS-485 버스 배선 — 최대 31대 직렬 연결, 120Ω 종단저항. 슬레이브 ID 중복 없이 설정.' },
      { title: '4단계: PLC/SCADA 연동', desc: 'Modbus TCP/RTU 또는 OPC-UA로 PLC 연결. 생산량 데이터 포인트 매핑. 에너지 원단위 계산 공식 설정. SCADA 타임스탬프 동기화.' },
      { title: '5단계: 산업용 게이트웨이 설치', desc: 'DIN 레일 마운트. 이더넷 연결. 산업용 LTE 라우터와 이중화 구성. 서지 보호기(SPD) 설치. 탄소이음 플랫폼 연결 확인.' },
      { title: '6단계: 공정 에너지 커미셔닝', desc: '생산 라인별 실시간 전력 모니터링 확인. 에너지 원단위 KPI 대시보드 설정. 이상 탐지 알람 임계값 설정. DR 제어 시나리오 테스트.' },
    ],
    checklist: [
      '수전설비 전기 안전 검토 완료', '생산 라인별 에너지 계측기 설치', 'PLC/인버터 Modbus 연동 확인',
      'RS-485 버스 통신 에러율 확인 (0.1% 이하)', '게이트웨이 이중화 (이더넷+LTE) 확인',
      '에너지 원단위 KPI 설정 완료', '공정 알람 임계값 설정', '탄소이음 플랫폼 데이터 수신 확인', '공장 에너지 담당자 교육 완료',
    ],
  },
  residential: {
    overview: '가정용(공동주택) 에너지 관리는 세대별 전력 계측과 공용부 에너지 관리가 중심입니다. Wi-Fi 또는 RS-485 기반 스마트 계량기, 플러그형 센서로 쉽게 설치할 수 있습니다.',
    requiredProducts: [
      { category: 'gateway',   name: 'EMS-GW-H500 가정용 허브',         note: 'Wi-Fi+RS-485, 소형 벽면 부착' },
      { category: 'meter',     name: 'SM-1P-40A 스마트 단상 계량기',     note: '세대 분전반 내 설치, AMI 연동' },
      { category: 'sensor',    name: 'PLUG-SMART 스마트 플러그',         note: '개별 가전제품 소비전력 측정' },
      { category: 'sensor',    name: 'TH-MINI 소형 온습도 센서',         note: 'Wi-Fi 연결, 거실·침실 배치' },
      { category: 'display',   name: 'DSP-WALL-7 월패드 에너지 위젯',   note: '기존 월패드 연동 또는 독립 설치' },
      { category: 'accessory', name: 'WIFI-EXT Wi-Fi 신호 증폭기',       note: '넓은 평형·지하층 신호 보완' },
    ],
    steps: [
      { title: '1단계: 세대 현황 파악', desc: '공동주택 단지 세대수 및 평형 확인. 기존 AMI 스마트미터 설치 여부 확인. 공용부 전기실 위치 및 네트워크 인프라 파악.' },
      { title: '2단계: 중앙 게이트웨이 설치 (관리동)', desc: '관리동 서버실 또는 전기실에 게이트웨이 설치. 인터넷 회선 연결. 각 동별 RS-485 버스 라인 연결.', caution: '아파트 공용부 작업 시 관리사무소 사전 협의 및 입주민 공지 필요' },
      { title: '3단계: 세대별 스마트 계량기 설치', desc: '세대 분전반 내 기존 누전차단기 후단에 스마트 계량기 설치. RS-485 배선. 한전 AMI 연동 설정.', caution: '세대 내 분전반 작업 시 전기안전공사 기준 준수' },
      { title: '4단계: 스마트 플러그 배포', desc: '에어컨·냉장고·세탁기 등 주요 가전 회로에 스마트 플러그 설치. Wi-Fi 연결 설정. 탄소이음 앱으로 세대 등록.' },
      { title: '5단계: 환경 센서 설치', desc: '거실 중앙에 온습도 센서 설치 (높이 1.0~1.5m). Wi-Fi 연결 후 탄소이음 앱 페어링.' },
      { title: '6단계: 세대 앱 설정 및 교육', desc: '입주민 스마트폰에 탄소이음 앱 설치. 세대별 에너지 사용량 확인 방법 교육. 에너지 절약 목표 설정.' },
    ],
    checklist: [
      '관리사무소 협의 및 입주민 공지 완료', '게이트웨이 인터넷 연결 확인', '세대별 스마트 계량기 설치 완료',
      'AMI 연동 또는 RS-485 통신 확인', '스마트 플러그 Wi-Fi 페어링 완료', '환경 센서 데이터 수신 확인',
      '탄소이음 앱 세대 등록 완료', '입주민 교육 실시', '공용부 에너지 대시보드 설정',
    ],
  },
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────────

export default function EquipmentManagementPage() {
  const [tab, setTab]               = useState<Tab>('inventory');
  const [accessDenied, setAccessDenied] = useState(false);

  if (accessDenied) {
    return (
      <div className="h-full bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">접근 거부</h2>
          <p className="text-slate-400">이 페이지는 시스템 관리자(Super Admin)만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-900 text-white">
      {/* 페이지 헤더 */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/10 rounded-lg">
            <Shield className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">자원 관리</h1>
            <p className="text-xs text-slate-400">Super Admin — 납품 설비 출고 추적 · 제품 카탈로그 · 설치 가이드</p>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1">
          {(
            [
              { key: 'inventory', label: '재고 관리',    icon: BarChart3  },
              { key: 'products', label: '제품 카탈로그', icon: Box       },
              { key: 'guide',    label: '설치 가이드',  icon: BookOpen  },
            ] as { key: Tab; label: string; icon: typeof Package }[]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === key
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="p-6">
        {tab === 'inventory' && <InventoryTab onAccessDenied={() => setAccessDenied(true)} />}
        {tab === 'products' && <ProductTab onAccessDenied={() => setAccessDenied(true)} />}
        {tab === 'guide'    && <GuideTab />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 탭 1: 재고 관리 (재고 현황 + 출고 기록)
// ════════════════════════════════════════════════════════════════

function InventoryTab({ onAccessDenied }: { onAccessDenied: () => void }) {
  const [lots, setLots]               = useState<Lot[]>([]);
  const [tenants, setTenants]         = useState<Tenant[]>([]);
  const [products, setProducts]       = useState<Product[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [total, setTotal]             = useState(0);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterFacility, setFilterFacility] = useState('');
  const [filterTenant, setFilterTenant]   = useState('');
  const [search, setSearch]           = useState('');
  const [showNewLotModal, setShowNewLotModal] = useState(false);
  const [showNewStockModal, setShowNewStockModal] = useState(false);
  const [activeView, setActiveView]   = useState<'stock' | 'inbound' | 'shipments'>('stock');
  const [viewMode, setViewMode]       = useState<'list' | 'summary'>('list');
  const [stocks, setStocks]           = useState<StockRecord[]>([]);
  const [productTotals, setProductTotals] = useState<ProductTotal[]>([]);
  const [isStockLoading, setIsStockLoading] = useState(false);

  const fetchLots = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus)   params.set('status',       filterStatus);
      if (filterFacility) params.set('facilityType', filterFacility);
      if (filterTenant)   params.set('tenantId',     filterTenant);
      params.set('take', '200');

      const res = await fetch(`/api/admin/equipment/lots?${params}`);
      if (res.status === 403) { onAccessDenied(); return; }
      const json = await res.json();
      if (json.success) {
        setLots(json.data.lots);
        setTotal(json.data.pagination?.total ?? json.data.lots.length);
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [filterStatus, filterFacility, filterTenant, onAccessDenied]);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tenants?take=100');
      const json = await res.json();
      if (json.success) setTenants(json.data);
    } catch { /* ignore */ }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/equipment/products?isActive=true');
      const json = await res.json();
      if (json.success) setProducts(json.data.products ?? []);
    } catch { /* ignore */ }
  }, []);

  const fetchStocks = useCallback(async () => {
    setIsStockLoading(true);
    try {
      const res = await fetch('/api/admin/equipment/stock?take=200');
      const json = await res.json();
      if (json.success) {
        setStocks(json.data.stocks ?? []);
        setProductTotals(json.data.productTotals ?? []);
      }
    } catch { /* ignore */ }
    finally { setIsStockLoading(false); }
  }, []);

  useEffect(() => { fetchLots(); fetchTenants(); fetchProducts(); fetchStocks(); }, [fetchLots, fetchTenants, fetchProducts, fetchStocks]);

  const updateLotStatus = async (id: string, status: LotStatus) => {
    try {
      const res = await apiPatch(`/api/admin/equipment/lots/${id}`, { status });
      if (res.success) {
        toast.success(`상태 변경: ${LOT_STATUS_CONFIG[status].label}`);
        fetchLots();
        if (selectedLot?.id === id) {
          const detail = await fetch(`/api/admin/equipment/lots/${id}`).then((r) => r.json());
          if (detail.success) setSelectedLot(detail.data);
        }
      }
    } catch { toast.error('상태 변경 실패'); }
  };

  const filteredLots = lots.filter((l) =>
    search
      ? l.lotNumber.includes(search) || l.tenant.name.includes(search)
        || l.siteAddress?.includes(search) || false
      : true
  );

  // 통계
  const stats = {
    total,
    active:     lots.filter((l) => l.status === 'active').length,
    installing: lots.filter((l) => ['shipped', 'delivered', 'installing'].includes(l.status)).length,
    installed:  lots.filter((l) => l.status === 'installed').length,
    totalItems: lots.reduce((s, l) => s + l.totalItems, 0),
    returned:   lots.filter((l) => l.status === 'returned').length,
  };

  // 제품별 재고 현황 집계
  type StockEntry = {
    product: { id: string; name: string; modelNumber: string; category: string };
    delivered: number;
    active: number;
    inProgress: number;
    returned: number;
  };
  const productStockMap: Record<string, StockEntry> = {};
  for (const lot of lots) {
    for (const item of lot.items) {
      if (!productStockMap[item.product.id]) {
        productStockMap[item.product.id] = {
          product: item.product,
          delivered: 0, active: 0, inProgress: 0, returned: 0,
        };
      }
      const entry = productStockMap[item.product.id]!;
      if (['shipped', 'delivered', 'installing', 'installed', 'active'].includes(lot.status)) {
        entry.delivered += item.quantity;
      }
      if (lot.status === 'active')  entry.active     += item.quantity;
      if (['installing', 'installed'].includes(lot.status)) entry.inProgress += item.quantity;
      if (lot.status === 'returned') entry.returned  += item.quantity;
    }
  }
  const productStockList = Object.values(productStockMap)
    .sort((a, b) => b.delivered - a.delivered);

  // 업체별 재고 현황 집계
  const tenantSummary = tenants
    .map((t) => {
      const tLots = lots.filter((l) => l.tenant.id === t.id);
      const totalQty = tLots.reduce((s, l) => s + l.totalItems, 0);
      const latest = tLots.sort((a, b) => {
        const da = a.shippedAt ?? a.orderedAt ?? '';
        const db = b.shippedAt ?? b.orderedAt ?? '';
        return db.localeCompare(da);
      })[0];
      const activeCount = tLots.filter((l) => ['active', 'installed'].includes(l.status)).length;
      return { tenant: t, lotCount: tLots.length, totalQty, latest, activeCount };
    })
    .filter((s) => s.lotCount > 0)
    .sort((a, b) => b.totalQty - a.totalQty);

  return (
    <div>
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon={Box}          label="총 납품 수량" value={stats.totalItems} color="text-cyan-400"    />
        <StatCard icon={Activity}     label="운영 중"      value={stats.active}     color="text-emerald-400" />
        <StatCard icon={Truck}        label="출고 진행"    value={stats.installing} color="text-amber-400"   />
        <StatCard icon={CheckCircle2} label="설치 완료"    value={stats.installed}  color="text-green-400"   />
        <StatCard icon={RotateCcw}    label="반납"         value={stats.returned}   color="text-red-400"     />
      </div>

      {/* 뷰 전환 탭 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
          <button
            onClick={() => setActiveView('stock')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm transition ${activeView === 'stock' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> 재고 현황
          </button>
          <button
            onClick={() => setActiveView('inbound')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm transition ${activeView === 'inbound' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Warehouse className="w-3.5 h-3.5" /> 입고 현황
          </button>
          <button
            onClick={() => setActiveView('shipments')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm transition ${activeView === 'shipments' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Truck className="w-3.5 h-3.5" /> 출고 기록
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { fetchLots(); fetchStocks(); }}
            className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowNewStockModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-sm font-medium transition">
            <PackagePlus className="w-4 h-4" />
            입고 등록
          </button>
          <button onClick={() => setShowNewLotModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition">
            <Plus className="w-4 h-4" />
            출고 등록
          </button>
        </div>
      </div>

      {/* ── 재고 현황 뷰 ─────────────────────────────── */}
      {activeView === 'stock' && (
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : productStockList.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="mb-3">납품 이력이 없습니다</p>
              <button onClick={() => setShowNewLotModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition mx-auto">
                <Plus className="w-4 h-4" /> 첫 출고 등록
              </button>
            </div>
          ) : (
            <div>
              <div className="text-xs text-slate-500 mb-3">제품별 재고 현황 ({productStockList.length}종)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {productStockList.map(({ product, delivered, active, inProgress, returned }) => {
                  const catCfg = CATEGORY_CONFIG[product.category as ProductCategory];
                  const CatIcon = catCfg?.icon ?? Box;
                  const inStock = delivered - active - inProgress - returned;
                  return (
                    <div key={product.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-500 transition">
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`p-2 rounded-lg bg-slate-700/60 flex-shrink-0`}>
                          <CatIcon className={`w-4 h-4 ${catCfg?.color ?? 'text-gray-400'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-100 text-sm leading-snug truncate">{product.name}</div>
                          <div className="font-mono text-xs text-slate-400">{product.modelNumber}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{catCfg?.label ?? product.category}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-slate-700/50 rounded-lg p-2">
                          <div className="text-base font-bold text-cyan-300">{delivered}</div>
                          <div className="text-[10px] text-slate-400">총 납품</div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-2">
                          <div className="text-base font-bold text-emerald-300">{active}</div>
                          <div className="text-[10px] text-slate-400">운영 중</div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-2">
                          <div className="text-base font-bold text-amber-300">{inProgress}</div>
                          <div className="text-[10px] text-slate-400">설치 중</div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-2">
                          <div className={`text-base font-bold ${returned > 0 ? 'text-red-300' : 'text-slate-500'}`}>{returned}</div>
                          <div className="text-[10px] text-slate-400">반납</div>
                        </div>
                      </div>
                      {inStock > 0 && (
                        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          재고 가용: {inStock}개 (납품됐으나 미운영)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 입고 현황 뷰 ─────────────────────────────── */}
      {activeView === 'inbound' && (
        <div>
          {isStockLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : productTotals.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="mb-3">입고 이력이 없습니다</p>
              <button onClick={() => setShowNewStockModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-sm font-medium transition mx-auto">
                <PackagePlus className="w-4 h-4" /> 첫 입고 등록
              </button>
            </div>
          ) : (
            <div>
              {/* 제품별 입고 합계 카드 */}
              <div className="text-xs text-slate-500 mb-3">제품별 총 입고 현황 ({productTotals.length}종)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                {productTotals.map((pt) => {
                  const catCfg = CATEGORY_CONFIG[pt.product.category as ProductCategory];
                  const CatIcon = catCfg?.icon ?? Box;
                  return (
                    <div key={pt.productId} className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-500 transition">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-emerald-900/30 flex-shrink-0">
                          <CatIcon className={`w-4 h-4 ${catCfg?.color ?? 'text-gray-400'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-100 text-sm leading-snug truncate">{pt.product.name}</div>
                          <div className="font-mono text-xs text-slate-400">{pt.product.modelNumber}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{catCfg?.label ?? pt.product.category}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-emerald-900/30 rounded-lg p-2">
                          <div className="text-base font-bold text-emerald-300">{pt.totalReceived}</div>
                          <div className="text-[10px] text-slate-400">총 입고</div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-2">
                          <div className="text-base font-bold text-cyan-300">{pt.receiptCount}</div>
                          <div className="text-[10px] text-slate-400">입고 건수</div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-2">
                          <div className="text-[11px] font-medium text-slate-300 leading-snug">
                            {pt.lastReceivedAt ? new Date(pt.lastReceivedAt).toLocaleDateString('ko-KR') : '—'}
                          </div>
                          <div className="text-[10px] text-slate-400">최근 입고</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 입고 이력 목록 */}
              <div className="text-xs text-slate-500 mb-3">입고 이력 ({stocks.length}건)</div>
              <div className="space-y-2">
                {stocks.map((s) => {
                  const catCfg = CATEGORY_CONFIG[s.product?.category as ProductCategory];
                  const CatIcon = catCfg?.icon ?? Box;
                  return (
                    <div key={s.id} className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-emerald-900/30 flex-shrink-0">
                        <CatIcon className={`w-4 h-4 ${catCfg?.color ?? 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="font-medium text-slate-200 text-sm">{s.product?.name ?? s.productId}</div>
                            <div className="font-mono text-xs text-slate-400">{s.product?.modelNumber}</div>
                          </div>
                          <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-sm">
                            <PackagePlus className="w-4 h-4" /> +{s.quantity}개
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
                            {new Date(s.receivedAt).toLocaleDateString('ko-KR')}
                          </span>
                          {s.supplier && (
                            <span className="flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5" /> {s.supplier}
                            </span>
                          )}
                          {s.unitCost != null && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                              단가: {s.unitCost.toLocaleString()}원
                            </span>
                          )}
                          {s.batchNo && (
                            <span className="flex items-center gap-1">
                              <Hash className="w-3.5 h-3.5" /> {s.batchNo}
                            </span>
                          )}
                        </div>
                        {s.notes && <div className="mt-1 text-xs text-slate-500 truncate">{s.notes}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 출고 기록 뷰 ─────────────────────────────── */}
      {activeView === 'shipments' && (
      <div>
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="출고번호·업체명·주소 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
          <option value="">모든 상태</option>
          {(Object.keys(LOT_STATUS_CONFIG) as LotStatus[]).map((k) => (
            <option key={k} value={k}>{LOT_STATUS_CONFIG[k].label}</option>
          ))}
        </select>
        <select value={filterFacility} onChange={(e) => setFilterFacility(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
          <option value="">모든 시설</option>
          {(Object.keys(FACILITY_CONFIG) as FacilityType[]).map((k) => (
            <option key={k} value={k}>{FACILITY_CONFIG[k].label}</option>
          ))}
        </select>
        <select value={filterTenant} onChange={(e) => setFilterTenant(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
          <option value="">모든 업체</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {/* 보기 전환 */}
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded text-xs transition ${viewMode === 'list' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >목록</button>
          <button
            onClick={() => setViewMode('summary')}
            className={`px-3 py-1 rounded text-xs transition ${viewMode === 'summary' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >업체별 현황</button>
        </div>

      </div>

      {/* 업체별 현황 뷰 */}
      {viewMode === 'summary' && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            도입 업체별 납품 현황
          </h3>
          {tenantSummary.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">납품 내역이 없습니다</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tenantSummary.map(({ tenant, lotCount, totalQty, latest, activeCount }) => {
                const latestStatus = latest?.status;
                const sc = latestStatus ? LOT_STATUS_CONFIG[latestStatus] : null;
                return (
                  <div key={tenant.id}
                    className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-500 cursor-pointer transition"
                    onClick={() => { setFilterTenant(tenant.id); setViewMode('list'); }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-slate-100 text-sm">{tenant.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {FACILITY_CONFIG[tenant.industryType as FacilityType]?.label ?? tenant.industryType}
                        </div>
                      </div>
                      {sc && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>
                          {sc.label}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-700/50 rounded-lg p-2">
                        <div className="text-lg font-bold text-cyan-300">{lotCount}</div>
                        <div className="text-[10px] text-slate-400">출고 건</div>
                      </div>
                      <div className="bg-slate-700/50 rounded-lg p-2">
                        <div className="text-lg font-bold text-amber-300">{totalQty}</div>
                        <div className="text-[10px] text-slate-400">총 수량</div>
                      </div>
                      <div className="bg-slate-700/50 rounded-lg p-2">
                        <div className="text-lg font-bold text-emerald-300">{activeCount}</div>
                        <div className="text-[10px] text-slate-400">운영 중</div>
                      </div>
                    </div>
                    {latest?.shippedAt && (
                      <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        최근 출하 {new Date(latest.shippedAt).toLocaleDateString('ko-KR')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 목록 + 상세 패널 */}
      {viewMode === 'list' && (
        <div className="flex gap-6">
          {/* 출고 목록 */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            ) : filteredLots.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>등록된 출고 내역이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLots.map((lot) => {
                  const sc = LOT_STATUS_CONFIG[lot.status];
                  const fc = FACILITY_CONFIG[lot.facilityType as FacilityType];
                  const StatusIcon = sc?.icon ?? Clock;
                  const FacilityIcon = fc?.icon ?? Building2;
                  return (
                    <div
                      key={lot.id}
                      onClick={() => setSelectedLot(lot)}
                      className={`bg-slate-800 rounded-lg border p-4 cursor-pointer transition hover:border-cyan-600 ${
                        selectedLot?.id === lot.id ? 'border-cyan-500' : 'border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg ${sc?.bg ?? 'bg-slate-700/40'} flex-shrink-0`}>
                            <StatusIcon className={`w-4 h-4 ${sc?.color ?? 'text-gray-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold text-cyan-300">{lot.lotNumber}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${sc?.bg} ${sc?.color}`}>{sc?.label}</span>
                            </div>
                            <div className="text-sm text-slate-300 mt-0.5">{lot.tenant.name}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <FacilityIcon className={`w-4 h-4 ${fc?.color ?? 'text-slate-400'}`} />
                          <span className="text-xs text-slate-400">{fc?.label ?? lot.facilityType}</span>
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Box className="w-3.5 h-3.5" />{lot.totalItems}개 품목
                        </span>
                        {lot.shippedAt && (
                          <span className="flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-blue-400" />
                            출하 {new Date(lot.shippedAt).toLocaleDateString('ko-KR')}
                          </span>
                        )}
                        {lot.deliveredAt && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                            납품 {new Date(lot.deliveredAt).toLocaleDateString('ko-KR')}
                          </span>
                        )}
                        {lot.technicianName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />{lot.technicianName}
                          </span>
                        )}
                        {lot.siteAddress && (
                          <span className="flex items-center gap-1 truncate max-w-xs">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />{lot.siteAddress}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 상세 패널 */}
          {selectedLot && (
            <LotDetailPanel
              lot={selectedLot}
              onClose={() => setSelectedLot(null)}
              onStatusChange={updateLotStatus}
            />
          )}
        </div>
      )}

      </div>
      )} {/* end activeView === 'shipments' */}

      {/* 신규 출고 등록 모달 */}
      {showNewLotModal && (
        <NewLotModal
          tenants={tenants}
          products={products}
          onClose={() => setShowNewLotModal(false)}
          onCreated={() => { fetchLots(); setShowNewLotModal(false); }}
        />
      )}

      {/* 신규 입고 등록 모달 */}
      {showNewStockModal && (
        <NewStockModal
          products={products}
          onClose={() => setShowNewStockModal(false)}
          onCreated={() => { fetchStocks(); setShowNewStockModal(false); setActiveView('inbound'); }}
        />
      )}
    </div>
  );
}

// ─── 출고 상세 패널 ──────────────────────────────────────────────

function LotDetailPanel({
  lot,
  onClose,
  onStatusChange,
}: {
  lot: Lot;
  onClose: () => void;
  onStatusChange: (id: string, status: LotStatus) => void;
}) {
  return (
    <div className="w-96 flex-shrink-0 bg-slate-800 rounded-lg border border-slate-700 p-5 sticky top-0 max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-mono text-sm text-cyan-300 font-semibold">{lot.lotNumber}</div>
          <div className="text-xs text-slate-400 mt-0.5">{lot.tenant.name}</div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 상태 변경 */}
      <div className="mb-5">
        <div className="text-xs text-slate-400 mb-2">상태 변경</div>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(LOT_STATUS_CONFIG) as LotStatus[]).map((s) => {
            const cfg = LOT_STATUS_CONFIG[s];
            const Ic = cfg.icon;
            return (
              <button
                key={s}
                onClick={() => onStatusChange(lot.id, s)}
                title={cfg.label}
                className={`flex flex-col items-center gap-1 p-2 rounded text-xs transition ${
                  lot.status === s
                    ? `${cfg.bg} ${cfg.color} ring-1 ring-current`
                    : 'bg-slate-700/50 text-slate-500 hover:bg-slate-700'
                }`}
              >
                <Ic className="w-3.5 h-3.5" />
                <span className="leading-tight text-center" style={{ fontSize: '10px' }}>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 출하·납품 타임라인 */}
      <div className="mb-5">
        <div className="text-xs text-slate-400 mb-2">출하·납품 일정</div>
        <div className="relative pl-4">
          {[
            { label: '발주', date: lot.orderedAt, icon: Clock, color: 'text-gray-400' },
            { label: '출하', date: lot.shippedAt, icon: Truck, color: 'text-blue-400' },
            { label: '납품', date: lot.deliveredAt, icon: Package, color: 'text-cyan-400' },
            { label: '설치', date: lot.installedAt, icon: CheckCircle2, color: 'text-green-400' },
          ].map(({ label, date, icon: Ic, color }, idx, arr) => (
            <div key={label} className="flex items-center gap-3 mb-3 last:mb-0 relative">
              {idx < arr.length - 1 && (
                <div className="absolute left-[-12px] top-5 w-px h-full bg-slate-700" />
              )}
              <div className={`absolute left-[-14px] w-3 h-3 rounded-full ${date ? 'bg-cyan-600' : 'bg-slate-700'} flex-shrink-0`} />
              <Ic className={`w-3.5 h-3.5 ${date ? color : 'text-slate-600'} flex-shrink-0`} />
              <div className="flex-1 flex items-center justify-between text-xs">
                <span className={date ? 'text-slate-300' : 'text-slate-600'}>{label}</span>
                <span className={date ? 'text-slate-200 font-medium' : 'text-slate-600'}>
                  {date ? new Date(date).toLocaleDateString('ko-KR') : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 시설 정보 */}
      <div className="mb-5">
        <div className="text-xs text-slate-400 mb-2">시설 정보</div>
        <div className="space-y-1.5 text-xs">
          {[
            { label: '시설 유형', value: FACILITY_CONFIG[lot.facilityType as FacilityType]?.label ?? lot.facilityType },
            { label: '설치 주소', value: lot.siteAddress || '—' },
            { label: '현장 담당자', value: lot.siteContact || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-2">
              <span className="text-slate-400 flex-shrink-0">{label}</span>
              <span className="text-slate-200 text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 설치 기사 */}
      {(lot.technicianName || lot.technicianPhone) && (
        <div className="mb-5">
          <div className="text-xs text-slate-400 mb-2">설치 기사</div>
          <div className="bg-slate-700/50 rounded p-3 text-xs space-y-1">
            {lot.technicianName  && <div className="flex items-center gap-2"><User  className="w-3.5 h-3.5 text-slate-400" />{lot.technicianName}</div>}
            {lot.technicianPhone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" />{lot.technicianPhone}</div>}
          </div>
        </div>
      )}

      {/* 납품 품목 */}
      <div className="mb-5">
        <div className="text-xs text-slate-400 mb-2">납품 품목 ({lot.items.length}종)</div>
        <div className="space-y-2">
          {lot.items.map((item) => {
            const catCfg = CATEGORY_CONFIG[item.product.category as ProductCategory];
            const CatIcon = catCfg?.icon ?? Box;
            return (
              <div key={item.id} className="bg-slate-700/40 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CatIcon className={`w-3.5 h-3.5 ${catCfg?.color ?? 'text-gray-400'}`} />
                  <span className="text-xs font-medium text-slate-200">{item.product.name}</span>
                </div>
                <div className="text-xs text-slate-400 space-y-0.5">
                  <div>모델: {item.product.modelNumber}</div>
                  <div className="font-semibold text-amber-300">수량: {item.quantity}개</div>
                  {item.serialNumbers.length > 0 && (
                    <div className="font-mono text-slate-500">S/N: {item.serialNumbers.join(', ')}</div>
                  )}
                  {item.defectNote && (
                    <div className="text-red-400">불량: {item.defectNote}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 비고 */}
      {lot.notes && (
        <div>
          <div className="text-xs text-slate-400 mb-2">비고</div>
          <div className="bg-slate-700/40 rounded p-3 text-xs text-slate-300 whitespace-pre-wrap">{lot.notes}</div>
        </div>
      )}
    </div>
  );
}

// ─── 신규 입고 등록 모달 ──────────────────────────────────────────

function NewStockModal({
  products,
  onClose,
  onCreated,
}: {
  products: Product[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    productId:  '',
    quantity:   1,
    receivedAt: '',
    supplier:   '',
    unitCost:   '',
    batchNo:    '',
    notes:      '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (!form.productId)   { toast.error('제품을 선택하세요'); return; }
    if (form.quantity < 1) { toast.error('수량은 1 이상이어야 합니다'); return; }

    setIsSaving(true);
    try {
      const payload = {
        productId:  form.productId,
        quantity:   form.quantity,
        receivedAt: form.receivedAt || undefined,
        supplier:   form.supplier  || null,
        unitCost:   form.unitCost  ? Number(form.unitCost) : null,
        batchNo:    form.batchNo   || null,
        notes:      form.notes     || null,
      };
      const res = await apiPost('/api/admin/equipment/stock', payload);
      if (res.success) {
        const prod = products.find((p) => p.id === form.productId);
        toast.success(`입고 등록 완료: ${prod?.name ?? form.productId} × ${form.quantity}개`);
        onCreated();
      } else {
        toast.error((res as any).error ?? '등록 실패');
      }
    } catch { toast.error('등록 오류'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-emerald-400" />
            입고 등록
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          {/* 제품 선택 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">제품 <span className="text-red-400">*</span></label>
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm">
              <option value="">제품 선택...</option>
              {(Object.keys(CATEGORY_CONFIG) as ProductCategory[]).map((cat) => {
                const catProducts = products.filter((p) => p.category === cat);
                if (catProducts.length === 0) return null;
                return (
                  <optgroup key={cat} label={CATEGORY_CONFIG[cat].label}>
                    {catProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.modelNumber})</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          {/* 수량 + 입고일 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">수량 <span className="text-red-400">*</span></label>
              <input type="number" min={1} value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">입고일</label>
              <input type="date" value={form.receivedAt}
                onChange={(e) => setForm({ ...form, receivedAt: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* 공급업체 + 단가 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">공급업체</label>
              <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="(주)탄소이음 물류" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">단가 (원)</label>
              <input type="number" min={0} value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                placeholder="150000" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* 배치번호 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">배치 번호 (Batch No.)</label>
            <input value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })}
              placeholder="BATCH-2026-001" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* 비고 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">비고</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2} placeholder="특이사항 입력..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">취소</button>
          <button onClick={save} disabled={isSaving}
            className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-sm font-medium transition disabled:opacity-50">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '입고 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 신규 출고 등록 모달 (제품 품목 선택 포함) ───────────────────

function NewLotModal({
  tenants,
  products,
  onClose,
  onCreated,
}: {
  tenants: Tenant[];
  products: Product[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    tenantId:        '',
    facilityType:    'building' as FacilityType,
    technicianName:  '',
    technicianPhone: '',
    siteAddress:     '',
    siteContact:     '',
    orderedAt:       '',
    shippedAt:       '',
    notes:           '',
  });
  const [items, setItems] = useState<{ productId: string; quantity: number; serialNumbers: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const addItem = () =>
    setItems((prev) => [...prev, { productId: '', quantity: 1, serialNumbers: '' }]);
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<typeof items[0]>) =>
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));

  const save = async () => {
    if (!form.tenantId) { toast.error('도입 업체를 선택하세요'); return; }
    const invalidItem = items.find((it) => !it.productId || it.quantity < 1);
    if (invalidItem) { toast.error('품목의 제품과 수량을 확인하세요'); return; }

    setIsSaving(true);
    try {
      const payload = {
        ...form,
        orderedAt: form.orderedAt || null,
        shippedAt: form.shippedAt || null,
        status: form.shippedAt ? 'shipped' : 'pending',
        items: items.map((it) => ({
          productId:     it.productId,
          quantity:      it.quantity,
          serialNumbers: it.serialNumbers
            ? it.serialNumbers.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        })),
      };
      const res = await apiPost('/api/admin/equipment/lots', payload);
      if (res.success) {
        toast.success(`출고 등록 완료: ${(res.data as any).lotNumber}`);
        onCreated();
      } else {
        toast.error(res.error ?? '등록 실패');
      }
    } catch { toast.error('등록 오류'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Truck className="w-5 h-5 text-cyan-400" />
            신규 출고 등록
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          {/* 도입 업체 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">도입 업체 <span className="text-red-400">*</span></label>
            <select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm">
              <option value="">업체 선택...</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* 시설 유형 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">시설 유형 <span className="text-red-400">*</span></label>
            <div className="flex gap-2">
              {(Object.keys(FACILITY_CONFIG) as FacilityType[]).map((k) => {
                const fc = FACILITY_CONFIG[k];
                const Ic = fc.icon;
                return (
                  <button key={k} onClick={() => setForm({ ...form, facilityType: k })}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg border text-xs transition ${
                      form.facilityType === k
                        ? 'bg-cyan-900/40 border-cyan-500 text-cyan-300'
                        : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <Ic className={`w-5 h-5 ${form.facilityType === k ? 'text-cyan-400' : fc.color}`} />
                    {fc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 날짜 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">발주일</label>
              <input type="date" value={form.orderedAt} onChange={(e) => setForm({ ...form, orderedAt: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">출하일 (입력 시 '출하' 상태로 등록)</label>
              <input type="date" value={form.shippedAt} onChange={(e) => setForm({ ...form, shippedAt: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* 기사 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">설치 기사</label>
              <input value={form.technicianName} onChange={(e) => setForm({ ...form, technicianName: e.target.value })}
                placeholder="홍길동" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">기사 연락처</label>
              <input value={form.technicianPhone} onChange={(e) => setForm({ ...form, technicianPhone: e.target.value })}
                placeholder="010-0000-0000" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* 설치 주소 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">설치 주소</label>
              <input value={form.siteAddress} onChange={(e) => setForm({ ...form, siteAddress: e.target.value })}
                placeholder="서울시 강남구 테헤란로 123" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">현장 담당자</label>
              <input value={form.siteContact} onChange={(e) => setForm({ ...form, siteContact: e.target.value })}
                placeholder="김담당" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* 납품 품목 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400">납품 품목</label>
              <button onClick={addItem}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition">
                <Plus className="w-3.5 h-3.5" /> 품목 추가
              </button>
            </div>
            {items.length === 0 && (
              <div className="text-xs text-slate-600 text-center py-4 border border-dashed border-slate-700 rounded-lg">
                품목을 추가하여 납품 제품과 수량을 기록하세요
              </div>
            )}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <select value={item.productId}
                        onChange={(e) => updateItem(idx, { productId: e.target.value })}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs mb-2">
                        <option value="">제품 선택...</option>
                        {(Object.keys(CATEGORY_CONFIG) as ProductCategory[]).map((cat) => {
                          const catProducts = products.filter((p) => p.category === cat);
                          if (catProducts.length === 0) return null;
                          return (
                            <optgroup key={cat} label={CATEGORY_CONFIG[cat].label}>
                              {catProducts.map((p) => (
                                <option key={p.id} value={p.id}>{p.name} ({p.modelNumber})</option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500">수량</label>
                          <input type="number" min={1} value={item.quantity}
                            onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">시리얼번호 (쉼표 구분)</label>
                          <input value={item.serialNumbers}
                            onChange={(e) => updateItem(idx, { serialNumbers: e.target.value })}
                            placeholder="SN001, SN002"
                            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs" />
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeItem(idx)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 비고 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">비고</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2} placeholder="특이사항 입력..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">취소</button>
          <button onClick={save} disabled={isSaving}
            className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition disabled:opacity-50">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '출고 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 탭 2: 제품 카탈로그 (CRUD)
// ════════════════════════════════════════════════════════════════

function ProductSeedBanner({ onSeeded }: { onSeeded: () => void }) {
  const [isSeeding, setIsSeeding] = useState(false);

  const seed = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/admin/equipment/products/seed', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success(`제품 초기 데이터 등록 완료 (${json.data.created}개 신규)`);
        onSeeded();
      } else {
        toast.error('시드 데이터 등록 실패');
      }
    } catch { toast.error('시드 데이터 등록 오류'); }
    finally { setIsSeeding(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="w-14 h-14 text-slate-600 mb-4" />
      <p className="text-slate-400 mb-2">등록된 제품이 없습니다</p>
      <p className="text-xs text-slate-500 mb-6">초기 제품 카탈로그를 DB에 등록하려면 아래 버튼을 클릭하세요</p>
      <button onClick={seed} disabled={isSeeding}
        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-sm font-medium transition">
        {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        초기 제품 데이터 등록
      </button>
    </div>
  );
}

function ProductTab({ onAccessDenied }: { onAccessDenied: () => void }) {
  const [products, setProducts]               = useState<Product[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [filterCategory, setFilterCategory]   = useState<ProductCategory | ''>('');
  const [filterFacility, setFilterFacility]   = useState<FacilityType | ''>('');
  const [filterActive, setFilterActive]       = useState<'all' | 'active' | 'inactive'>('active');
  const [search, setSearch]                   = useState('');
  const [expandedId, setExpandedId]           = useState<string | null>(null);
  const [showModal, setShowModal]             = useState(false);
  const [editingProduct, setEditingProduct]   = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = filterActive === 'all' ? '' : `?isActive=${filterActive === 'active'}`;
      const res = await fetch(`/api/admin/equipment/products${params}`);
      if (res.status === 403) { onAccessDenied(); return; }
      const json = await res.json();
      if (json.success) setProducts(json.data.products ?? []);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [filterActive, onAccessDenied]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleDeleteConfirm = async (product: Product) => {
    try {
      const res = await apiDelete(`/api/admin/equipment/products/${product.id}`);
      if (res.success) {
        const d = res.data as any;
        toast.success(d?.message ?? '삭제 완료');
        setDeletingProductId(null);
        if (selectedProduct?.id === product.id) setSelectedProduct(null);
        fetchProducts();
      } else {
        toast.error(res.error ?? '삭제 실패');
      }
    } catch { toast.error('삭제 오류'); }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const res = await apiPatch(`/api/admin/equipment/products/${product.id}`, {
        isActive: !product.isActive,
      }) as any;
      if (res.success) {
        toast.success(product.isActive ? '제품 비활성화' : '제품 활성화');
        fetchProducts();
      } else {
        toast.error(res.error ?? '변경 실패');
      }
    } catch { toast.error('변경 오류'); }
  };

  const filtered = products.filter((p) => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterFacility && !p.facilityTypes.includes(filterFacility as FacilityType)) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.modelNumber.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = (Object.keys(CATEGORY_CONFIG) as ProductCategory[]).reduce<Record<ProductCategory, Product[]>>(
    (acc, cat) => { acc[cat] = filtered.filter((p) => p.category === cat); return acc; },
    {} as Record<ProductCategory, Product[]>
  );

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>;
  }

  return (
    <div>
      {/* 헤더 툴바 */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* 카테고리 필터 칩 */}
        <div className="flex gap-2 flex-wrap flex-1">
          {(Object.keys(CATEGORY_CONFIG) as ProductCategory[]).map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const Ic = cfg.icon;
            const count = products.filter((p) => p.category === cat).length;
            return (
              <button key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition ${
                  filterCategory === cat
                    ? 'bg-cyan-900/30 border-cyan-500 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                <Ic className={`w-3.5 h-3.5 ${cfg.color}`} />
                {cfg.label}
                <span className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">{count}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => { setEditingProduct(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> 신규 등록
        </button>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="제품명 또는 모델번호 검색..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm" />
        </div>
        <div className="flex gap-1.5">
          {(['', 'building', 'factory', 'residential'] as const).map((ft) => {
            const label = ft === '' ? '전체' : FACILITY_CONFIG[ft as FacilityType].label;
            return (
              <button key={ft}
                onClick={() => setFilterFacility(ft as FacilityType | '')}
                className={`px-3 py-1.5 rounded-lg text-xs transition ${
                  filterFacility === ft ? 'bg-cyan-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                }`}
              >{label}</button>
            );
          })}
        </div>
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
          {(['active', 'all', 'inactive'] as const).map((v) => (
            <button key={v}
              onClick={() => setFilterActive(v)}
              className={`px-3 py-1 rounded text-xs transition ${filterActive === v ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {v === 'active' ? '활성' : v === 'inactive' ? '비활성' : '전체'}
            </button>
          ))}
        </div>
        <button onClick={fetchProducts} className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 빈 상태 */}
      {products.length === 0 && (
        <ProductSeedBanner onSeeded={() => { setIsLoading(true); fetchProducts(); }} />
      )}

      {/* 카테고리별 제품 목록 */}
      {(Object.keys(CATEGORY_CONFIG) as ProductCategory[]).map((cat) => {
        const items = grouped[cat];
        if (items.length === 0) return null;
        const cfg = CATEGORY_CONFIG[cat];
        const CatIcon = cfg.icon;

        return (
          <div key={cat} className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <CatIcon className={`w-5 h-5 ${cfg.color}`} />
              <h3 className="font-semibold text-slate-200">{cfg.label}</h3>
              <span className="text-xs text-slate-500">({items.length}종)</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((product) => {
                const key = product.id;
                const isExpanded = expandedId === key;
                const diffCfg = DIFFICULTY_LABELS[product.installDifficulty] ?? DIFFICULTY_LABELS.medium;

                return (
                  <div key={key} className={`bg-slate-800 rounded-xl border overflow-hidden transition ${
                    product.isActive ? 'border-slate-700' : 'border-slate-700/50 opacity-60'
                  }`}>
                    {/* 카드 헤더 */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-medium text-slate-100 text-sm leading-snug truncate">{product.name}</div>
                            {!product.isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-500 rounded flex-shrink-0">비활성</span>
                            )}
                          </div>
                          <div className="font-mono text-xs text-slate-400 mt-0.5">{product.modelNumber}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span>{product.manufacturer}</span>
                            {product.code && <span className="text-slate-600 font-mono">{product.code}</span>}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {product.unitPrice && (
                            <div className="text-sm font-semibold text-cyan-300">
                              ₩{Number(product.unitPrice).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 태그 */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {product.facilityTypes.map((ft) => {
                          const fc = FACILITY_CONFIG[ft];
                          const Fic = fc.icon;
                          return (
                            <span key={ft} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-700 ${fc.color}`}>
                              <Fic className="w-2.5 h-2.5" />{fc.label}
                            </span>
                          );
                        })}
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-slate-700 ${diffCfg?.color ?? 'text-slate-400'}`}>
                          {diffCfg?.label ?? product.installDifficulty}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                          보증 {product.warrantyMonths}개월
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{product.description}</p>
                    </div>

                    {/* 프로토콜 */}
                    <div className="px-4 pb-3">
                      <div className="flex flex-wrap gap-1">
                        {product.protocols.map((p) => (
                          <span key={p} className="text-xs bg-slate-700/50 border border-slate-600 rounded px-2 py-0.5 font-mono text-slate-300">
                            {p.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* CRUD 액션 버튼 */}
                    {deletingProductId === product.id ? (
                      <div className="mx-4 mb-3 flex items-center gap-2 bg-red-900/20 border border-red-700/50 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        <span className="text-xs text-red-300 flex-1">정말 삭제하시겠습니까?</span>
                        <button onClick={() => setDeletingProductId(null)}
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300 transition">취소</button>
                        <button onClick={() => handleDeleteConfirm(product)}
                          className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs text-white transition">삭제</button>
                      </div>
                    ) : (
                    <div className="px-4 pb-3 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs transition"
                        title="상세 보기"
                      >
                        <Info className="w-3 h-3" /> 상세
                      </button>
                      <button
                        onClick={() => { setEditingProduct(product); setShowModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs transition"
                      >
                        <Edit2 className="w-3 h-3" /> 수정
                      </button>
                      <button
                        onClick={() => handleToggleActive(product)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${
                          product.isActive
                            ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                            : 'bg-cyan-900/40 hover:bg-cyan-900/60 text-cyan-400'
                        }`}
                      >
                        {product.isActive
                          ? <><ToggleRight className="w-3.5 h-3.5 text-cyan-400" /> 활성</>
                          : <><ToggleLeft  className="w-3.5 h-3.5 text-slate-500" /> 비활성</>}
                      </button>
                      <button
                        onClick={() => setDeletingProductId(product.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-xs transition ml-auto"
                      >
                        <Trash2 className="w-3 h-3" /> 삭제
                      </button>
                    </div>
                    )}

                    {/* 스펙 확장 */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : key)}
                      className="w-full flex items-center justify-between px-4 py-2.5 border-t border-slate-700 text-xs text-slate-400 hover:bg-slate-700/30 transition"
                    >
                      <span>상세 스펙</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-700/50">
                        {Object.keys(product.specs).length === 0 ? (
                          <p className="text-xs text-slate-600 mt-2">스펙 정보 없음</p>
                        ) : (
                          <table className="w-full text-xs mt-2">
                            <tbody>
                              {Object.entries(product.specs).map(([k, v]) => (
                                <tr key={k} className="border-b border-slate-700/30">
                                  <td className="py-1.5 pr-3 text-slate-400 font-medium w-1/3">{k}</td>
                                  <td className="py-1.5 text-slate-200">{v}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 제품 등록/수정 모달 */}
      {showModal && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => { setShowModal(false); setEditingProduct(null); }}
          onSaved={() => { fetchProducts(); setShowModal(false); setEditingProduct(null); }}
        />
      )}

      {/* 제품 상세 패널 */}
      {selectedProduct && (
        <ProductDetailPanel
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onEdit={() => { setEditingProduct(selectedProduct); setShowModal(true); setSelectedProduct(null); }}
        />
      )}
    </div>
  );
}

// ─── 제품 상세 패널 ───────────────────────────────────────────────

function ProductDetailPanel({
  product,
  onClose,
  onEdit,
}: {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
}) {
  const catCfg = CATEGORY_CONFIG[product.category];
  const CatIcon = catCfg?.icon ?? Box;
  const diffCfg = DIFFICULTY_LABELS[product.installDifficulty] ?? DIFFICULTY_LABELS.medium;

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-start justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-md bg-slate-800 border-l border-slate-700 overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-5 py-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-700/60 flex-shrink-0 mt-0.5">
              <CatIcon className={`w-5 h-5 ${catCfg?.color ?? 'text-gray-400'}`} />
            </div>
            <div>
              <div className="font-semibold text-slate-100 leading-snug">{product.name}</div>
              <div className="font-mono text-xs text-slate-400 mt-0.5">{product.modelNumber}</div>
              {product.code && <div className="text-[10px] text-slate-600 font-mono">{product.code}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-xs transition">
              <Edit2 className="w-3 h-3" /> 수정
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* 이미지 */}
          {product.imageUrl && (
            <div className="rounded-lg overflow-hidden bg-slate-700/50 flex items-center justify-center h-40">
              <img src={product.imageUrl} alt={product.name} className="max-h-40 object-contain" />
            </div>
          )}

          {/* 기본 정보 */}
          <div className="bg-slate-700/40 rounded-lg p-4 space-y-2.5 text-sm">
            {[
              { label: '제조사',    value: product.manufacturer },
              { label: '카테고리', value: catCfg?.label ?? product.category },
              { label: '설치 난이도', value: <span className={diffCfg?.color}>{diffCfg?.label}</span> },
              { label: '보증 기간', value: `${product.warrantyMonths}개월` },
              { label: '단가',      value: product.unitPrice ? `₩${Number(product.unitPrice).toLocaleString()}` : '—' },
              { label: '상태',      value: product.isActive ? <span className="text-emerald-400">활성</span> : <span className="text-slate-500">비활성</span> },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span className="text-slate-400 text-xs flex-shrink-0">{label}</span>
                <span className="text-slate-200 text-right text-xs">{value}</span>
              </div>
            ))}
          </div>

          {/* 적용 시설 */}
          <div>
            <div className="text-xs text-slate-400 mb-2">적용 시설</div>
            <div className="flex flex-wrap gap-2">
              {product.facilityTypes.map((ft) => {
                const fc = FACILITY_CONFIG[ft];
                const Fic = fc?.icon ?? Building2;
                return (
                  <span key={ft} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-700 ${fc?.color ?? 'text-slate-400'}`}>
                    <Fic className="w-3 h-3" />{fc?.label ?? ft}
                  </span>
                );
              })}
            </div>
          </div>

          {/* 프로토콜 */}
          {product.protocols.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-2">지원 프로토콜</div>
              <div className="flex flex-wrap gap-1.5">
                {product.protocols.map((p) => (
                  <span key={p} className="text-xs bg-slate-700/50 border border-slate-600 rounded px-2 py-0.5 font-mono text-slate-300">
                    {p.replace(/_/g, ' ').toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 설명 */}
          {product.description && (
            <div>
              <div className="text-xs text-slate-400 mb-2">제품 설명</div>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-700/30 rounded-lg p-3">{product.description}</p>
            </div>
          )}

          {/* 상세 스펙 */}
          {Object.keys(product.specs).length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-2">상세 스펙</div>
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(product.specs).map(([k, v]) => (
                    <tr key={k} className="border-b border-slate-700/40">
                      <td className="py-1.5 pr-3 text-slate-400 font-medium w-2/5">{k}</td>
                      <td className="py-1.5 text-slate-200">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 제품 등록/수정 모달 ──────────────────────────────────────────

function ProductFormModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!product;
  const [form, setForm] = useState({
    name:              product?.name              ?? '',
    modelNumber:       product?.modelNumber       ?? '',
    manufacturer:      product?.manufacturer      ?? '',
    category:          product?.category          ?? 'gateway' as ProductCategory,
    facilityTypes:     product?.facilityTypes     ?? [] as FacilityType[],
    unitPrice:         product?.unitPrice         ?? '',
    description:       product?.description       ?? '',
    imageUrl:          product?.imageUrl          ?? '',
    installDifficulty: product?.installDifficulty ?? 'medium',
    warrantyMonths:    product?.warrantyMonths     ?? 12,
    protocols:         product?.protocols.join(', ') ?? '',
  });
  const [specRows, setSpecRows] = useState<{ k: string; v: string }[]>(
    product ? Object.entries(product.specs).map(([k, v]) => ({ k, v })) : []
  );
  const [isSaving, setIsSaving] = useState(false);

  const toggleFacility = (ft: FacilityType) => {
    setForm((prev) => ({
      ...prev,
      facilityTypes: prev.facilityTypes.includes(ft)
        ? prev.facilityTypes.filter((f) => f !== ft)
        : [...prev.facilityTypes, ft],
    }));
  };

  const addSpecRow = () => setSpecRows((r) => [...r, { k: '', v: '' }]);
  const removeSpecRow = (idx: number) => setSpecRows((r) => r.filter((_, i) => i !== idx));
  const updateSpecRow = (idx: number, patch: { k?: string; v?: string }) =>
    setSpecRows((r) => r.map((row, i) => i === idx ? { ...row, ...patch } : row));

  const save = async () => {
    if (!form.name.trim()) { toast.error('제품명을 입력하세요'); return; }
    if (!form.modelNumber.trim()) { toast.error('모델번호를 입력하세요'); return; }
    if (!form.manufacturer.trim()) { toast.error('제조사를 입력하세요'); return; }
    if (form.facilityTypes.length === 0) { toast.error('적용 시설을 하나 이상 선택하세요'); return; }

    setIsSaving(true);
    const specs = specRows.reduce<Record<string, string>>((acc, { k, v }) => {
      if (k.trim()) acc[k.trim()] = v.trim();
      return acc;
    }, {});
    const protocols = form.protocols.split(',').map((p) => p.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);

    try {
      const payload = {
        ...form,
        unitPrice: form.unitPrice || null,
        description: form.description || null,
        imageUrl: form.imageUrl || null,
        protocols,
        specs,
        warrantyMonths: Number(form.warrantyMonths),
      };

      const res = isEdit
        ? await apiPatch(`/api/admin/equipment/products/${product.id}`, payload) as any
        : await apiPost('/api/admin/equipment/products', payload) as any;

      if (res.success) {
        toast.success(isEdit ? '제품 수정 완료' : '제품 등록 완료');
        onSaved();
      } else {
        toast.error(res.error ?? (isEdit ? '수정 실패' : '등록 실패'));
      }
    } catch { toast.error(isEdit ? '수정 오류' : '등록 오류'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            {isEdit ? <Edit2 className="w-5 h-5 text-amber-400" /> : <Plus className="w-5 h-5 text-cyan-400" />}
            {isEdit ? '제품 수정' : '신규 제품 등록'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">제품명 <span className="text-red-400">*</span></label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="EMS-GW-B1000 빌딩용 게이트웨이"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">모델번호 <span className="text-red-400">*</span></label>
              <input value={form.modelNumber} onChange={(e) => setForm({ ...form, modelNumber: e.target.value })}
                placeholder="EMS-GW-B1000"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">제조사 <span className="text-red-400">*</span></label>
              <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                placeholder="탄소이음"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">카테고리 <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_CONFIG) as ProductCategory[]).map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                const Ic = cfg.icon;
                return (
                  <button key={cat} onClick={() => setForm({ ...form, category: cat })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition ${
                      form.category === cat
                        ? 'bg-cyan-900/40 border-cyan-500 text-cyan-300'
                        : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <Ic className={`w-3.5 h-3.5 ${cfg.color}`} />{cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 적용 시설 */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">적용 시설 <span className="text-red-400">*</span> (복수 선택)</label>
            <div className="flex gap-2">
              {(Object.keys(FACILITY_CONFIG) as FacilityType[]).map((ft) => {
                const fc = FACILITY_CONFIG[ft];
                const Ic = fc.icon;
                const selected = form.facilityTypes.includes(ft);
                return (
                  <button key={ft} onClick={() => toggleFacility(ft)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg border text-xs transition ${
                      selected
                        ? 'bg-cyan-900/40 border-cyan-500 text-cyan-300'
                        : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <Ic className={`w-5 h-5 ${selected ? 'text-cyan-400' : fc.color}`} />
                    {fc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 가격·보증·난이도 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">단가 (원)</label>
              <input type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                placeholder="1500000"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">보증 기간 (개월)</label>
              <input type="number" min={1} max={120} value={form.warrantyMonths}
                onChange={(e) => setForm({ ...form, warrantyMonths: parseInt(e.target.value) || 12 })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">설치 난이도</label>
              <select value={form.installDifficulty} onChange={(e) => setForm({ ...form, installDifficulty: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm">
                <option value="easy">쉬움</option>
                <option value="medium">보통</option>
                <option value="hard">어려움</option>
              </select>
            </div>
          </div>

          {/* 프로토콜 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">지원 프로토콜 (쉼표 구분)</label>
            <input value={form.protocols} onChange={(e) => setForm({ ...form, protocols: e.target.value })}
              placeholder="modbus_rtu, bacnet_ip, mqtt"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>

          {/* 설명 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">제품 설명</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2} placeholder="제품 특징 및 적용 분야..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>

          {/* 이미지 URL */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">이미지 URL</label>
            <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            {form.imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden bg-slate-700/50 flex items-center justify-center h-28">
                <img src={form.imageUrl} alt="미리보기" className="max-h-28 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>

          {/* 스펙 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400">상세 스펙</label>
              <button onClick={addSpecRow}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition">
                <Plus className="w-3.5 h-3.5" /> 스펙 추가
              </button>
            </div>
            <div className="space-y-2">
              {specRows.map((row, idx) => (
                <div key={idx} className="flex gap-2">
                  <input value={row.k} onChange={(e) => updateSpecRow(idx, { k: e.target.value })}
                    placeholder="항목 (예: 전원)" className="w-1/3 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs" />
                  <input value={row.v} onChange={(e) => updateSpecRow(idx, { v: e.target.value })}
                    placeholder="값 (예: DC 12V/2A)" className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs" />
                  <button onClick={() => removeSpecRow(idx)}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {specRows.length === 0 && (
                <div className="text-xs text-slate-600 text-center py-3 border border-dashed border-slate-700 rounded-lg">
                  스펙 항목을 추가하세요
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">취소</button>
          <button onClick={save} disabled={isSaving}
            className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition disabled:opacity-50">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isEdit ? '수정 완료' : '등록')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 탭 3: 설치 가이드
// ════════════════════════════════════════════════════════════════

function GuideTab() {
  const [selectedFacility, setSelectedFacility] = useState<FacilityType>('building');
  const [expandedStep, setExpandedStep]         = useState<number | null>(0);
  const guide = INSTALL_GUIDES[selectedFacility];

  return (
    <div>
      <div className="flex gap-3 mb-8">
        {(Object.keys(FACILITY_CONFIG) as FacilityType[]).map((ft) => {
          const fc = FACILITY_CONFIG[ft];
          const Ic = fc.icon;
          return (
            <button key={ft}
              onClick={() => { setSelectedFacility(ft); setExpandedStep(0); }}
              className={`flex-1 max-w-xs flex flex-col items-center gap-2 py-5 rounded-xl border-2 transition ${
                selectedFacility === ft ? 'bg-cyan-900/30 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'
              }`}
            >
              <Ic className={`w-8 h-8 ${selectedFacility === ft ? 'text-cyan-400' : fc.color}`} />
              <span className={`font-semibold ${selectedFacility === ft ? 'text-cyan-300' : 'text-slate-300'}`}>{fc.label}</span>
              <span className="text-xs text-slate-500">설치 가이드</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 space-y-5">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" /> 시설 개요
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">{guide.overview}</p>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" /> 필요 제품
            </h3>
            <div className="space-y-3">
              {guide.requiredProducts.map((rp, i) => {
                const cfg = CATEGORY_CONFIG[rp.category];
                const Ic = cfg?.icon ?? Box;
                return (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="p-1.5 bg-slate-700 rounded flex-shrink-0 mt-0.5">
                      <Ic className={`w-3.5 h-3.5 ${cfg?.color ?? 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="font-medium text-slate-200 text-xs leading-snug">{rp.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{rp.note}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-green-400" /> 완료 체크리스트
            </h3>
            <div className="space-y-2">
              {guide.checklist.map((item, i) => (
                <label key={i} className="flex items-start gap-2.5 cursor-pointer group">
                  <input type="checkbox" className="mt-0.5 accent-cyan-500 flex-shrink-0" />
                  <span className="text-xs text-slate-300 group-hover:text-slate-100 transition leading-relaxed">{item}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-2">
          <h3 className="font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-cyan-400" />
            단계별 설치 절차
            <span className="text-xs text-slate-500 font-normal">({guide.steps.length}단계)</span>
          </h3>
          <div className="space-y-3">
            {guide.steps.map((step, idx) => {
              const isOpen = expandedStep === idx;
              return (
                <div key={idx} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  <button
                    onClick={() => setExpandedStep(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isOpen ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400'
                      }`}>{idx + 1}</div>
                      <span className={`font-medium text-sm ${isOpen ? 'text-cyan-300' : 'text-slate-200'}`}>{step.title}</span>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-slate-700/50">
                      <p className="text-sm text-slate-300 leading-relaxed mt-3 whitespace-pre-line">{step.desc}</p>
                      {step.caution && (
                        <div className="mt-3 flex items-start gap-2 bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-300 leading-relaxed">{step.caution}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 공통 컴포넌트 ────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Package;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
      <Icon className={`w-6 h-6 ${color} mx-auto mb-2`} />
      <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}
