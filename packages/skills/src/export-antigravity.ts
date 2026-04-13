#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const SRC_DIR = path.resolve(__dirname, './antigravity_exports');
const DEST_DIR = path.join(os.homedir(), '.gemini', 'antigravity', 'skills');

async function exportSkills() {
  console.log(`Exporting Antigravity skills...`);
  console.log(`  Source: ${SRC_DIR}`);
  console.log(`  Destination: ${DEST_DIR}`);

  try {
    await fs.access(SRC_DIR);
  } catch {
    console.error('ERROR: Skill exports not found. Run `cd packages/skills && npm run index` first.');
    process.exit(1);
  }

  await fs.mkdir(DEST_DIR, { recursive: true });

  const skills = await fs.readdir(SRC_DIR);
  let count = 0;

  for (const skill of skills) {
    const src = path.join(SRC_DIR, skill);
    const dest = path.join(DEST_DIR, skill);
    const stat = await fs.stat(src);

    if (stat.isDirectory()) {
      await fs.mkdir(dest, { recursive: true });
      const files = await fs.readdir(src);
      for (const file of files) {
        await fs.copyFile(path.join(src, file), path.join(dest, file));
      }
      count++;
    }
  }

  console.log(`✅ Exported ${count} skills to ${DEST_DIR}`);
}

exportSkills().catch(e => {
  console.error('Export failed:', e);
  process.exit(1);
});
