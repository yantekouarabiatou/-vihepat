import "dotenv/config";

import mysql from "mysql2/promise";

export const database = mysql.createPool({
  uri: process.env.MYSQL_URL ?? "mysql://root@localhost:3306/exact_screenshot",
  connectionLimit: 10,
  waitForConnections: true,
});
