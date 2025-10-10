"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import supplyChainAbi from "../../../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json";
import deployment from "../../../../lib/deployment.json";

// Types for our contract data
type Batch = {
  batchId: string;
  creator: string;
  currentHolder: string;
  ewaybillNo: string;
  currentLocation: string;
  status: number;
  createdAt: bigint;
};

type HistoryEvent = {
  timestamp: bigint;
  eventDescription: string;
  location: string;
  actor: string;
};

const getStatusText = (status: number) => {
  return status === 1 ? "In-Transit" : "Received";
};

export default function BatchDetailsPage() {
  const params = useParams();
  const batchId = params.batchId as string;

  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: deployment.address as `0x${string}`,
        abi: supplyChainAbi.abi,
        functionName: "getBatch",
        args: [batchId],
      },
      {
        address: deployment.address as `0x${string}`,
        abi: supplyChainAbi.abi,
        functionName: "getBatchHistory",
        args: [batchId],
      },
    ],
  });

  const [batchData, historyData] = data || [];
  const batch = batchData?.result as Batch | undefined;
  const history = historyData?.result as HistoryEvent[] | undefined;

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // MODIFICATION: Changed `0n` to `BigInt(0)` to fix the error.
  if (!batch || batch.createdAt === BigInt(0)) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold">Batch Not Found</h1>
        <p>The batch ID "{batchId}" does not exist on the blockchain.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 bg-gray-50 min-h-screen">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Batch Details</CardTitle>
          <CardDescription className="font-mono text-xs pt-2">{batch.batchId}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><strong>Status:</strong> <Badge>{getStatusText(batch.status)}</Badge></div>
          <div><strong>Current Location:</strong> {batch.currentLocation}</div>
          <div><strong>Created On:</strong> {format(new Date(Number(batch.createdAt) * 1000), "PPpp")}</div>
          
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transportation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative border-l-2 border-gray-200 ml-3">
            {history?.map((event, index) => (
              <div key={index} className="mb-8 ml-6">
                <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-8 ring-white">
                  🚚
                </span>
                <h3 className="flex items-center mb-1 text-lg font-semibold text-gray-900">
                  {event.eventDescription}
                </h3>
                <time className="block mb-2 text-sm font-normal leading-none text-gray-400">
                  {format(new Date(Number(event.timestamp) * 1000), "PPpp")}
                </time>
                <p className="text-base font-normal text-gray-600"><strong>Location:</strong> {event.location}</p>
                <p className="text-sm font-normal text-gray-500 truncate"><strong>By:</strong> <span className="font-mono text-xs">{event.actor}</span></p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}