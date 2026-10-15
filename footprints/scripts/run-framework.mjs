import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readExecutionProfile } from "./execution-profile.mjs";
import { cp, mkdir, writeFile, readFile } from "node:fs/promises";

const [command, ...args] = process.argv.slice(2);
if (!["dev", "build"].includes(command)) throw new Error("Expected dev or build.");
const managedLinux = readExecutionProfile() === "managed-linux";
// Public files are generated from the same sources used by interaction tests.
const root = new URL('../', import.meta.url);
await mkdir(new URL('public/',root), {recursive:true});
await cp(new URL('src/assets/',root),new URL('public/assets/',root),{recursive:true});
for(const file of ['style.css','app.js','editor.css','editor.js'])await cp(new URL('src/'+file,root),new URL('public/'+file,root));
const site = JSON.parse(await readFile(new URL('content/site.json',root),'utf8'));
await writeFile(new URL('public/robots.txt',root),'User-agent: *\nAllow: /\nDisallow: /write/\nDisallow: /api/admin/\nSitemap: '+site.origin+'/sitemap.xml\n');

if (managedLinux && command === "build") {
  const result = spawnSync("bash", [
    fileURLToPath(new URL("./build-verified.sh", import.meta.url)), ...args,
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Import in this process so the preview owner retains its PID and signals.
const cli = new URL(managedLinux
  ? "../node_modules/vite/bin/vite.js"
  : "../node_modules/vinext/dist/cli.js", import.meta.url);
process.argv = [process.execPath, fileURLToPath(cli), command,
  ...(!managedLinux && command === "dev" ? ["--port", "5173"] : []), ...args];
await import(cli.href);
