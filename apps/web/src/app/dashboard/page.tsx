"use client"; // <-- Make this a client component to use hooks

import { useState, useEffect } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { useAccount } from 'wagmi'; // Assuming you use wagmi for wallet connection
import { getBatchesByManufacturer, getBatchesByCurrentHolder } from '@/lib/dataservice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ConnectWallet } from '@/components/ConnectWallet';
import { BatchCard } from '@/components/BatchCard';

// Define a simple type for the batch to avoid 'any' type
interface Batch {
  batch_id: string;
  [key: string]: any;
}

/**
 * The Dashboard page serves as the main view for all users.
 * It now fetches batches dynamically based on the user's role and wallet status.
 * - Manufacturers: Fetches batches associated with their user ID.
 * - Distributors/Retailers: Fetches batches associated with their connected wallet address.
 */
export default function DashboardPage() {
  const { user } = useUser();
  const { address, isConnected } = useAccount();
  const userRole = user?.publicMetadata?.role as string ?? 'Not Assigned';
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      // Wait until the user object is loaded from Clerk
      if (!user) return; 

      setIsLoading(true);
      try {
        let fetchedBatches: Batch[] = [];
        if (userRole === 'manufacturer' && user.id) {
          // Fetch batches for the manufacturer using their Clerk user ID
          fetchedBatches = await getBatchesByManufacturer(user.id);
        } else if ((userRole === 'distributor' || userRole === 'retailer') && isConnected && address) {
          // For other roles, fetch batches using their connected wallet address
          fetchedBatches = await getBatchesByCurrentHolder(address);
        }
        setBatches(fetchedBatches);
      } catch (error) {
        console.error("Failed to fetch batches:", error);
        setBatches([]); // Reset batches on error to prevent displaying stale data
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatches();
    // This effect re-runs whenever the user, role, or wallet connection status changes
  }, [user, userRole, address, isConnected]); 

  return (
    <div className="container mx-auto p-6">
      <header className="flex justify-between items-center mb-8 pb-4 border-b">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-bold">Supply Chain Dashboard</h1>
          </div>
          <p className="text-lg text-gray-600">
            Your Role: <Badge>{userRole}</Badge>
          </p>
        </div>
        <div className='flex items-center gap-4'>
            {userRole === 'manufacturer' && (
              <Button asChild>
                <Link href="/create-batch">Create New Batch</Link>
              </Button>
            )}
            <ConnectWallet />
            <UserButton />
        </div>
      </header>

      <main>
        {isLoading ? (
          <div className="text-center py-16 text-gray-500">
            <h2 className="text-2xl font-semibold">Loading Batches...</h2>
            <p>Checking for your inventory records.</p>
          </div>
        ) : batches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {batches.map((batch) => (
              <BatchCard key={batch.batch_id} batch={batch} userRole={userRole} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <h2 className="text-2xl font-semibold">No batches found.</h2>
            {userRole === 'manufacturer' && <p>You can create a new batch to get started.</p>}
            {(userRole === 'distributor' || userRole === 'retailer') && !isConnected && (
              <p>Please connect your wallet to see your batches.</p>
            )}
            {(userRole === 'distributor' || userRole === 'retailer') && isConnected && (
              <p>There are no batches currently assigned to your wallet address.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
