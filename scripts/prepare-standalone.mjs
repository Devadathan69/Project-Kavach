import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standaloneDirectory = join(root, ".next", "standalone");

function copyIfPresent(source, destination) {
  if (!existsSync(source)) return;
  mkdirSync(standaloneDirectory, { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}

copyIfPresent(join(root, "public"), join(standaloneDirectory, "public"));
copyIfPresent(join(root, ".next", "static"), join(standaloneDirectory, ".next", "static"));
