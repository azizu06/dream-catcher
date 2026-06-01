import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import helmet from "helmet";
import { initDatabase } from "./config/database-init.js";
import pool from "./config/database.js";
import dreamsRouter from "./routes/dreams.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set("trust proxy", 1);

// Add securiy headers
if (process.env.NODE_ENV === "production") {
  app.use(helmet());
}

const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "16kb" }));
app.use(express.static(join(__dirname, "public")));

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      db: "connected",
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      db: "disconnected",
      message: err.message,
      uptime: process.uptime(),
    });
  }
});

app.get("/shutdown", (req, res) => {
  console.log("=== MANUAL SHUTDOWN TRIGGERED ===");
  res.send("Shutting down...");

  setTimeout(() => {
    process.kill(process.pid, "SIGTERM");
  }, 100);
});

// API Routes
app.use("/api/dreams", dreamsRouter);

let server;

initDatabase()
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });

process.on("SIGTERM", gracefulShutdown);

async function gracefulShutdown() {
  console.log("SIGTERM received, shutting down gracefully");
  // Close the server first (stop accepting new connections)
  server.close(() => {
    console.log("HTTP server closed");
  });
  // Then close database pool
  try {
    await pool.end();
    console.log("Database pool closed");
    process.exit(0);
  } catch (error) {
    console.error("Error closing database pool:", error);
    process.exit(1);
  }
}
