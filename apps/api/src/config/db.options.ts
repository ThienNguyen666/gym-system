import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from '../entities';

export function buildDbOptions(env: Record<string, string | undefined>): DataSourceOptions {
  const port = Number(env.DB_PORT ?? 5432);
  if (!Number.isInteger(port) || port <= 0) throw new Error('DB_PORT must be a positive integer');
  return {
    type: 'postgres',
    host: env.DB_HOST ?? 'localhost',
    port,
    username: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    uuidExtension: 'pgcrypto', // dùng gen_random_uuid()
    entities: ALL_ENTITIES,
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}').replace(/\\/g, '/')],
    synchronize: false,
    extra: {
      options: '-c timezone=UTC',
    },
  };
}