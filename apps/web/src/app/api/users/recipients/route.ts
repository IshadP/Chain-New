// FILE: apps/web/src/app/api/users/recipients/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPotentialRecipients } from '@/lib/dataservice';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const recipients = await getPotentialRecipients(userId);
    return NextResponse.json(recipients);
  } catch (error) {
    console.error("API Error fetching recipients:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}