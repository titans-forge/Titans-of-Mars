// Copyright (c) 2026 Titans Forge LLC. Forge Game License 2.0.
// Copy release notices after Vite builds. No network access or gameplay edits.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fs.realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const dist = path.join(root, 'dist');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--check')) throw new Error('Only --check is supported');
const checkOnly = args.includes('--check');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const approved = '01c53180ca78bee80411c2d07e436014b62f7e48dd37de70c2fed72238ee57dc';
const legacy = '3780b6186f5e587b2eefdf0b828864fbf97ed9295e162a12765785c56f00f39d';
function read(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Expected a regular file: ' + file);
  return fs.readFileSync(file);
}
if (!fs.lstatSync(dist).isDirectory() || fs.lstatSync(dist).isSymbolicLink() || fs.realpathSync(dist) !== dist) {
  throw new Error('dist must be a regular project directory');
}
read(path.join(dist, 'index.html'));
const checkpoint = JSON.parse(read(path.join(root, 'LICENSING_CHECKPOINT.json')));
const pkg = JSON.parse(read(path.join(root, 'package.json')));
if (checkpoint.schema !== 'forge_game_license_checkpoint_v2' ||
    checkpoint.release_id !== 'FG2-TITANS-OF-MARS-V0.4.0-20261015' ||
    checkpoint.version !== pkg.version || checkpoint.license !== 'Forge Game License 2.0' ||
    checkpoint.license_sha256 !== approved || checkpoint.prior_grants_preserved !== true ||
    checkpoint.previous_policy_sha256 !== legacy ||
    sha(read(path.join(root, 'LICENSE_ADOPTION_SOURCE.json'))) !== checkpoint.adoption_source_sha256) {
  throw new Error('Invalid or stale release licensing checkpoint');
}
const copies = [
  ['LICENSE', 'LICENSE'],
  ['LICENSE-LEGACY-MIT.txt', 'LICENSE-LEGACY-MIT.txt'],
  ['LICENSE-LEGACY-PRE-FORGE-2.0.txt', 'LICENSE-LEGACY-PRE-FORGE-2.0.txt'],
  ['LICENSING.md', 'LICENSING.txt'],
  ['LICENSING_CHECKPOINT.json', 'LICENSING_CHECKPOINT.json'],
  ['LICENSE_ADOPTION_SOURCE.json', 'LICENSE_ADOPTION_SOURCE.json'],
  ['FORGE-LICENSING.html', 'licensing.html'],
  ['MEDIA_RIGHTS.md', 'MEDIA_RIGHTS.txt'],
  ['THIRD_PARTY_NOTICES.txt', 'THIRD_PARTY_NOTICES.txt'],
  ['docs/ACTIVITY_ART.md', 'ACTIVITY_ART.md'],
  ['docs/TERRAIN_ART.md', 'TERRAIN_ART.md'],
  ['docs/TERRAIN_PROMPTS.json', 'TERRAIN_PROMPTS.json'],
];
const prepared = copies.map(([source, target]) => {
  const bytes = read(path.join(root, source));
  const dest = path.join(dist, target);
  let exists = false;
  try {
    const stat = fs.lstatSync(dest);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe destination: ' + target);
    exists = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (source === 'LICENSE' && sha(bytes) !== approved) throw new Error('Approved policy mismatch');
  if (source.startsWith('LICENSE-LEGACY') && sha(bytes) !== legacy) throw new Error('Legacy MIT mismatch');
  if (checkOnly && (!exists || !read(dest).equals(bytes))) throw new Error('Missing or stale notice: ' + target);
  return { dest, bytes };
});
if (!checkOnly) for (const { dest, bytes } of prepared) fs.writeFileSync(dest, bytes);
console.log(`${checkOnly ? 'Verified' : 'Staged'} ${prepared.length} release notices and provenance files.`);
