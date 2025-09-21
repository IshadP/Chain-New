import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createInventoryItem } from '@/lib/dataservice';

export async function POST(request: Request) {
  try {
    // 1. Authenticate the user
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // 2. Get the Clerk client instance and fetch user data
    const clerk = await clerkClient();  // <- Call the function to get the client
    const user = await clerk.users.getUser(userId);
    
    // 3. Extract metadata with proper typing
    const userRole = user.publicMetadata.role as string;
    const manufacturerWallet = user.publicMetadata.wallet_address as string;

    console.log('Auth Debug:', {
      userId,
      userRole,
      manufacturerWallet,
      fullMetadata: user.publicMetadata
    });

    // Rest of your code remains the same...
    if (userRole !== 'manufacturer') {
      return new NextResponse(JSON.stringify({ 
        error: 'Forbidden: Only manufacturers can create batches.',
        debug: { userRole, hasMetadata: !!user.publicMetadata }
      }), { status: 403 });
    }

    if (!manufacturerWallet) {
      return new NextResponse(JSON.stringify({ 
        error: 'Forbidden: Wallet address not found in user profile.',
        debug: { 
          hasMetadata: !!user.publicMetadata,
          metadataKeys: Object.keys(user.publicMetadata)
        }
      }), { status: 403 });
    }

    const itemData = await request.json();
    const dataToSave = {
      ...itemData,
      manufacturer_id: userId,
      manufacturer_wallet: manufacturerWallet,
      current_holder_wallet: manufacturerWallet,
    };

    const newItem = await createInventoryItem(dataToSave);
    return NextResponse.json(newItem, { status: 201 });

  } catch (error) {
    console.error('Full API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    let statusCode = 500;

    if (errorMessage.includes("already exists")) {
      statusCode = 409;
    } else if (errorMessage.includes("is required")) {
      statusCode = 400;
    }

    return new NextResponse(JSON.stringify({ error: errorMessage }), { status: statusCode });
  }
}