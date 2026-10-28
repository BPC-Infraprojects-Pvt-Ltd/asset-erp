import 'dotenv/config';
import { open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import {
  seedDevelopmentData,
  validateSeedTarget,
} from '../dist/development/seed-data.js';

validateSeedTarget(process.env);
const credentialsPath = resolve(
  process.env.SEED_CREDENTIALS_FILE || '.seed-credentials.json',
);
const credentialsFile = await open(credentialsPath, 'wx', 0o600);
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
let committed = false;
try {
  const credentials = await seedDevelopmentData(prisma);
  committed = true;
  await credentialsFile.writeFile(`${JSON.stringify(credentials, null, 2)}\n`);
  process.stdout.write(
    `Example data created. Credentials saved privately to ${credentialsPath}.\nChange each temporary password at first sign-in. Do not use this data in production.\n`,
  );
} finally {
  await credentialsFile.close();
  if (!committed) await unlink(credentialsPath);
  await prisma.$disconnect();
}
