import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

function parseDotEnv(path = ".env") {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line
          .slice(index + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");
        return [key, value];
      }),
  );
}

const dotEnv = parseDotEnv();
const env = { ...dotEnv, ...process.env };
const errors = [];
const warnings = [];

const expectedProjectRef = env.VITE_SUPABASE_PROJECT_ID || "sleepox";
const fingerprint = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);
const isSelfHosted = /supabase\.sleepox\.com/i.test(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "");

function decodeJwtPayload(value) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

for (const name of ["SUPABASE_URL", "VITE_SUPABASE_URL"]) {
  const v = env[name];
  if (!v) errors.push(`${name} is missing`);
  else if (!/^https?:\/\//.test(v)) errors.push(`${name} must be an http(s) URL, got ${v}`);
}

const isLoopback = (v) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test((v || "").replace(/\/+$/, ""));

if (env.SUPABASE_URL && env.VITE_SUPABASE_URL && env.SUPABASE_URL !== env.VITE_SUPABASE_URL) {
  // Self-hosted setups may talk to the local API gateway server-side while the
  // browser uses the public hostname. That's valid; anything else is a mismatch.
  if (isLoopback(env.SUPABASE_URL)) {
    warnings.push(`SUPABASE_URL is a local gateway (${env.SUPABASE_URL}); browser uses ${env.VITE_SUPABASE_URL}`);
  } else {
    errors.push("SUPABASE_URL and VITE_SUPABASE_URL must be identical (or SUPABASE_URL must be a loopback gateway)");
  }
}

for (const name of ["VITE_SUPABASE_PUBLISHABLE_KEY"]) {
  if (!env[name]) errors.push(`${name} is missing`);
}

if (!env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_SECRET_KEY) {
  warnings.push("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is missing; /r/* redirects need a server-side database key at runtime");
}

const serverKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
if (serverKey) {
  const isLegacyJwt = serverKey.split(".").length === 3;
  const isNewSecretKey = serverKey.startsWith("sb_secret_");
  if (!isLegacyJwt && !isNewSecretKey) {
    warnings.push("SUPABASE_SERVICE_ROLE_KEY should be a legacy service_role JWT or a new sb_secret_ key");
  }
  if (isSelfHosted && isNewSecretKey) {
    errors.push("Self-hosted Supabase requires SUPABASE_SERVICE_ROLE_KEY to be a legacy JWT with role=service_role, not an sb_secret_ key");
  }
  if (isLegacyJwt) {
    const payload = decodeJwtPayload(serverKey);
    if (!payload) errors.push("SUPABASE_SERVICE_ROLE_KEY is not a readable JWT");
    else if (payload.role !== "service_role") {
      errors.push(`SUPABASE_SERVICE_ROLE_KEY must have role=service_role, got role=${payload.role || "missing"}`);
    }
  }
}

for (const name of ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
  const key = env[name] || "";
  const payload = decodeJwtPayload(key);
  if (payload && payload.role !== "anon") {
    errors.push(`${name} must have role=anon, got role=${payload.role || "missing"}`);
  }
}

if (
  env.SUPABASE_PUBLISHABLE_KEY &&
  env.VITE_SUPABASE_PUBLISHABLE_KEY &&
  env.SUPABASE_PUBLISHABLE_KEY !== env.VITE_SUPABASE_PUBLISHABLE_KEY
) {
  errors.push("SUPABASE_PUBLISHABLE_KEY and VITE_SUPABASE_PUBLISHABLE_KEY must be identical");
}

if (errors.length) {
  console.error("Environment verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

if (serverKey) {
  console.log(
    `Environment verification passed. Server key fingerprint=${fingerprint(serverKey)} project=${expectedProjectRef}`,
  );
} else {
  console.log("Environment verification passed.");
}
for (const warning of warnings) console.warn(`Warning: ${warning}`);
