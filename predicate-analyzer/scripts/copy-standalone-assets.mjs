import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const standaloneRoot = join(projectRoot, ".next", "standalone");
const staticSource = join(projectRoot, ".next", "static");
const publicSource = join(projectRoot, "public");

function findServerDirectory(root) {
  if (!existsSync(root)) {
    return null;
  }

  const entries = readdirSync(root, { withFileTypes: true });
  const hasServerFile = entries.some((entry) => entry.isFile() && entry.name === "server.js");
  const hasPackageFile = entries.some((entry) => entry.isFile() && entry.name === "package.json");

  if (hasServerFile && hasPackageFile && root.endsWith("/predicate-analyzer")) {
    return root;
  }

  for (const entry of entries) {
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = findServerDirectory(entryPath);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function copyIfPresent(source, destination) {
  if (!existsSync(source)) {
    return false;
  }

  const stats = statSync(source);
  if (!stats.isDirectory()) {
    return false;
  }

  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true });
  return true;
}

const serverDirectory = findServerDirectory(standaloneRoot);

if (!serverDirectory) {
  console.warn("[copy-standalone-assets] No standalone server.js found. Skipping asset copy.");
  process.exit(0);
}

const nextDestination = join(serverDirectory, ".next", "static");
const publicDestination = join(serverDirectory, "public");

const copiedStatic = copyIfPresent(staticSource, nextDestination);
const copiedPublic = copyIfPresent(publicSource, publicDestination);

console.log(
  `[copy-standalone-assets] server=${serverDirectory} static=${copiedStatic ? "copied" : "skipped"} public=${copiedPublic ? "copied" : "skipped"}`,
);
