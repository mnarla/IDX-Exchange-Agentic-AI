import mysql, { type Pool } from "mysql2/promise";

let poolInstance: Pool | null = null;
let mockQueryFn: (<T>(sql: string, params?: any[]) => Promise<T[]>) | null = null;

export function getRequiredEnv(name: string): string {
  const val = process.env[name];
  if (val === undefined) {
    throw new Error(`Missing required database environment variable: ${name}`);
  }
  // For host, user, database: must not be empty string. For password: empty string is valid if defined.
  if (name !== "MYSQL_PASSWORD" && !val.trim()) {
    throw new Error(`Missing required database environment variable: ${name}`);
  }
  return val;
}

export function getPool(): Pool {
  if (!poolInstance) {
    const host = getRequiredEnv("MYSQL_HOST");
    const user = getRequiredEnv("MYSQL_USER");
    const password = getRequiredEnv("MYSQL_PASSWORD");
    const database = getRequiredEnv("MYSQL_DATABASE");

    poolInstance = mysql.createPool({
      host,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return poolInstance;
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

/**
 * For testing purposes: allows mocking DB queries without a live MySQL instance.
 */
export function setMockQuery(fn: (<T>(sql: string, params?: any[]) => Promise<T[]>) | null): void {
  mockQueryFn = fn;
}

/**
 * Generic query helper using pool.query for safe query execution with LIMIT/OFFSET parameters.
 */
export async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  if (mockQueryFn) {
    return await mockQueryFn<T>(sql, params);
  }
  const pool = getPool();
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}
