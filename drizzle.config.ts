import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.MYSQL_URL ?? "mysql://root@localhost:3306/exact_screenshot",
  },
});
