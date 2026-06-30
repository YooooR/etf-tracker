const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const s = await prisma.statement.findMany({orderBy:{createdAt:'desc'}, take:1});
    console.log(JSON.stringify(JSON.parse(s[0].aiResult), null, 2));
}
run().finally(()=>prisma.$disconnect());
