import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { serverEnv } from '@/lib/env.server';

/**
 * Signed cache-invalidation webhook called by Laravel after a publish.
 *
 * The body is verified with an HMAC before anything is revalidated, so this
 * endpoint cannot be used from the internet to force cache churn. Tags are
 * validated against a strict shape rather than passed through blindly.
 */
const TAG_PATTERN = /^[a-z0-9]+(?::[a-z0-9-]+)?$/;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = serverEnv.revalidateSecret;

  if (!secret) {
    return NextResponse.json(
      { error: { code: 'not_configured', message: 'Revalidation is not configured.' } },
      { status: 503 },
    );
  }

  const signature = request.headers.get('x-revalidate-signature');
  const body = await request.text();

  if (!signature) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Missing signature.' } },
      { status: 401 },
    );
  }

  const { createHmac } = await import('node:crypto');
  const expected = createHmac('sha256', secret).update(body).digest('hex');

  if (!timingSafeEqual(signature, expected)) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Invalid signature.' } },
      { status: 401 },
    );
  }

  let tags: unknown;

  try {
    tags = (JSON.parse(body) as { tags?: unknown }).tags;
  } catch {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Body is not valid JSON.' } },
      { status: 400 },
    );
  }

  if (!Array.isArray(tags) || tags.length === 0 || tags.length > 50) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Expected 1-50 tags.' } },
      { status: 400 },
    );
  }

  const accepted: string[] = [];

  for (const tag of tags) {
    if (typeof tag === 'string' && TAG_PATTERN.test(tag)) {
      // 'max' asks for stale-while-revalidate semantics: readers keep seeing
      // the old page while the new one is generated.
      revalidateTag(tag, 'max');
      accepted.push(tag);
    }
  }

  return NextResponse.json({ revalidated: accepted });
}
