import { type Pool } from "mysql2/promise";
export declare function getRequiredEnv(name: string): string;
export declare function getPool(): Pool;
export declare function closePool(): Promise<void>;
/**
 * For testing purposes: allows mocking DB queries without a live MySQL instance.
 */
export declare function setMockQuery(fn: (<T>(sql: string, params?: any[]) => Promise<T[]>) | null): void;
/**
 * Generic query helper using pool.query for safe query execution with LIMIT/OFFSET parameters.
 */
export declare function query<T>(sql: string, params?: any[]): Promise<T[]>;
