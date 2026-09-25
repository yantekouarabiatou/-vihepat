import "dotenv/config";

import cors from "cors";
import express from "express";

import { database } from "./db";

const app = express();
const port = Number(process.env.API_PORT ?? 3001);

app.use(cors({ origin: process.env.CLIENT_URL ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", async (_request, response) => {
  try {
    await database.query("SELECT 1");
    response.json({ api: "ok", database: "ok" });
  } catch (error) {
    console.error("MySQL health check failed", error);
    response.status(503).json({ api: "ok", database: "unavailable" });
  }
});

app.listen(port, () => {
  console.log(`API Express démarrée sur http://localhost:${port}`);
});
