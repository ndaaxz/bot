import sqlite3 from "sqlite3";
import { open } from "sqlite";

// Buka koneksi database
export async function openDb() {
  return open({
    filename: "./database.db",
    driver: sqlite3.Database,
  });
}

// Inisialisasi tabel users
export async function initDb() {
    const db = await openDb();
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        jid TEXT PRIMARY KEY,
        exp INTEGER DEFAULT 0,
        money INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        \`limit\` INTEGER DEFAULT 10 -- Gunakan backtick
      )
    `);
    console.log("Database initialized.");
  }


  export async function getUser(jid) {
    const db = await openDb();
    let user = await db.get("SELECT * FROM users WHERE jid = ?", jid);
    if (!user) {
      await db.run("INSERT INTO users (jid, \`limit\`) VALUES (?, ?)", jid, 10); // Gunakan backtick
      user = await db.get("SELECT * FROM users WHERE jid = ?", jid);
    }
    return user;
  }
  
  export async function updateUser(jid, data) {
    const db = await openDb();
    await db.run(
      "UPDATE users SET exp = ?, money = ?, level = ?, \`limit\` = ? WHERE jid = ?", // Gunakan backtick
      data.exp, data.money, data.level, data.limit, jid
    );
  }