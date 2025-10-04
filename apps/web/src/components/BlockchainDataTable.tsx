"use client";

import { useAccount, useReadContract } from "wagmi";
import { format } from "date-fns";
import { useMemo, useEffect } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

import supplyChainAbi from "../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json";
import deployment from "../../lib/deployment.json";

// Batch type definition matching Solidity struct
type Batch = {
  batchId: string;
  creator: string;
  currentHolder: string;
  intendedRecipient: string;
  ewaybillNo: string;
  currentLocation: string;
  status: number;
  createdAt: bigint;
  updatedAt: bigint;
};

// Status enum matching Solidity
enum BatchStatus {
  Created = 0,
  InTransit = 1,
  Received = 2,
}

// Helper functions
const getStatusText = (status: number): string => {
  switch (status) {
    case BatchStatus.Created:
      return "Created";
    case BatchStatus.InTransit:
      return "In-Transit";
    case BatchStatus.Received:
      return "Received";
    default:
      return "Unknown";
  }
};

const getStatusVariant = (status: number): "default" | "secondary" | "outline" => {
  switch (status) {
    case BatchStatus.Created:
      return "secondary";
    case BatchStatus.InTransit:
      return "default";
    case BatchStatus.Received:
      return "outline";
    default:
      return "outline";
  }
};

const formatAddress = (address: string): string => {
  if (address === "0x0000000000000000000000000000000000000000") {
    return "N/A";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const isZeroAddress = (address: string): boolean => {
  return address === "0x0000000000000000000000000000000000000000";
};

export function BlockchainDataTable() {
  const { address, isConnected } = useAccount();

  // Fetch all batches from the contract
  const {
    data: allBatches,
    isLoading: batchesLoading,
    error: batchesError,
    refetch: refetchBatches,
  } = useReadContract({
    address: deployment.address as `0x${string}`,
    abi: supplyChainAbi.abi,
    functionName: "getAllBatches",
    query: {
      enabled: isConnected,
    },
  });

  // Fetch the role of the connected user
  const {
    data: userRole,
    isLoading: roleLoading,
    error: roleError,
  } = useReadContract({
    address: deployment.address as `0x${string}`,
    abi: supplyChainAbi.abi,
    functionName: "getUserRole",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Debug logging
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("=== BlockchainDataTable Debug ===");
      console.log("Connected:", isConnected);
      console.log("Address:", address);
      console.log("User Role:", userRole);
      console.log("All Batches:", allBatches);
      console.log("Batches Loading:", batchesLoading);
      console.log("Role Loading:", roleLoading);
      console.log("Batches Error:", batchesError);
      console.log("Role Error:", roleError);
    }
  }, [address, isConnected, userRole, allBatches, batchesLoading, roleLoading, batchesError, roleError]);

  // Filter batches based on user role and address
  const filteredBatches = useMemo(() => {
    // Validate data availability
    if (!allBatches || !Array.isArray(allBatches) || allBatches.length === 0) {
      console.log("No batches available");
      return [];
    }

    if (!userRole || !address) {
      console.log("Missing user role or address");
      return [];
    }

    const role = (userRole as string).toLowerCase();
    const userAddress = address.toLowerCase();

    console.log(`Filtering batches for role: ${role}, address: ${userAddress}`);
    console.log(`Total batches to filter: ${allBatches.length}`);

    // Filter batches based on role and ownership
    const filtered = (allBatches as Batch[]).filter((batch: Batch) => {
      const currentHolder = batch.currentHolder.toLowerCase();
      const intendedRecipient = batch.intendedRecipient.toLowerCase();
      const batchStatus = Number(batch.status);

      // Manufacturer sees all batches
      if (role === "manufacturer") {
        return true;
      }

      // Current holder sees all their batches (any status)
      if (currentHolder === userAddress) {
        return true;
      }

      // Intended recipient sees batches that are In-Transit to them
      if (
        intendedRecipient === userAddress &&
        batchStatus === BatchStatus.InTransit
      ) {
        return true;
      }

      return false;
    });

    console.log(`Filtered batches count: ${filtered.length}`);

    // Sort by most recent first
    return filtered.sort((a, b) => {
      const timeA = Number(a.updatedAt);
      const timeB = Number(b.updatedAt);
      return timeB - timeA;
    });
  }, [allBatches, userRole, address]);

  // Loading state
  if (!isConnected) {
    return (
      <Alert>
        <AlertDescription>
          Please connect your wallet to view blockchain data.
        </AlertDescription>
      </Alert>
    );
  }

  // Error state
  if (batchesError || roleError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading blockchain data: {(batchesError || roleError)?.message}
        </AlertDescription>
      </Alert>
    );
  }

  // Loading state
  if (batchesLoading || roleLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // Check if user has a valid role
  if (userRole === "none") {
    return (
      <Alert>
        <AlertDescription>
          Your address does not have any assigned role in the supply chain. Please contact an administrator to get assigned a role.
        </AlertDescription>
      </Alert>
    );
  }

  // Render table
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Role: <span className="font-semibold capitalize">{userRole as string}</span>
          {" • "}
          Showing {filteredBatches.length} batch{filteredBatches.length !== 1 ? "es" : ""}
        </div>
        <button
          onClick={() => refetchBatches()}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>E-Way Bill</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Current Holder</TableHead>
              <TableHead>Intended Recipient</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBatches.length > 0 ? (
              filteredBatches.map((batch: Batch) => (
                <TableRow key={batch.batchId}>
                  <TableCell className="font-mono text-xs">
                    {batch.batchId}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(Number(batch.status))}>
                      {getStatusText(Number(batch.status))}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {batch.ewaybillNo || "N/A"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {batch.currentLocation || "N/A"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatAddress(batch.currentHolder)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {isZeroAddress(batch.intendedRecipient)
                      ? "N/A"
                      : formatAddress(batch.intendedRecipient)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(
                      new Date(Number(batch.updatedAt) * 1000),
                      "MMM dd, yyyy HH:mm"
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <p className="font-medium">No batches found</p>
                    <p className="text-sm mt-1">
                      {userRole === "manufacturer"
                        ? "Create a new batch to get started."
                        : "No batches are currently assigned to your address."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}