// FILE: apps/web/src/app/api/inventory/add/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { createInventoryItem } from '@/lib/dataservice'; // <-- Use the dataservice

export async function POST(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const itemData = await req.json();

    // Ensure the userId from the session matches the manufacturer_id from the body
    if (userId !== itemData.manufacturer_id) {
        return NextResponse.json({ error: 'User ID mismatch.' }, { status: 403 });
    }

    const newItem = await createInventoryItem(itemData);

    if (!newItem) {
      return NextResponse.json({ error: 'Failed to create inventory item in database.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Inventory item created successfully.', data: newItem }, { status: 201 });
  } catch (error) {
    console.error('Error in /api/inventory/add:', error);
    return NextResponse.json({ error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}