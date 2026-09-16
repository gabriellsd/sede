import mysql, { type Pool, type PoolOptions, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

const globalDb = globalThis as typeof globalThis & { __sedeMysql?: Pool };

export function mysqlConfigured() {
  return Boolean(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE);
}

export function getMysqlConfig(): DbConfig {
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "sede",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "sede",
  };
}

export function getPool() {
  if (!mysqlConfigured()) {
    throw new Error("MySQL não configurado. Defina MYSQL_HOST, MYSQL_USER e MYSQL_DATABASE.");
  }
  if (!globalDb.__sedeMysql) {
    const config = getMysqlConfig();
    const options: PoolOptions = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 10),
      namedPlaceholders: true,
      timezone: "Z",
      charset: "utf8mb4",
    };
    globalDb.__sedeMysql = mysql.createPool(options);
  }
  return globalDb.__sedeMysql;
}

export type { ResultSetHeader, RowDataPacket };
