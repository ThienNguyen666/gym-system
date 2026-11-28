import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { buildDbOptions } from './config/db.options';

config({ path: join(__dirname, '..', '..', '..', '.env') }); // .env ở root repo
export default new DataSource(buildDbOptions(process.env));