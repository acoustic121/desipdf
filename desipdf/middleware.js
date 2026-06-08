import { NextResponse } from 'next/server';

// List of known bad user agents, scrapers, and headless automation tools
const BANNED_USER_AGENTS = [
  'python-requests',
  'axios',
  'curl',
  'wget',
  'go-http-client',
  'headlesschrome',
  'puppeteer',
  'playwright',
  'selenium',
  'scanner',
  'sqlmap',
];

// List of path segments commonly checked by vulnerability scanners
const EXPLOIT_PATHS = [
  'wp-admin',
  'wp-login',
  '.env',
  '.git',
  'xmlrpc.php',
  'phpmyadmin',
  'setup.php',
  'config.php',
];

export function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const url = request.nextUrl.pathname.toLowerCase();

  // 1. Block requests from known scrapers or headless automation user-agents
  const isBadAgent = BANNED_USER_AGENTS.some(agent => 
    userAgent.toLowerCase().includes(agent)
  );
  if (isBadAgent) {
    return new NextResponse('Access Denied', { status: 403 });
  }

  // 2. Short-circuit vulnerability scans targeting common web application exploits
  const isExploitPath = EXPLOIT_PATHS.some(path => url.includes(path));
  if (isExploitPath) {
    return new NextResponse('Not Found', { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * 1. /_next/static (static files)
     * 2. /_next/image (image optimization files)
     * 3. /favicon.ico (favicon file)
     * 4. /sitemap.xml (sitemap file)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml).*)',
  ],
};
