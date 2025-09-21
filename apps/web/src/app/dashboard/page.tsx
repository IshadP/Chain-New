"use client";

import { useState, useEffect } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { useAccount } from 'wagmi';
import { getBatchesForUser } from '@/lib/dataservice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ConnectWallet } from '@/components/ConnectWallet';
import { BatchCard } from '@/components/BatchCard';

interface Batch {
  batch_id: string;
  [key: string]: any;
}

export default function DashboardPage() {
  const { user } = useUser();
  const { address, isConnected } = useAccount();
  const userRole = user?.publicMetadata?.role as string;
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      if (!isConnected || !address) {
        setBatches([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // The new, simplified data fetching logic works for all roles.
        const fetchedBatches = await getBatchesForUser(address);
        setBatches(fetchedBatches);
      } catch (error) {
        console.error("Failed to fetch batches:", error);
        setBatches([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatches();
  }, [address, isConnected]); 

  return (
    <div className="container mx-auto p-6">
      <header className="flex justify-between items-center mb-8 pb-4 border-b">
        <div>
          <h1 className="text-3xl font-bold">Supply Chain Dashboard</h1>
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
          </div>
        ) : !isConnected ? (
           <div className="text-center py-16 text-gray-500">
            <h2 className="text-2xl font-semibold">Wallet Not Connected</h2>
            <p>Please connect your wallet to view your batches.</p>
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
            <p>There are no batches currently associated with your wallet address.</p>
          </div>
        )}
      </main>
    </div>
  );
}

