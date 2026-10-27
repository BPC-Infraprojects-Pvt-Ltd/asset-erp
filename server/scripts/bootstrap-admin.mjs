import 'dotenv/config';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../src/generated/prisma/client.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured before bootstrapping');
}
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  throw new Error('Run this command from an interactive terminal');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function ask(question) {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    prompt.question(question, (answer) => {
      prompt.close();
      resolve(answer.trim());
    });
  });
}

function askSecret(question) {
  process.stdin.setEncoding('utf8');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(question);

  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          reject(new Error('Bootstrap cancelled'));
          return;
        }
        if (character === '\r' || character === '\n') {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = Array.from(value).slice(0, -1).join('');
        } else if (character >= ' ') {
          value += character;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

try {
  const organizationName = await ask('Organization name: ');
  const email = (await ask('Administrator email: ')).toLowerCase();
  const displayName = await ask('Administrator display name: ');
  const password = await askSecret('Temporary password (not echoed): ');
  const passwordConfirmation = await askSecret('Confirm temporary password: ');

  if (!organizationName || organizationName.length > 150) {
    throw new Error('Organization name must contain 1 to 150 characters');
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid administrator email address');
  }
  if (!displayName || displayName.length > 160) {
    throw new Error('Administrator name must contain 1 to 160 characters');
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error(
      'Password must be at least 8 characters and at most 72 bytes',
    );
  }
  if (password !== passwordConfirmation) {
    throw new Error('The passwords do not match');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const organizationId = randomUUID();
  await prisma.$transaction(
    async (transaction) => {
      const existingAdministrator = await transaction.user.findFirst({
        where: { role: UserRole.ADMINISTRATOR },
        select: { id: true },
      });
      if (existingAdministrator) {
        throw new Error(
          'Bootstrap is disabled because an Administrator already exists',
        );
      }

      await transaction.organization.create({
        data: { id: organizationId, name: organizationName },
      });
      await transaction.user.create({
        data: {
          organizationId,
          email,
          displayName,
          passwordHash,
          role: UserRole.ADMINISTRATOR,
          mustChangePassword: true,
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );

  process.stdout.write(
    `Administrator created for ${organizationName}.\nOrganization ID: ${organizationId}\nSign in with the temporary password and change it immediately.\n`,
  );
} finally {
  await prisma.$disconnect();
}
