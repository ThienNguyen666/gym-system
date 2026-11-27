import 'dotenv/config';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const databasePort = Number(process.env.DB_PORT ?? 5432);

if (!Number.isInteger(databasePort) || databasePort <= 0) {
  throw new Error('DB_PORT must be a positive integer');
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export default new DataSource({
  type: 'postgres',
  host: requiredEnv('DB_HOST'),
  port: databasePort,
  username: requiredEnv('DB_USER'),
  password: requiredEnv('DB_PASS'),
  database: requiredEnv('DB_NAME'),
  entities: [join(sourceDirectory, '**', '*.entity{.ts,.js}')],
  migrations: [join(sourceDirectory, 'migrations', '*{.ts,.js}')],
  synchronize: false,
});
