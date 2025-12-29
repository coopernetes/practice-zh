import { rmSync } from "fs";
import { join } from "path";

const __dirname = import.meta.dirname;

rmSync(join(__dirname, "..", "dist"), {
  recursive: true,
  force: true,
});

rmSync(join(__dirname, "..", "practice-zh.sqlite3"));
console.log("Cleaned up dist/ and practice-zh.sqlite3");
