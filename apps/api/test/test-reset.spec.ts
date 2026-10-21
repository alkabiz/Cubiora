import { resetTestDatabase } from './test-reset.helper';
import { PrismaClient } from '../src/generated/prisma/client';

describe('Salvaguardas de resetTestDatabase', () => {
  const dummyPrisma = {} as unknown as PrismaClient;

  it('debe negarse si NODE_ENV no es test', async () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      await expect(
        resetTestDatabase(dummyPrisma, 'postgresql://cubiora_app:pass@localhost:5432/cubiora_db_test'),
      ).rejects.toThrow(/FATAL_TEST_RESET_VIOLATION.*NODE_ENV=test/);
    } finally {
      process.env['NODE_ENV'] = originalEnv;
    }
  });

  it('debe negarse si la base de datos no termina en _test', async () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'test';
    try {
      await expect(
        resetTestDatabase(dummyPrisma, 'postgresql://cubiora_app:pass@localhost:5432/cubiora_prod'),
      ).rejects.toThrow(/FATAL_TEST_RESET_VIOLATION.*_test/);
    } finally {
      process.env['NODE_ENV'] = originalEnv;
    }
  });
});
