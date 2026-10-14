import { env } from 'cloudflare:workers';
import { handleRequest } from '../lib/server.mjs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return handleRequest(request, env); }
export function HEAD(request: Request) { return handleRequest(request, env); }
