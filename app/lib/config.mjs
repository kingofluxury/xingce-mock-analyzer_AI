import { fileURLToPath } from "node:url";
import path from "node:path";
import { APP_VERSION } from "../public/shared/version.js";

function moduleDir() {
  if (typeof __dirname === "string") return __dirname;
  return path.dirname(fileURLToPath(import.meta.url));
}

const APP_DIR = process.env.APP_HOME ? path.resolve(process.env.APP_HOME) : path.resolve(moduleDir(), "..");
const LIB_DIR = path.join(APP_DIR, "lib");

export { APP_DIR, LIB_DIR };
export const ROOT_DIR = path.resolve(APP_DIR, "..");
export const PUBLIC_DIR = process.env.APP_PUBLIC_DIR
  ? path.resolve(process.env.APP_PUBLIC_DIR)
  : path.join(APP_DIR, "public");
export const DATA_DIR = process.env.APP_DATA_DIR
  ? path.resolve(process.env.APP_DATA_DIR)
  : path.join(APP_DIR, "data");
export const DB_PATH = path.join(DATA_DIR, "app.db");
export const SEED_PATH = path.join(DATA_DIR, "seed.json");
export const PORT = Number(process.env.PORT) || 3210;
export const VERSION = APP_VERSION;
