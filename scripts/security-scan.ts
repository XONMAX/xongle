import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.firebase']);
const ALLOWED_PUBLIC_CONFIG_FILES = new Set(['firebase-applet-config.json']);

const SECRET_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'RSA / Private Key Block', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Firebase Admin SDK Private Key', regex: /"private_key"\s*:\s*"-----BEGIN/ },
  { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Slack / GitHub Personal Token', regex: /\b(xox[baprs]-[0-9a-zA-Z-]+|ghp_[0-9a-zA-Z]{36})\b/ },
  { name: 'Google API Key in Source Code', regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
];

const UNSAFE_CODE_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'React dangerouslySetInnerHTML', regex: /dangerouslySetInnerHTML/ },
  { name: 'Direct eval() Execution', regex: /\beval\s*\(/ },
];

function walkFiles(dir: string, acc: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
    } else if (entry.isFile()) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function runSecurityScan(): void {
  const findings: string[] = [];
  const allFiles = walkFiles(ROOT_DIR);

  for (const filePath of allFiles) {
    const relPath = path.relative(ROOT_DIR, filePath);
    const baseName = path.basename(filePath);
    if (relPath === 'scripts/security-scan.ts' || relPath === 'tests/security.test.ts') continue;
    if (!/\.(ts|tsx|js|jsx|json|rules|env|yml|yaml|md)$/i.test(baseName)) continue;

    const content = fs.readFileSync(filePath, 'utf8');

    for (const secret of SECRET_PATTERNS) {
      if (secret.name === 'Google API Key in Source Code' && ALLOWED_PUBLIC_CONFIG_FILES.has(baseName)) {
        continue; // Intentionally public Firebase Web SDK config
      }
      if (secret.regex.test(content)) {
        findings.push(`[SECRET] ${secret.name} detected in ${relPath}`);
      }
    }

    if (relPath.startsWith('src/')) {
      for (const unsafe of UNSAFE_CODE_PATTERNS) {
        if (unsafe.regex.test(content)) {
          findings.push(`[UNSAFE_CODE] ${unsafe.name} detected in ${relPath}`);
        }
      }
      if (/process\.env\.GEMINI_API_KEY/.test(content)) {
        findings.push(`[LEAKED_ENV] Server-only GEMINI_API_KEY referenced in client file ${relPath}`);
      }
    }
  }

  // Verify Firestore & Storage Rules do not contain `allow read, write: if true`
  for (const rulesFile of ['firestore.rules', 'storage.rules']) {
    const p = path.join(ROOT_DIR, rulesFile);
    if (fs.existsSync(p)) {
      const rulesContent = fs.readFileSync(p, 'utf8');
      if (/allow\s+read\s*,\s*write\s*:\s*if\s+true\s*;/.test(rulesContent)) {
        findings.push(`[OPEN_RLS] Unrestricted 'allow read, write: if true;' found in ${rulesFile}`);
      }
    } else {
      findings.push(`[MISSING_RLS] ${rulesFile} is missing`);
    }
  }

  if (findings.length > 0) {
    console.error('❌ Security Scan Failed with findings:');
    for (const f of findings) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }

  console.log(`✅ Security Scan Passed: Audited ${allFiles.length} files with 0 secret leaks or RLS violations.`);
}

runSecurityScan();
