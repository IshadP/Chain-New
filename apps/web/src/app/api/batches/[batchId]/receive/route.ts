import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getContractInstance } from '@/lib/blockchain'

export async function POST(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { batchId } = params
    const body = await request.json()
    const { location } = body

    if (!location) {
        return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }

    // Mark batch as received on blockchain
    const contract = await getContractInstance()
    // 2 corresponds to DeliveredToDistributor
    const tx = await contract.updateBatchStatus(batchId, 2, location)
    await tx.wait()

    return NextResponse.json({
      success: true,
      transactionHash: tx.hash,
    })
  } catch (error) {
    console.error('Error marking batch as received:', error)
    return NextResponse.json(
      { error: 'Failed to mark batch as received' },
      { status: 500 }
    )
  }
}