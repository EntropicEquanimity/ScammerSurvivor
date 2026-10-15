// Runs scripts/check-policy.sh. On Windows a plain `bash` can be the WSL
// launcher, which may not be set up, so this asks Git where its own bash is.
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

function findBash() {
  if (process.platform !== 'win32') return 'bash';
  try {
    const gitCore = execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim();
    return join(gitCore, '..', '..', '..', 'bin', 'bash.exe');
  } catch {
    return 'bash';
  }
}

const { status, error } = spawnSync(findBash(), ['scripts/check-policy.sh'], { stdio: 'inherit' });
if (error) console.error(`Could not start bash: ${error.message}`);
process.exit(status ?? 1);
