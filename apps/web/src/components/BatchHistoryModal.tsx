"use client";

import { useEffect, useState } from 'react';
import { useReadContracts } from 'wagmi';
import { format } from 'date-fns';
import QRCode from 'qrcode';
import Image from 'next/image';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getBatchById } from '@/lib/dataservice'; 

import supplyChainAbi from "../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json";
import deployment from "../../lib/deployment.json";

// Types for our data
interface BatchDetails {
  product_name: string;
}

type HistoryEvent = {
  timestamp: bigint;
  eventDescription: string;
  location: string;
  actor: string;
};

interface BatchHistoryModalProps {
  batchId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function BatchHistoryModal({ batchId, isOpen, onOpenChange }: BatchHistoryModalProps) {
  const [offChainDetails, setOffChainDetails] = useState<BatchDetails | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const { data: onChainData, isLoading: isOnChainLoading } = useReadContracts({
    contracts: [
      {
        address: deployment.address as `0x${string}`,
        abi: supplyChainAbi.abi,
        functionName: "getBatchHistory",
        args: [batchId],
      },
    ],
  });
  
  const history = onChainData?.[0]?.result as HistoryEvent[] | undefined;

  useEffect(() => {
    if (isOpen && batchId) {
      const fetchDetailsAndGenerateQr = async () => {
        try {
          // Fetch off-chain data
          const details = await getBatchById(batchId);
          setOffChainDetails(details);
          
          // Generate QR code data URL
          const url = await QRCode.toDataURL(`${window.location.origin}/batch/${batchId}`);
          setQrCodeUrl(url);

        } catch (error) {
          console.error("Failed to fetch details or generate QR code", error);
        }
      };
      fetchDetailsAndGenerateQr();
    }
  }, [isOpen, batchId]);

  const isLoading = isOnChainLoading || !offChainDetails;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isLoading ? "Loading Batch History..." : `History for: ${offChainDetails?.product_name}`}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
            <div className="md:col-span-2">
              <h3 className="font-semibold mb-4">Transportation History</h3>
              <div className="relative border-l-2 border-gray-200 ml-3">
                {history && history.length > 0 ? (
                  history.map((event, index) => (
                    <div key={index} className="mb-6 ml-6">
                      <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-8 ring-white">🚚</span>
                      <h4 className="font-semibold text-gray-900">{event.eventDescription}</h4>
                      <time className="block mb-1 text-xs text-gray-400">
                        {format(new Date(Number(event.timestamp) * 1000), "PPpp")}
                      </time>
                      <p className="text-sm text-gray-600"><strong>Location:</strong> {event.location}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 ml-6">No on-chain history found.</p>
                )}
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-semibold mb-4">QR Code</h3>
              <div className="bg-white p-2 rounded-lg inline-block shadow-md border">
                {qrCodeUrl && (
                  <Image
                    src={qrCodeUrl}
                    alt="Batch QR Code"
                    width={128}
                    height={128}
                  />
                )}
              </div>
              <p className="font-mono text-[10px] break-all mt-2 text-gray-500">{batchId}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

