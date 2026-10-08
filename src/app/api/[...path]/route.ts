import { createApp } from '@/server/app';
import { getRepository } from '@/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const api = createApp(getRepository);

export async function GET(request: Request): Promise<Response> {
    return api.request(request);
}
