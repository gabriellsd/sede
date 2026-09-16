#!/usr/bin/env node
/**
 * Aplica sql/schema.sql e valida a conexão.
 * Uso: node --env-file=.env.local scripts/db-setup.mjs
 *   ou: MYSQL_HOST=... MYSQL_USER=... MYSQL_PASSWORD=... MYSQL_DATABASE=sede node scripts/db-setup.mjs
 */
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const host = process.env.MYSQL_HOST || "127.0.0.1";
const port = Number(process.env.MYSQL_PORT || 3306);
const user = process.env.MYSQL_USER || "root";
const password = process.env.MYSQL_PASSWORD || "";
const database = process.env.MYSQL_DATABASE || "sede";

const schemaPath = path.join(root, "sql", "schema.sql");
const sql = fs.readFileSync(schemaPath, "utf8");

async function main() {
  console.log(`Conectando em ${user}@${host}:${port} …`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });
  try {
    await conn.query(sql);
    await conn.changeUser({ database });
    const [rows] = await conn.query("SHOW TABLES");
    console.log(`OK — banco "${database}" pronto. Tabelas:`, rows.map((r) => Object.values(r)[0]).join(", "));
    console.log("Na primeira subida do app, os dados demo serão inseridos automaticamente.");
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error("Falha no setup do MySQL:", error.message || error);
  process.exit(1);
});
