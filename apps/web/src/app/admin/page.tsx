import { getAllProfiles } from '@/lib/dataservice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GrantRoleButton } from '@/components/GrantRoleButton';
import { Badge } from '@/components/ui/badge';
import { OnChainRoleChecker } from '@/components/OnChainRoleChecker';
import { ConnectedWalletInfo } from '@/components/ConnectedWalletInfo';

const formatAddress = (address: string | null) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default async function AdminPage() {
  // REVERTED: Using the direct, unsecured data service call from the server component
  const profiles = await getAllProfiles();

  return (
    <main className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <ConnectedWalletInfo />

      <Card>
        <CardHeader>
          <CardTitle>User Role Management</CardTitle>
          <CardDescription>
            Grant on-chain roles to users in the supply chain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wallet Address</TableHead>
                <TableHead>Off-Chain Role</TableHead>
                <TableHead>On-Chain Status</TableHead>
                <TableHead className="text-right">On-Chain Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles
                 // Filter out the manufacturer (the user running the page) for a cleaner UI, 
                 // as they are granted the role by the contract constructor.
                .filter(profile => profile.role !== 'manufacturer')
                .map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-mono">{formatAddress(profile.wallet_address)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{profile.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <OnChainRoleChecker address={profile.wallet_address as `0x${string}`} />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {profile.role === 'distributor' && (
                        <GrantRoleButton addressToGrant={profile.wallet_address as `0x${string}`} roleToGrant="Distributor" />
                      )}
                      {profile.role === 'retailer' && (
                        <GrantRoleButton addressToGrant={profile.wallet_address as `0x${string}`} roleToGrant="Retailer" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}