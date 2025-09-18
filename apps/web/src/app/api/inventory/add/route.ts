// FILE: apps/web/src/app/api/inventory/add/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { createInventoryItem } from '@/lib/dataservice';

export async function POST(req: NextRequest) {
  console.log("API route /api/inventory/add called");
  
  try {
    const { userId } = getAuth(req);
    console.log("User ID from auth:", userId);
    
    if (!userId) {
      console.error("No user ID found in request");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const itemData = await req.json();
    console.log("Received item data:", itemData);

    // Ensure the userId from the session matches the manufacturer_id from the body
    if (userId !== itemData.manufacturer_id) {
        console.error(`User ID mismatch: ${userId} !== ${itemData.manufacturer_id}`);
        return NextResponse.json({ error: 'User ID mismatch.' }, { status: 403 });
    }

    // Validate required fields
    const requiredFields = ['batch_id', 'product_name', 'quantity', 'current_holder_wallet', 'eway_bill_no'];
    const missingFields = requiredFields.filter(field => !itemData[field]);
    
    if (missingFields.length > 0) {
      console.error("Missing required fields:", missingFields);
      return NextResponse.json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      }, { status: 400 });
    }

    console.log("Calling createInventoryItem...");
    const newItem = await createInventoryItem(itemData);

    if (!newItem) {
      console.error("createInventoryItem returned null/undefined");
      return NextResponse.json({ error: 'Failed to create inventory item in database.' }, { status: 500 });
    }

    console.log("Successfully created inventory item:", newItem);
    return NextResponse.json({ 
      message: 'Inventory item created successfully.', 
      data: newItem 
    }, { status: 201 });

  } catch (error) {
    console.error('Error in /api/inventory/add:', error);
    
    // Provide more specific error messages
    let errorMessage = 'An unexpected server error occurred.';
    let statusCode = 500;
    
    if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = (error as Error).message;
      
      // Check for specific Supabase errors
      if (errorMessage.includes('duplicate key value')) {
        errorMessage = 'Batch ID already exists';
        statusCode = 409;
      } else if (errorMessage.includes('foreign key constraint')) {
        errorMessage = 'Invalid reference to related data';
        statusCode = 400;
      } else if (errorMessage.includes('not-null constraint')) {
        errorMessage = 'Missing required field';
        statusCode = 400;
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}