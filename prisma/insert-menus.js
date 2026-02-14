const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 1. Get existing group IDs
  const monitoringGroup = await p.menuGroup.findFirst({ where: { code: 'monitoring' } });
  const controlGroup = await p.menuGroup.findFirst({ where: { code: 'control' } });

  console.log('monitoring group:', monitoringGroup?.id);
  console.log('control group:', controlGroup?.id);

  if (!monitoringGroup || !controlGroup) {
    console.error('Required menu groups not found!');
    return;
  }

  // 2. Create compliance group
  let complianceGroup = await p.menuGroup.findFirst({ where: { code: 'compliance' } });
  if (!complianceGroup) {
    complianceGroup = await p.menuGroup.create({
      data: {
        code: 'compliance',
        name: '규제/컴플라이언스',
        icon: 'Shield',
        displayOrder: 55,
        level: 1,
        minRole: 'site_manager',
        isVisible: true,
        subscriptionRequired: true,
        isActive: true,
      }
    });
    console.log('Created compliance group:', complianceGroup.id);
  } else {
    console.log('Compliance group already exists:', complianceGroup.id);
  }

  // 3. Upsert menu items
  const items = [
    {
      code: 'monitoring_realtime',
      name: '실시간 모니터링',
      path: '/dashboard/realtime',
      icon: 'Activity',
      displayOrder: 5,
      minRole: 'viewer',
      menuGroupId: monitoringGroup.id,
    },
    {
      code: 'control_schedule',
      name: '스케줄 제어',
      path: '/control/schedule',
      icon: 'Calendar',
      displayOrder: 15,
      minRole: 'operator',
      menuGroupId: controlGroup.id,
    },
    {
      code: 'compliance_audit',
      name: '감사 추적',
      path: '/compliance/audit-trail',
      icon: 'FileText',
      displayOrder: 10,
      minRole: 'site_manager',
      menuGroupId: complianceGroup.id,
    },
    {
      code: 'compliance_emission_factors',
      name: '배출계수 관리',
      path: '/compliance/emission-factors',
      icon: 'Leaf',
      displayOrder: 20,
      minRole: 'site_manager',
      menuGroupId: complianceGroup.id,
    },
    {
      code: 'compliance_reports',
      name: '규제 리포트',
      path: '/compliance/reports',
      icon: 'ClipboardList',
      displayOrder: 30,
      minRole: 'site_manager',
      menuGroupId: complianceGroup.id,
    },
  ];

  for (const item of items) {
    const existing = await p.menuItem.findFirst({ where: { code: item.code } });
    if (existing) {
      await p.menuItem.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          path: item.path,
          icon: item.icon,
          isVisible: true,
        }
      });
      console.log(`Updated: ${item.code}`);
    } else {
      await p.menuItem.create({
        data: {
          ...item,
          level: 1,
          isVisible: true,
          subscriptionRequired: true,
          badgeType: 'none',
        }
      });
      console.log(`Created: ${item.code}`);
    }
  }

  // Verify
  const allNew = await p.menuItem.findMany({
    where: { code: { in: items.map(i => i.code) } },
    select: { code: true, name: true, path: true }
  });
  console.log('\n=== Registered Menu Items ===');
  console.log(JSON.stringify(allNew, null, 2));

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
