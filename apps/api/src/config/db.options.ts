import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

export function buildDbOptions(env: Record<string, string | undefined>): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 5432),
    username: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    uuidExtension: 'pgcrypto', // dùng gen_random_uuid(), khỏi cần uuid-ossp
    entities: [join(__dirname, '..', 'entities', '*.entity.{ts,js}')],
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    synchronize: false,
    timezone: 'Z',
  };
}