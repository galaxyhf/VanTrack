import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createDatabase, type Database } from '@vantrack/database';
import { env } from './env';
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly connection = createDatabase(env.DATABASE_URL);
  readonly db: Database = this.connection.db;
  async onModuleDestroy() {
    await this.connection.pool.end();
  }
}
