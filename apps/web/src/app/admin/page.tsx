import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { getAllProfiles } from '@/lib/dataservice';
import { ethers } from 'ethers';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GrantRoleButton } from '@/components/GrantRoleButton';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Users, Package, AlertTriangle } from 'lucide-react';
import SupplyChainArtifact from '../../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../../lib/deployment.json';

interface ProfileWithStatus {
  id: string;
  role: 'manufacturer' | 'distributor' | 'retailer';
  wallet_address: `0x${string}`;
  isGranted: boolean;
  created_at?: string;
}

interface AdminStats {
  totalUsers: number;
  manufacturers: number;
  distributors: number;
  retailers: number;
  pendingRoles: number;
}

export default function AdminPage() {
  const { user } = useUser();
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileWithStatus[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    manufacturers: 0,
    distributors: 0,
    retailers: 0,
    pendingRoles: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is manufacturer (admin)
  useEffect(() => {
    if (user && user.publicMetadata?.role !== 'manufacturer') {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    const fetchUsersWithStatus = async () => {
      setIsLoading(true);
      try {
        const allProfiles = await getAllProfiles();
        
        // Initialize stats
        const newStats: AdminStats = {
          totalUsers: allProfiles.length,
          manufacturers: allProfiles.filter(p => p.role === 'manufacturer').length,
          distributors: allProfiles.filter(p => p.role === 'distributor').length,
          retailers: allProfiles.filter(p => p.role === 'retailer').length,
          pendingRoles: 0
        };

        // Check on-chain status for non-manufacturers
        const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_HARDHAT_RPC_URL);
        const contract = new ethers.Contract(deployment.address, SupplyChainArtifact.abi, provider);

        const profilesWithStatus = await Promise.all(
          allProfiles.map(async (profile) => {
            let isGranted = false;
            
            // Manufacturers are always considered "granted" since they have admin privileges
            if (profile.role === 'manufacturer') {
              isGranted = true;
            } else {
              try {
                if (profile.role === 'distributor') {
                  isGranted = await contract.isDistributor(profile.wallet_address);
                } else if (profile.role === 'retailer') {
                  isGranted = await contract.isRetailer(profile.wallet_address);
                }
              } catch (e) {
                console.error(`Failed to check on-chain role for ${profile.wallet_address}`, e);
                isGranted = false;
              }
            }

            if (!isGranted && profile.role !== 'manufacturer') {
              newStats.pendingRoles++;
            }

            return { ...profile, isGranted } as ProfileWithStatus;
          })
        );

        setProfiles(profilesWithStatus);
        setStats(newStats);
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
    
    // Update pending roles count
    setStats(prev => ({ ...prev, pendingRoles: prev.pendingRoles - 1 }));
  };

  const handleRoleRevoked = (walletAddress: string) => {
    setProfiles(currentProfiles =>
      currentProfiles.map(p =>
        p.wallet_address.toLowerCase() === walletAddress.toLowerCase()
          ? { ...p, isGranted: false }
          : p
      )
    );
    
    // Update pending roles count
    setStats(prev => ({ ...prev, pendingRoles: prev.pendingRoles + 1 }));
  };

  const renderStatsCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">Manufacturers</p>
              <p className="text-2xl font-bold">{stats.manufacturers}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">Distributors</p>
              <p className="text-2xl font-bold">{stats.distributors}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-sm text-gray-600">Retailers</p>
              <p className="text-2xl font-bold">{stats.retailers}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-sm text-gray-600">Pending Roles</p>
              <p className="text-2xl font-bold">{stats.pendingRoles}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderUserTable = (filteredProfiles: ProfileWithStatus[], title: string) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {title === 'Pending Role Approvals' 
            ? 'Users who need on-chain role authorization to interact with the smart contract.'
            : `All ${title.toLowerCase()} in the system.`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Wallet Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-10 w-28 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredProfiles.length > 0 ? (
              filteredProfiles.map(profile => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {profile.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {profile.wallet_address}
                  </TableCell>
                  <TableCell>
                    {profile.isGranted ? (
                      <Badge variant="default">Authorized</Badge>
                    ) : (
                      <Badge variant="destructive">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {profile.created_at 
                      ? new Date(profile.created_at).toLocaleDateString()
                      : 'Unknown'
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    {profile.role !== 'manufacturer' && (
                      <GrantRoleButton 
                        walletAddress={profile.wallet_address} 
                        role={profile.role} 
                        isAlreadyGranted={profile.isGranted}
                        onRoleGranted={() => handleRoleGranted(profile.wallet_address)}
                        onRoleRevoked={() => handleRoleRevoked(profile.wallet_address)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  No {title.toLowerCase()} found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  if (user && user.publicMetadata?.role !== 'manufacturer') {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="container mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold flex items-center">
          <Shield className="mr-3 h-8 w-8" />
          Admin Panel
        </h1>
        <p className="text-lg text-gray-600">User Role Management & System Overview</p>
      </header>

      {renderStatsCards()}

      <main>
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pending">
              Pending Approvals ({stats.pendingRoles})
            </TabsTrigger>
            <TabsTrigger value="all">
              All Users ({stats.totalUsers})
            </TabsTrigger>
            <TabsTrigger value="distributors">
              Distributors ({stats.distributors})
            </TabsTrigger>
            <TabsTrigger value="retailers">
              Retailers ({stats.retailers})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="mt-6">
            {renderUserTable(
              profiles.filter(p => !p.isGranted && p.role !== 'manufacturer'),
              'Pending Role Approvals'
            )}
          </TabsContent>
          
          <TabsContent value="all" className="mt-6">
            {renderUserTable(profiles, 'All Users')}
          </TabsContent>
          
          <TabsContent value="distributors" className="mt-6">
            {renderUserTable(
              profiles.filter(p => p.role === 'distributor'),
              'Distributors'
            )}
          </TabsContent>
          
          <TabsContent value="retailers" className="mt-6">
            {renderUserTable(
              profiles.filter(p => p.role === 'retailer'),
              'Retailers'
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}