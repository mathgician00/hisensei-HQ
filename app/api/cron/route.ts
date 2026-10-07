import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { tutoringService } from '@/src/services/tutoringService';
import { audit } from '@/src/services/auth';

export const dynamic = 'force-dynamic';

/**
 * Daily job (FR-4.7): churn expired postponements, then generate slots that were waiting.
 * Call once a day from Cloud Scheduler with header:  Authorization: Bearer <CRON_SECRET>
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET || '';
  const given = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await tutoringService.runDailyJobs();
    await audit(null, 'cron_daily', result, true);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('cron error:', error);
    await audit(null, 'cron_daily', {}, false, String(error?.message ?? error).slice(0, 500));
    return NextResponse.json({ error: 'Job failed' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
