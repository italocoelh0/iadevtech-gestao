import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const record = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.log(record);
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => emit("debug", message, data),
  info: (message: string, data?: Record<string, unknown>) => emit("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) => emit("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) => emit("error", message, data),
};
