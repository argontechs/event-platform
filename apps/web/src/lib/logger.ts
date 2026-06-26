import pino from "pino";

/**
 * Structured app logger (pino). Logs JSON to stdout so the host/Docker can
 * collect them. Set LOG_LEVEL to control verbosity (default: info).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "web" },
});

export type Logger = typeof logger;
