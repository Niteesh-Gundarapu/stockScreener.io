// backend/db/client.js
// Prisma Database Client Initialization with safe fallback when generated client is missing

let PrismaClient;
let prisma;

try {
  ({ PrismaClient } = require('@prisma/client'));
} catch (err) {
  console.warn('@prisma/client not available or not generated. Falling back to stubbed prisma.');
}

function createStubModel() {
  return new Proxy({}, {
    get(_, method) {
      return async (args) => {
        if (method === 'findMany') return [];
        if (method === 'findUnique' || method === 'findFirst') return null;
        if (method === 'create') return args && (args.data || args) || null;
        if (method === 'update') return args && (args.data || args) || null;
        if (method === 'delete') return null;
        return null;
      };
    },
  });
}

function getPrisma() {
  if (prisma) return prisma;

  if (PrismaClient) {
    try {
      prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      });

      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down gracefully...');
        await prisma.$disconnect();
        process.exit(0);
      });

      return prisma;
    } catch (e) {
      console.warn('Prisma client initialization failed, falling back to stubbed prisma.');
    }
  }

  // Fallback stub prisma to allow server to start without generated client
  prisma = {
    $connect: async () => {},
    $disconnect: async () => {},
    $transaction: async (cb) => {
      if (typeof cb === 'function') return cb();
      return [];
    },
  };

  // Provide stub models used across the codebase
  const modelNames = ['user','portfolio','order','position','trade','priceAlert'];
  modelNames.forEach((m) => { prisma[m] = createStubModel(); });

  return prisma;
}

module.exports = {
  prisma: getPrisma(),
  PrismaClient,
};
