import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createInventoryItem } from '@/lib/dataservice';

/**
 * API route to create a new inventory item (batch).
 * This route is secure and follows the "Wallet-Centric" model.
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate the user and get their session claims using the recommended `auth()` helper.
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // 2. Security Check 1: Verify the user's role from their session metadata.
    //    Only users with the 'manufacturer' role are allowed to create batches.
    const userRole = sessionClaims?.publicMetadata?.role;
    if (userRole !== 'manufacturer') {
        return new NextResponse(JSON.stringify({ error: 'Forbidden: Only manufacturers can create batches.' }), { status: 403 });
    }

    // 3. Security Check 2: Get the manufacturer's wallet address from their session.
    //    This prevents stale session issues and ensures the correct wallet is used.
    const manufacturerWallet = sessionClaims?.publicMetadata?.wallet_address as string;
    if (!manufacturerWallet) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden: Wallet address not found in user session. Please sign out and sign back in to refresh your session.' }), { status: 403 });
    }

    // 4. Get the descriptive, off-chain data from the request body.
    const itemData = await request.json();

    // 5. Construct the final data object to be saved.
    //    This is a critical security step: we ignore any user/wallet data sent from the client
    //    and use the authenticated session data as the single source of truth.
    const dataToSave = {
      ...itemData,
      manufacturer_id: userId, // The authenticated Clerk user ID
      manufacturer_wallet: manufacturerWallet, // The authenticated user's wallet
      current_holder_wallet: manufacturerWallet, // The creator is always the first holder
    };

    // 6. Call the dataservice function to create the item in the database.
    const newItem = await createInventoryItem(dataToSave);

    // 7. Return the newly created item with a 201 Created status.
    return NextResponse.json(newItem, { status: 201 });

  } catch (error) {
    console.error('API Error in /api/inventory/add:', error);
    
    // 8. Provide clear and specific error responses.
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    let statusCode = 500; // Default to Internal Server Error

    if (errorMessage.includes("already exists")) {
        statusCode = 409; // Conflict (e.g., duplicate batch ID)
    } else if (errorMessage.includes("is required")) {
        statusCode = 400; // Bad Request (e.g., missing essential data)
    }

    return new NextResponse(JSON.stringify({ error: errorMessage }), { status: statusCode });
  }
}

