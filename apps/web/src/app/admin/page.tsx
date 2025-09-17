// FILE: apps/web/src/app/admin/page.tsx

import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getAllProfiles } from '@/lib/dataservice'; // <-- FIX: Import from dataservice
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { GrantRoleButton } from '@/components/GrantRoleButton';
import { ethers } from 'ethers';
import SupplyChainArtifact from '../../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';

interface Profile {
  id: string;
  role: 'distributor' | 'retailer';
  wallet_address: `0x${string}`;
  display_name: string | null;
}

async function getUsersWithOnChainStatus(): Promise<(Profile & { isGranted: boolean })[]> {
    // --- FIX ---
    // Call the function from dataservice.ts instead of using supabase directly.
    const profiles = await getAllProfiles();
    // --- END FIX ---

    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const rpcUrl = process.env.HARDHAT_RPC_URL;

    if (!contractAddress || !rpcUrl) {
      console.error("Missing contract address or RPC URL in environment variables.");
      return (profiles as Profile[]).map(p => ({ ...p, isGranted: false }));
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, SupplyChainArtifact.abi, provider);

    const profilesWithStatus = await Promise.all(
        (profiles as Profile[]).map(async (profile) => {
            let isGranted = false;
            try {
              if (profile.role === 'distributor') {
                  isGranted = await contract.isDistributor(profile.wallet_address);
              } else if (profile.role === 'retailer') {
                  isGranted = await contract.isRetailer(profile.wallet_address);
              }
            } catch (e) {
              console.error(`Failed to check on-chain role for ${profile.wallet_address}`, e);
            }
            return { ...profile, isGranted };
        })
    );
    return profilesWithStatus;
}

export default async function AdminPage() {
  const user = await currentUser();

  if (user?.publicMetadata?.role !== 'manufacturer') {
    redirect('/dashboard');
  }

  const users = await getUsersWithOnChainStatus();

  return (
    <div className="container mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-lg text-gray-600">User Role Management</p>
      </header>
      
      <main>
        <Card>
          <CardHeader>
            <CardTitle>On-Chain Role Authorization</CardTitle>
            <CardDescription>
              Grant on-chain roles to new distributors and retailers so they can interact with the smart contract.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Wallet Address</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">{u.id}</TableCell>
                    <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{u.wallet_address}</TableCell>
                    <TableCell className="text-right">
                      <GrantRoleButton 
                        walletAddress={u.wallet_address} 
                        role={u.role} 
                        isAlreadyGranted={u.isGranted} 
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}