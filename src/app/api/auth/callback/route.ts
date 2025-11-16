import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.redirect(new URL('/', process.env.APP_BASE_URL || 'http://localhost:3000'));
}
