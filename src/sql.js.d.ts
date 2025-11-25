declare module 'sql.js' {
    export interface SqlJsStatic {
        Database: typeof Database;
    }

    export interface QueryExecResult {
        columns: string[];
        values: SqlValue[][];
    }

    export type SqlValue = string | number | Uint8Array | null;

    export class Database {
        constructor(data?: ArrayLike<number> | Buffer | null);
        run(sql: string, params?: SqlValue[]): void;
        exec(sql: string, params?: SqlValue[]): QueryExecResult[];
        export(): Uint8Array;
        close(): void;
    }

    export default function initSqlJs(config?: {
        locateFile?: (file: string) => string;
    }): Promise<SqlJsStatic>;
}


