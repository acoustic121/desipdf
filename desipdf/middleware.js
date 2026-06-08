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

function isAllowedOrigin(origin) {
  if (!origin) return true;
  
  // Allow localhost (development)
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  
  // Allow production domains
  if (origin === 'https://pdfchampion.com' || origin === 'https://www.pdfchampion.com') return true;
  
  // Allow Vercel preview/deployment branches
  if (origin.endsWith('.vercel.app')) return true;
  
  return false;
}

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

  // 3. Centralized CORS origin check for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    
    if (origin) {
      if (!isAllowedOrigin(origin)) {
        return new NextResponse('CORS Not Allowed', { status: 403 });
      }

      // Handle preflight OPTIONS requests
      if (request.method === 'OPTIONS') {
        const response = new NextResponse(null, { status: 200 });
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');
        response.headers.set('Access-Control-Max-Age', '86400');
        return response;
      }
    }
  }

  const response = NextResponse.next();
  
  // Append CORS headers to successful API requests from allowed origins
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    if (origin && isAllowedOrigin(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
  }

  return response;
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
