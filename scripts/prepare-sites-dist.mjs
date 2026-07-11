import { cp, mkdir, readdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const distDir = resolve(root, "dist");
const clientDir = resolve(distDir, "client");
const serverDir = resolve(distDir, "server");
const metadataDir = resolve(distDir, ".openai");

await mkdir(clientDir, { recursive: true });
for (const entry of await readdir(distDir)) {
  if (entry === "client") continue;
  await rename(resolve(distDir, entry), resolve(clientDir, entry));
}

await mkdir(serverDir, { recursive: true });
await mkdir(metadataDir, { recursive: true });
await cp(resolve(root, ".openai", "hosting.json"), resolve(metadataDir, "hosting.json"));

const worker = `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET") return response;

    const url = new URL(request.url);
    url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url, request));
  },
};
`;

await writeFile(resolve(serverDir, "index.js"), worker, "utf8");
