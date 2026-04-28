import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('..', import.meta.url));

const exts = new Set(['.ts', '.js', '.mjs', '.cjs', '.json', '.html', '.css', '.md', '.yaml', '.yml']);

const skipDirs = new Set(['node_modules', '.git', 'dist', 'blog-site', 'consumer-prices-core', 'pro-test']);
const skipRels = new Set(['src/generated']);

const replacements = [
  ['Meridian - Real-Time Finance Dashboard', 'Meridian - Real-Time Finance Dashboard'],
  ['Meridian - Finance', 'Meridian - Finance'],
  ['Meridian', 'Meridian'],
  ['meridian', 'meridian'],
  ['meridian-panels', 'meridian-panels'],
  ['meridian-monitors', 'meridian-monitors'],
  ['meridian-layers', 'meridian-layers'],
  ['meridian-disabled-feeds', 'meridian-disabled-feeds'],
  ['meridian-live-channels', 'meridian-live-channels'],
  ['meridian-active-channel', 'meridian-active-channel'],
  ['meridian-webcam-prefs', 'meridian-webcam-prefs'],
  ['meridian-map-mode', 'meridian-map-mode'],
  ['meridian-variant', 'meridian-variant'],
  ['MERIDIAN_API_KEY', 'MERIDIAN_API_KEY'],
  ['yash-sharma-dev/Meridian', 'yash-sharma-dev/Meridian'],
  ['meridian.app', 'meridian.app'],
];

let fileCount = 0;

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = relative(root, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name) || [...skipRels].some(s => rel.startsWith(s))) continue;
      walk(full);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (!exts.has(ext)) continue;
      try {
        let content = readFileSync(full, 'utf8');
        let changed = false;
        for (const [from, to] of replacements) {
          if (content.includes(from)) {
            content = content.split(from).join(to);
            changed = true;
          }
        }
        if (changed) {
          writeFileSync(full, content, 'utf8');
          fileCount++;
        }
      } catch {}
    }
  }
}

walk(root);
console.log(`Renamed in ${fileCount} files`);
