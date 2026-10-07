import { Pool } from 'pg';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const password =
      process.env.SQL_DB_PASSWORD ||
      (process.env.SQL_PASSWORD && !process.env.SQL_PASSWORD.includes('$')
        ? process.env.SQL_PASSWORD
        : 'AegisPass_2026!');

    global._postgresPool = new Pool({
      host: process.env.SQL_HOST || '/app/cloudsql/gen-lang-client-0788601820:us-west1:ai-studio-7bb370a1',
      user: process.env.SQL_USER || 'ai_studio_app_user',
      password,
      database: process.env.SQL_DB_NAME || 'cloud_sql_development_database',
      max: 15,
      idleTimeoutMillis: 30000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();
