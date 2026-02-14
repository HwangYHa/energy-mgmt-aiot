const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const groups = await p.menuGroup.findMany({
    include: {
      menuItems: {
        select: { id: true, code: true, name: true, path: true, displayOrder: true },
        orderBy: { displayOrder: 'asc' }
      }
    },
    orderBy: { displayOrder: 'asc' }
  });

  for (const g of groups) {
    console.log(`\n[${g.code}] ${g.name} (order:${g.displayOrder})`);
    for (const item of g.menuItems) {
      console.log(`  - ${item.code}: ${item.name} -> ${item.path} (order:${item.displayOrder})`);
    }
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
