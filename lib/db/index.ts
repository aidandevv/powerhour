import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

function resolveSslMode() {
  const configured = process.env.DATABASE_SSL?.toLowerCase();
  if (configured === "false" || configured === "disable" || configured === "disabled") {
    return false;
  }
  if (configured === "true" || configured === "require" || configured === "required") {
    return "require" as const;
  }

  const usesComposeDb = /\/\/[^/@]*@?db(?::|\/)/.test(connectionString);
  return process.env.NODE_ENV === "production" && !usesComposeDb ? ("require" as const) : false;
}

const client = postgres(connectionString, {
  ssl: resolveSslMode(),
});
export const db = drizzle(client, { schema });
