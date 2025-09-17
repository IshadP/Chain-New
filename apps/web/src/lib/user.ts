import { currentUser } from '@clerk/nextjs/server'

export async function getUserRole(userId: string): Promise<string> {
  try {
    const user = await currentUser()
    if (!user) return 'Retailer' // Default fallback
    
    const role = user.publicMetadata?.role as string
    return role || 'Retailer' // Default fallback
  } catch (error) {
    console.error('Error getting user role:', error)
    return 'Retailer' // Default fallback
  }
}

export async function getUserAddress(userId: string): Promise<string | null> {
  try {
    const user = await currentUser()
    if (!user) return null
    
    const role = user.publicMetadata?.role as string
    
    // Map roles to development addresses
    const addresses = {
      'Manufacturer': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      'Distributor': '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      'Retailer': '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    }
    
    return addresses[role as keyof typeof addresses] || null
  } catch (error) {
    console.error('Error getting user address:', error)
    return null
  }
}