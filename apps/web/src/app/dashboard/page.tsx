// FILE: apps/web/src/app/dashboard/page.tsx

import { currentUser } from '@clerk/nextjs/server';
import { getAllBatches } from '@/lib/dataservice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ConnectWallet } from '@/components/ConnectWallet';
import { BatchCard } from '@/components/BatchCard'; // <-- Using the new BatchCard

/**
 * The Dashboard page now serves as the main view for all users.
 * It fetches the initial list of batches from Supabase for a fast load time.
 * Each individual batch is rendered using the BatchCard component, which then
 * fetches its own live on-chain data.
 */
export default async function DashboardPage() {
  const user = await currentUser();
  const userRole = user?.publicMetadata?.role as string ?? 'Not Assigned';

  // Fetch the initial list of batches from our off-chain database (Supabase)
  const allBatches = await getAllBatches();

  return (
    <div className="container mx-auto p-6">
      <header className="flex justify-between items-center mb-8 pb-4 border-b">
        <div>
          <h1 className="text-3xl font-bold">Supply Chain Dashboard</h1>
          <p className="text-lg text-gray-600">
            Your Role: <Badge>{userRole}</Badge>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectWallet />
          {userRole === 'manufacturer' && (
            <Button asChild>
              <Link href="/create-batch">Create New Batch</Link>
            </Button>
          )}
        </div>
      </header>

      <main>
        {allBatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Map over the Supabase data and render a card for each batch.
                The BatchCard component will handle fetching the live on-chain details. */}
            {allBatches.map((batch) => (
              <BatchCard key={batch.batch_id} batch={batch} userRole={userRole} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <h2 className="text-2xl font-semibold">No batches found.</h2>
            <p>Manufacturers can create a new batch to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
}