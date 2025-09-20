// FILE: apps/web/src/components/BatchCard.tsx

"use client";

import { useReadContract } from 'wagmi';
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TransferModal } from '@/components/TransferModal';
import { RecieveModal } from '@/components/RecieveModal';

// This type represents the basic batch data fetched from Supabase
interface BatchFromSupabase {
  batch_id: `0x${string}`; // CHANGED: The ID from Supabase is now a bytes16 hex string
  product_name: string;
}

// This type represents the structured data from the smart contract
type BatchOnChain = readonly [
  `0x${string}`,   // batchId (bytes16)
  `0x${string}`,   // creator
  `0x${string}`,   // currentHolder
  bigint,          // quantity
  string,          // ewaybillNo
  bigint,          // cost
  string,          // internalBatchNo
  string,          // currentLocation
  number,          // status (enum index)
  bigint,          // createdAt
  bigint           // updatedAt
];

// Mapping from the on-chain status enum index to a displayable string
const statusMapping: readonly string[] = ['Created', 'In Transit', 'Received'];
const abi = SupplyChainArtifact.abi; // Define ABI for use in the component

export function BatchCard({ batch, userRole }: { batch: BatchFromSupabase, userRole: string }) {
  // Wagmi hook to read live data from the smart contract
  const { data: productOnChain, isLoading, error } = useReadContract({
    address: deployment.address as `0x${string}`,
    abi: abi,
    functionName: 'getBatch',
    // CHANGED: Pass the batch_id directly as a bytes16 hex string. No BigInt conversion.
    args: [batch.batch_id], 
  });


  if (error) {
      console.error(`Error fetching on-chain data for batch ${batch.batch_id}:`, error);
  }

  // Safely extract and format data from the on-chain query result
  const onChainData = productOnChain as BatchOnChain | undefined;
  const displayOwner = onChainData?.[2] ?? '0x...';
  const displayStatus = onChainData?.[8] !== undefined ? statusMapping[onChainData[8]] : '...';
  const displayQuantity = onChainData?.[3]?.toString() ?? '...';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{batch.product_name}</CardTitle>
        <p className="text-xs text-gray-500 break-all">Batch ID: {batch.batch_id}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
                <h4 className="font-semibold">Quantity:</h4>
                {isLoading ? <Skeleton className="h-4 w-16" /> : <p>{displayQuantity} units</p>}
            </div>
             <div>
                <h4 className="font-semibold">Status:</h4>
                {isLoading ? <Skeleton className="h-6 w-20" /> : <Badge variant="secondary">{displayStatus}</Badge>}
            </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Current Holder:</h4>
          {isLoading ? (
            <Skeleton className="h-4 w-full" />
          ) : (
            <p className="text-sm text-gray-700 truncate" title={displayOwner}>{displayOwner}</p>
          )}
        </div>
        
        <div className="flex gap-2 pt-2">
          {/* Action buttons are now correctly enabled/disabled based on role */}
          {(userRole === 'manufacturer' || userRole === 'distributor') && (
            <TransferModal batchId={batch.batch_id} />
          )}
          {(userRole === 'distributor' || userRole === 'retailer') && (
            <RecieveModal batchId={batch.batch_id} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}