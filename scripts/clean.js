import { rmSync } from "fs";
import { join } from "path";

const __dirname = import.meta.dirname;

rmSync(join(__dirname, "..", "dist"), {
  recursive: true,
  force: true,
});
