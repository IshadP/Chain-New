"use client";

import { useState, useEffect } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { useAccount } from 'wagmi';
import { getBatchesForUser } from '@/lib/dataservice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ConnectWallet } from '@/components/ConnectWallet';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TransferModal } from '@/components/TransferModal';
import { ReceiveModal } from '@/components/ReceiveModal';
import { Package, Clock, Plus } from 'lucide-react';

// Import the new modal component
import { BatchHistoryModal } from '@/components/BatchHistoryModal';

// Unified Batch Interface from Supabase
interface Batch {
  batch_id: string;
  product_name: string;
  manufacturer_wallet: string;
  current_holder_wallet: string | null;
  intended_recipient_wallet: string | null;
  status: 'Received' | 'InTransit';
  cost: number;
  quantity: number;
  categories: string;
  created_at: string;
  [key: string]: any;
}

export default function DashboardPage() {
  const { user } = useUser();
  const { address, isConnected } = useAccount(); 
  const userRole = user?.publicMetadata?.role as string;
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State for the new history modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatches = async () => {
      if (!isConnected || !address) {
        setBatches([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
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

  // Handler to open the modal with the correct batch ID
  const handleRowClick = (batchId: string) => {
    setSelectedBatchId(batchId);
    setIsHistoryModalOpen(true);
  };

  return (
    <div className="mx-auto pt-6">
      <header className="flex justify-between items-center mb-8 pb-4 border-b px-4">
        <div>
          <h1 className="text-3xl font-bold">Supply Chain Dashboard</h1>
          <p className="text-lg text-gray-600">
            Your Role: <Badge>{userRole}</Badge>
          </p>
        </div>
        <div className='flex items-center gap-4'>
            <Link href="/blockchain-view">
              Blockchain View
            </Link>           
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
          
          <div className="px-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-lg font-semibold text-gray-700">
                  Total Inventory: <span className="text-blue-600">{batches.length}</span> Batches Found
              </p>
              {userRole === 'manufacturer' && (
                <Button asChild>
                  <Link href="/create-batch"> <Plus className='mr-2 h-4 w-4'/> Create New Batch</Link>
                </Button>
              )}
            </div>
            
            <div className="bg-white border rounded-lg shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Product</TableHead>
                    <TableHead className="w-[12%]">Status</TableHead>
                    <TableHead className="w-[15%]">Relationship</TableHead>
                    <TableHead className="text-right w-[10%]">Qty</TableHead>
                    <TableHead className="text-right w-[15%] hidden sm:table-cell">Cost (In Rupee)</TableHead>
                    <TableHead className="w-[18%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const myAddress = address; 
                    const isCurrentHolder = batch.current_holder_wallet === myAddress;
                    const isIntendedRecipient = batch.intended_recipient_wallet === myAddress;
                    const isCreator = batch.manufacturer_wallet === myAddress;
                    
                    const canTransfer = isCurrentHolder && batch.status === 'Received';
                    const canReceive = isIntendedRecipient && batch.status === 'InTransit';

                    const statusBadge = (() => {
                        switch (batch.status) {
                          case 'Received':
                            return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs p-2">Received</Badge>;
                          case 'InTransit':
                            return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs"><Clock className="w-3 h-3 mr-1" />In Transit</Badge>;
                          default:
                            return <Badge variant="secondary" className="text-xs">{batch.status}</Badge>;
                        }
                    })();

                    const relationshipBadge = (() => {
                        if (isCurrentHolder) return <Badge className="bg-indigo-500 text-white hover:bg-indigo-500 text-xs">Holder</Badge>;
                        if (isIntendedRecipient) return <Badge variant="outline" className="text-yellow-700 border-yellow-700 text-xs">Incoming</Badge>;
                        if (isCreator) return <Badge variant="secondary" className="text-xs">Creator</Badge>;
                        return <Badge variant="secondary" className="text-xs">Tracked</Badge>;
                    })();

                    return (
                      <TableRow key={batch.batch_id} onClick={() => handleRowClick(batch.batch_id)} className="cursor-pointer hover:bg-gray-50">
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <Package className="w-4 h-4 mr-2 text-blue-600 hidden sm:block" />
                            {batch.product_name}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-1">ID: {batch.batch_id}</p>
                        </TableCell>
                        <TableCell>{statusBadge}</TableCell>
                        <TableCell>{relationshipBadge}</TableCell>
                        <TableCell className="text-right">{batch.quantity}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">{batch.cost.toFixed(2)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2 justify-end">
                            {canTransfer && <TransferModal batchId={batch.batch_id} />}
                            {canReceive && <ReceiveModal batchId={batch.batch_id} /> }
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <h2 className="text-2xl font-semibold">No batches found.</h2>
            <p>There are no batches currently associated with your wallet address.</p>
            {userRole === 'manufacturer' && (
              <Button asChild className="mt-4">
                <Link href="/create-batch">
                  <Plus className="mr-2 h-4 w-4" /> Create New Batch
                </Link>
              </Button>
            )}
          </div>
        )}
      </main>

      {selectedBatchId && (
        <BatchHistoryModal 
          batchId={selectedBatchId} 
          isOpen={isHistoryModalOpen} 
          onOpenChange={setIsHistoryModalOpen} 
        />
      )}
    </div>
  );
}
