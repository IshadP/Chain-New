"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { getAllProfiles } from '@/lib/dataservice';
import { ethers } from 'ethers';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { GrantRoleButton } from '@/components/GrantRoleButton';
import { Skeleton } from '@/components/ui/skeleton';
import SupplyChainArtifact from '../../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../../lib/deployment.json';

interface ProfileWithStatus {
  id: string;
  role: 'distributor' | 'retailer';
  wallet_address: `0x${string}`;
  isGranted: boolean;
}

export default function AdminPage() {
  const { user } = useUser();
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  if (user && user.publicMetadata?.role !== 'manufacturer') {
    router.push('/dashboard');
  }

  useEffect(() => {
    const fetchUsersWithStatus = async () => {
      setIsLoading(true);
      try {
        const allProfiles = await getAllProfiles();
        const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_HARDHAT_RPC_URL);
        const contract = new ethers.Contract(deployment.address, SupplyChainArtifact.abi, provider);

        const profilesWithStatus = await Promise.all(
          allProfiles
            .filter(p => p.role === 'distributor' || p.role === 'retailer')
            .map(async (profile) => {
              let isGranted = false;
              try {
                if (profile.role === 'distributor') isGranted = await contract.isDistributor(profile.wallet_address);
                else if (profile.role === 'retailer') isGranted = await contract.isRetailer(profile.wallet_address);
              } catch (e) {
                console.error(`Failed to check on-chain role for ${profile.wallet_address}`, e);
              }
              return { ...profile, isGranted } as ProfileWithStatus;
            })
        );
        setProfiles(profilesWithStatus);
      } catch (error) {
        console.error("Failed to fetch profiles:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsersWithStatus();
  }, []);

  const handleRoleGranted = (walletAddress: string) => {
    setProfiles(currentProfiles =>
      currentProfiles.map(p =>
        p.wallet_address.toLowerCase() === walletAddress.toLowerCase()
          ? { ...p, isGranted: true }
          : p
      )
    );
  };

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
                  <TableHead>Role</TableHead>
                  <TableHead>Wallet Address</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-10 w-28 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : profiles.length > 0 ? (
                  profiles.map(p => (
                    <TableRow key={p.id}>
                      <TableCell><Badge variant="secondary" className="capitalize">{p.role}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{p.wallet_address}</TableCell>
                      <TableCell className="text-right">
                        <GrantRoleButton 
                          walletAddress={p.wallet_address} 
                          role={p.role} 
                          isAlreadyGranted={p.isGranted}
                          onRoleGranted={() => handleRoleGranted(p.wallet_address)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">No distributors or retailers found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

