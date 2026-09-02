// Patch OpenNext copyTracedFiles.js to use junction on Windows instead of symlink (EPERM fix)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const target = path.join(process.cwd(), "node_modules/@opennextjs/aws/dist/build/copyTracedFiles.js");
try {
  let t = readFileSync(target, "utf8");
  if (t.includes('symlinkSync(symlink, to);') && !t.includes('junction')) {
    t = t.replace('                symlinkSync(symlink, to);', '                symlinkSync(symlink, to, process.platform === "win32" ? "junction" : undefined);');
    writeFileSync(target, t, "utf8");
    console.log("[patch-opennext] junction patch applied");
  }
} catch (e) {
  // ignore if file not found (e.g. CI without opennext)
}
