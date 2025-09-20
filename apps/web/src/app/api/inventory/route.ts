import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getBatchesForUser, getUserIdentifierForBatches } from '@/lib/dataservice'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user details
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userRole = user.publicMetadata?.role as string ?? 'Not Assigned'
    const walletAddress = user.publicMetadata?.walletAddress as string
    const manufacturerId = user.publicMetadata?.manufacturerId as string

    // Check if user has a valid role
    if (userRole === 'Not Assigned') {
      return NextResponse.json({ 
        batches: [],
        message: 'Role not assigned. Please contact administrator.'
      })
    }

    // Get the appropriate identifier for the user's role
    const userIdentifier = getUserIdentifierForBatches(userRole, walletAddress, manufacturerId)
    
    if (!userIdentifier) {
      return NextResponse.json({ 
        batches: [],
        message: 'Missing required user information. Please complete your profile.'
      })
    }

    // Fetch batches based on user role and identifier
    const batches = await getBatchesForUser(userRole, userIdentifier)

    // Transform the data for frontend consumption
    const transformedBatches = batches.map(batch => ({
      id: batch.batch_id,
      batch_id: batch.batch_id,
      name: batch.product_name,
      product_name: batch.product_name,
      manufacturer_id: batch.manufacturer_id,
      current_holder_wallet: batch.current_holder_wallet,
      eway_bill_no: batch.eway_bill_no,
      categories: batch.categories,
      internal_batch_no: batch.internal_batch_no,
      created_at: batch.created_at,
      description: batch.description,
      cost: batch.cost,
      // Add role-based permissions
      canTransfer: ['manufacturer', 'distributor'].includes(userRole.toLowerCase()),
      canMarkReceived: ['distributor', 'retailer'].includes(userRole.toLowerCase()),
      isOwner: userRole.toLowerCase() === 'manufacturer' 
        ? batch.manufacturer_id === manufacturerId
        : batch.current_holder_wallet === walletAddress
    }))

    return NextResponse.json({ 
      batches: transformedBatches,
      userRole,
      totalCount: transformedBatches.length,
      filter: {
        role: userRole,
        identifier: userRole.toLowerCase() === 'manufacturer' ? manufacturerId : walletAddress
      }
    })

  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch inventory',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}