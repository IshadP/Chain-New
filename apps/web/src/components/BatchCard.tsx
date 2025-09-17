// FILE: apps/web/src/components/BatchCard.tsx

"use client";

import { useReadContract } from 'wagmi';
import { SupplyChainABI } from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { Badge } from '@/components/ui/badge'; // Using ShadCN Badge
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Using ShadCN Card
import { Skeleton } from '@/components/ui/skeleton'; // Using ShadCN Skeleton for loading
import { TransferModal } from '@/components/TransferModal';
import { RecieveModal } from '@/components/RecieveModal';

// This type represents the basic batch data fetched from Supabase
interface BatchFromSupabase {
  batch_id: string; // The numeric ID from the contract, stored as a string/numeric in Supabase
  product_name: string;
}

// This type represents the structured data returned from our smart contract's `getBatch` function
type BatchOnChain = readonly [
  bigint, // batchId
  `0x${string}`, // creator
  `0x${string}`, // currentHolder
  bigint, // quantity
  string, // ewaybillNo
  number, // status (enum index)
  bigint, // createdAt
  bigint // updatedAt
];

// Mapping from the on-chain status enum index to a displayable string
const statusMapping: readonly string[] = ['Created', 'In Transit', 'Received'];

export function BatchCard({ batch, userRole }: { batch: BatchFromSupabase, userRole: string }) {
  // Wagmi hook to read live data from the smart contract for this specific batch
  const { data: productOnChain, isLoading } = useReadContract({
    address: deployment.address as `0x${string}`,
    abi: SupplyChainABI,
    functionName: 'getBatch',
    args: [BigInt(batch.batch_id)], // The smart contract expects a BigInt for the ID
  });

  // Safely extract and format data from the on-chain query result
  const onChainData = productOnChain as BatchOnChain | undefined;
  const displayOwner = onChainData?.[2] ?? '0x...';
  const displayStatus = onChainData?.[5] !== undefined ? statusMapping[onChainData[5]] : '...';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{batch.product_name}</CardTitle>
        <p className="text-sm text-gray-500">Batch ID: {batch.batch_id}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold">Current Holder:</h4>
          {isLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <p className="text-sm text-gray-700 truncate" title={displayOwner}>{displayOwner}</p>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold">Status:</h4>
          {isLoading ? (
            <Skeleton className="h-6 w-20 rounded-full" />
          ) : (
            <Badge variant="secondary">{displayStatus}</Badge>
          )}
        </div>
        
        <div className="flex gap-2 pt-2">
          {/* Only show transfer button if the user has the correct role */}
          {(userRole === 'manufacturer' || userRole === 'distributor') && (
            <TransferModal batchId={batch.batch_id} />
          )}
          {/* Only show receive button if the user has the correct role */}
          {(userRole === 'distributor' || userRole === 'retailer') && (
            <RecieveModal batchId={batch.batch_id} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}