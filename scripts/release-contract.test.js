import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tauriConfig = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const cargoToml = readFileSync('src-tauri/Cargo.toml', 'utf8');
const gitignore = readFileSync('.gitignore', 'utf8');

describe('open source release contract', () => {
  it('keeps the first public version synchronized', () => {
    expect(packageJson.version).toBe('1.0.0');
    expect(tauriConfig.version).toBe(packageJson.version);
    expect(cargoToml).toContain(`version = "${packageJson.version}"`);
  });

  it('excludes generated and private local data', () => {
    expect(gitignore).toContain('test-data/');
    expect(gitignore).toContain('**/vault.json');
    expect(gitignore).toContain('*.exe');
  });

  it('ships complete public documentation with fictional-data screenshots', () => {
    const requiredFiles = [
      'README.md',
      'LICENSE',
      'CONTRIBUTING.md',
      'SECURITY.md',
      'CHANGELOG.md',
      'docs/assets/vault-list.png',
      'docs/assets/vault-card.png',
      'docs/assets/settings-themes.png',
      'docs/assets/entry-editor.png',
    ];

    for (const path of requiredFiles) {
      expect(existsSync(path), `${path} should exist`).toBe(true);
    }

    const readme = readFileSync('README.md', 'utf8');
    const license = readFileSync('LICENSE', 'utf8');
    expect(license).toContain('MIT License');
    expect(readme).toContain('未签名');
    for (const image of requiredFiles.filter((path) => path.endsWith('.png'))) {
      expect(readme).toContain(image);
    }
  });

  it('defines CI and a four-target draft-then-publish release pipeline', () => {
    const ciPath = '.github/workflows/ci.yml';
    const releasePath = '.github/workflows/release.yml';
    expect(existsSync(ciPath), `${ciPath} should exist`).toBe(true);
    expect(existsSync(releasePath), `${releasePath} should exist`).toBe(true);

    const ci = readFileSync(ciPath, 'utf8');
    for (const command of ['npm ci', 'npm test', 'npm run build', 'cargo test']) {
      expect(ci).toContain(command);
    }

    const release = readFileSync(releasePath, 'utf8');
    for (const target of ['windows-latest', 'ubuntu-22.04', 'aarch64-apple-darwin', 'x86_64-apple-darwin']) {
      expect(release).toContain(target);
    }
    for (const bundles of ['--bundles nsis,msi', '--bundles appimage,deb', '--bundles dmg']) {
      expect(release).toContain(bundles);
    }
    expect(release).toContain('contents: write');
    expect(release).toContain('releaseDraft: true');
    expect(release).toContain('publish-release:');
  });
});
