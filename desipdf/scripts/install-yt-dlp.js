/**
 * scripts/install-yt-dlp.js
 *
 * Automatically downloads the correct yt-dlp binary for the current platform
 * and saves it to bin/yt-dlp. This runs via the "postinstall" npm hook so
 * Vercel's build environment gets the binary during `npm install`.
 *
 * On macOS dev machines where yt-dlp is already installed (e.g., via brew),
 * the script skips the download to avoid redundant work.
 */

const { execSync, execFileSync, spawnSync } = require('child_process')
const { existsSync, mkdirSync, chmodSync } = require('fs')
const { join } = require('path')
const { platform, arch } = require('os')

const ROOT    = join(__dirname, '..')
const BIN_DIR = join(ROOT, 'bin')
const BINARY  = join(BIN_DIR, 'yt-dlp')

// ── Already exists? ───────────────────────────────────────────────────────────
if (existsSync(BINARY)) {
  try {
    const ver = execFileSync(BINARY, ['--version'], { encoding: 'utf8' }).trim()
    console.log(`[postinstall] yt-dlp already at ${BINARY} (${ver}) — skip`)
  } catch {
    console.log(`[postinstall] yt-dlp binary exists at ${BINARY} — skip`)
  }
  process.exit(0)
}

// ── Windows: skip (Vercel never runs on Windows) ──────────────────────────────
const p = platform()
if (p === 'win32') {
  console.log('[postinstall] Windows — skipping yt-dlp binary download')
  process.exit(0)
}

// ── Already in PATH? (e.g. macOS brew install) ────────────────────────────────
try {
  const inPath = execFileSync('which', ['yt-dlp'], { encoding: 'utf8' }).trim()
  if (inPath) {
    console.log(`[postinstall] yt-dlp found in PATH at ${inPath} — skip download`)
    process.exit(0)
  }
} catch { /* not in PATH */ }

// ── Determine download URL ────────────────────────────────────────────────────
const a = arch()
let downloadUrl

if (p === 'linux') {
  if (a === 'arm64' || a === 'aarch64') {
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64'
  } else if (a === 'arm') {
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_armv7l'
  } else {
    // x86-64 — this is what Vercel (AWS Lambda) uses
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux'
  }
} else if (p === 'darwin') {
  downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
} else {
  console.log(`[postinstall] Platform "${p}" not supported — skipping yt-dlp download`)
  process.exit(0)
}

// ── Download ──────────────────────────────────────────────────────────────────
if (!existsSync(BIN_DIR)) {
  mkdirSync(BIN_DIR, { recursive: true })
}

console.log(`[postinstall] Downloading yt-dlp for ${p}/${a}…`)
console.log(`[postinstall]   → ${downloadUrl}`)
console.log(`[postinstall]   → ${BINARY}`)

try {
  // Try curl first (available in most Linux environments + macOS)
  const curlResult = spawnSync('curl', ['-L', '--progress-bar', downloadUrl, '-o', BINARY], {
    stdio: 'inherit',
    timeout: 120000,
  })

  if (curlResult.status !== 0) {
    // Fallback: try wget
    const wgetResult = spawnSync('wget', ['-q', '--show-progress', downloadUrl, '-O', BINARY], {
      stdio: 'inherit',
      timeout: 120000,
    })
    if (wgetResult.status !== 0) throw new Error('Both curl and wget failed')
  }

  chmodSync(BINARY, 0o755)

  // Verify it actually runs
  const version = execFileSync(BINARY, ['--version'], { encoding: 'utf8', timeout: 10000 }).trim()
  console.log(`[postinstall] ✅ yt-dlp ${version} installed at ${BINARY}`)
} catch (err) {
  console.error(`[postinstall] ⚠️  Could not install yt-dlp: ${err.message}`)
  console.error('[postinstall]    The app will fall back to legacy scrapers for social platforms.')
  // Don't exit(1) — don't fail the entire build
  process.exit(0)
}
