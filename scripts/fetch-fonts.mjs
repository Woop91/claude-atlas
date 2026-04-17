// Downloads Latin-subset woff2 files for our three typefaces into src/fonts/.
// Source: jsDelivr's @fontsource npm mirror (alternative URL scheme).
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const FONT_DIR = "src/fonts";
const CDN = "https://cdn.jsdelivr.net/npm/@fontsource";

const FONTS = [
  { slug: "inter", weight: "400", file: "inter-latin-400-normal.woff2" },
  { slug: "inter", weight: "500", file: "inter-latin-500-normal.woff2" },
  { slug: "inter", weight: "600", file: "inter-latin-600-normal.woff2" },
  { slug: "syne", weight: "600", file: "syne-latin-600-normal.woff2" },
  { slug: "syne", weight: "700", file: "syne-latin-700-normal.woff2" },
  { slug: "ibm-plex-mono", weight: "400", file: "ibm-plex-mono-latin-400-normal.woff2" },
  { slug: "ibm-plex-mono", weight: "500", file: "ibm-plex-mono-latin-500-normal.woff2" },
];

await mkdir(FONT_DIR, { recursive: true });

for (const f of FONTS) {
  const out = join(FONT_DIR, f.file);
  if (existsSync(out)) {
    console.log(`skip ${f.file} (exists)`);
    continue;
  }
  const url = `${CDN}/${f.slug}/files/${f.file}`;
  process.stdout.write(`fetching ${f.file} ... `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(out, buf);
  console.log(`${buf.length} bytes`);
}
console.log("done");
