import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { ethers } from 'ethers'
import { v4 as uuidv4 } from 'uuid'
// Make sure this import path is correct and Role is exported
import { getContractInstance, Role } from '@/lib/blockchain'
import { generateQRToken } from '@/lib/qr'
import { SupabaseService, CreateProductInput } from '@/lib/supabase'

interface CreateBatchRequest {
  name: string
  cost: number
  description?: string
  category: string
  image?: string

  internalBatchName: string
  sku: string
  quantity: number
  initialLocation: string
  distributorAddress: string
  role: Role // <-- Added role to the interface
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateBatchRequest = await request.json()
    const {
      name,
      cost,
      description,
      category,
      image,
      internalBatchName,
      sku,
      quantity,
      initialLocation,
      distributorAddress,
      role, // <-- FIX 1: Read the role from the request body
    } = body

    // New validation for the role
    if (!role || !['manufacturer', 'distributor', 'retailer'].includes(role)) {
      return NextResponse.json(
        {
          error: 'Invalid or missing role',
          details: 'A valid role (manufacturer, distributor, retailer) is required.',
        },
        { status: 400 }
      )
    }

    if (
      !name ||
      !cost ||
      !category ||
      !internalBatchName ||
      !sku ||
      !quantity ||
      !initialLocation ||
      !distributorAddress
    ) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details:
            'Please provide all required fields for both Supabase and Blockchain',
        },
        { status: 400 }
      )
    }

    if (cost <= 0 || quantity <= 0 || !Number.isInteger(quantity)) {
      return NextResponse.json(
        {
          error: 'Invalid values',
          details: 'Cost must be > 0 and quantity must be a positive integer',
        },
        { status: 400 }
      )
    }

    if (!ethers.isAddress(distributorAddress)) {
      return NextResponse.json(
        {
          error: 'Invalid distributor address',
          details:
            'Please provide a valid Ethereum address for the distributor',
        },
        { status: 400 }
      )
    }

    console.log('Creating batch with data:', {
      userId,
      name,
      cost,
      quantity,
      category,
      role, // Log the role to confirm
    })

    const batchId = uuidv4()

    const productData: CreateProductInput = {
      id: batchId,
      user_id: userId,
      name,
      cost,
      description,
      category,
      image,
      batch_id: batchId,
    }

    const product = await SupabaseService.createProduct(productData)

    if (!product || !product.id) {
      throw new Error('Failed to create product in Supabase or retrieve its ID')
    }

    console.log('Product created in Supabase:', product.id)

    try {
      // Step 2: Create Batch on the Blockchain using the UUID
      // FIX 2: Pass the role to get a signed contract instance
      const contract = await getContractInstance(role)
      console.log('Creating blockchain batch with ID:', batchId)

      const tx = await contract.createBatch(
        batchId,
        quantity,
        userId,
        internalBatchName,
        initialLocation
      )

      console.log('Blockchain transaction sent:', tx.hash)
      await tx.wait()
      console.log('Blockchain transaction confirmed')

      const token = generateQRToken(batchId)
      const baseUrl =
        process.env.NEXTJS_URL ||
        process.env.VERCEL_URL ||
        'http://localhost:3000'
      const qrUrl = `${baseUrl}/track/${batchId}?t=${token}`

      console.log('Batch creation completed successfully')

      return NextResponse.json({
        success: true,
        batchId,
        qrUrl,
        transactionHash: tx.hash,
        productId: product.id,
        message:
          'Batch created successfully in both Supabase and Blockchain',
      })
    } catch (blockchainError) {
      console.error('Blockchain error:', blockchainError)
      try {
        await SupabaseService.deleteProduct(batchId, userId)
        console.log('Cleaned up Supabase entry due to blockchain failure')
      } catch (cleanupError) {
        console.error('Failed to cleanup Supabase entry:', cleanupError)
      }
      
      const errorMessage = blockchainError instanceof Error ? blockchainError.message : 'Unknown blockchain error';
      // This is where the error you are seeing is coming from
      throw new Error(`Blockchain transaction failed: ${errorMessage}`)
    }
  } catch (error) {
    console.error('Error creating batch:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred'
    const isValidationError =
      errorMessage.includes('Missing required fields') ||
      errorMessage.includes('Invalid values') ||
      errorMessage.includes('Invalid distributor address') ||
      errorMessage.includes('Invalid or missing role')

    return NextResponse.json(
      {
        error: 'Failed to create batch',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: isValidationError ? 400 : 500 }
    )
  }
}


export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const products = await SupabaseService.getProductsByUserId(userId)

    return NextResponse.json({
      success: true,
      products,
      count: products.length,
    })
  } catch (error) {
    console.error('Error fetching batches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch batches' },
      { status: 500 }
    )
  }
}