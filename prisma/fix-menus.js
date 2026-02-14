const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 1. Remove duplicate: dashboard_realtime (keep monitoring_realtime)
  const dup = await p.menuItem.findFirst({ where: { code: 'dashboard_realtime' } });
  if (dup) {
    await p.menuItem.delete({ where: { id: dup.id } });
    console.log('Deleted duplicate: dashboard_realtime');
  } else {
    console.log('No dashboard_realtime found');
  }

  // 2. Verify
  const remaining = await p.menuItem.findFirst({ where: { code: 'monitoring_realtime' } });
  console.log('monitoring_realtime:', remaining ? `${remaining.name} -> ${remaining.path}` : 'NOT FOUND');

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
