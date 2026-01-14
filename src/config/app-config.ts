import dotenv from "dotenv";

type AppConfig = {
  cacheTtlMs: number;
};

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

export function getAppConfig(): AppConfig {
  dotenv.config();
  console.log("[app-config:getAppConfig] env loaded");

  const cacheTtlMs = parseNumber(
    process.env.CACHE_TTL_MS,
    DEFAULT_CACHE_TTL_MS,
    "cacheTtlMs",
  );

  return { cacheTtlMs };
}

function parseNumber(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (!value) {
    console.debug("[app-config:parseNumber] using default", name, fallback);
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    console.warn(
      "[app-config:parseNumber] invalid value using default",
      name,
      value,
    );
    return fallback;
  }

  return parsed;
}
