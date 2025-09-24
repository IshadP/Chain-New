"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { updateUserRoleAndProfile } from "./_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useToast } from "@/hooks/use-toast";

type Role = "manufacturer" | "distributor" | "retailer";

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { address: walletAddress, isConnected } = useAccount();

  const [selectedRole, setSelectedRole] = useState<Role | "">("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleSelection = (value: Role) => {
    if (value) setSelectedRole(value);
  };

  const handleCompleteOnboarding = async () => {
    if (!user || !selectedRole || !walletAddress || !currentLocation) {
      toast({
        title: "Error",
        description: "Please select a role and connect your wallet.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Call the server action to save the profile
      await updateUserRoleAndProfile({
        role: selectedRole,
        walletAddress: walletAddress,
        currentLocation: currentLocation
      });

      // CRITICAL STEP: Reload the user object on the client.
      // This fetches the latest session claims (including the new role).
      await user.reload();

      toast({
        title: "Onboarding Complete!",
        description: "Your profile has been saved. Redirecting...",
      });

      // Now, router.push will work because the middleware will see the updated claims.
      router.push("/dashboard");

    } catch (error) {
      console.error("Onboarding failed:", error);
      toast({
        title: "Onboarding Failed",
        description: "Could not save your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome! Let's Get You Set Up.</CardTitle>
          <CardDescription>
            Complete these steps to start using the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-2">
            <h3 className="font-semibold">Step 1: Choose Your Role</h3>
            <ToggleGroup
              type="single"
              variant="outline"
              value={selectedRole}
              onValueChange={handleRoleSelection}
              className="w-full"
            >
              <ToggleGroupItem value="manufacturer" className="flex-1">Manufacturer</ToggleGroupItem>
              <ToggleGroupItem value="distributor" className="flex-1">Distributor</ToggleGroupItem>
              <ToggleGroupItem value="retailer" className="flex-1">Retailer</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Step 2: Connect Your Wallet</h3>
            <div className="p-4 border rounded-md flex items-center justify-center">
              <ConnectWallet />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Step 2: Enter Your Current Location *</h3> {/* ADDED BLOCK */}
            <Input 
              type="text"
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
              placeholder="e.g., Warehouse A, New York"
              required
            />
          </div>
          
          <Button
            onClick={handleCompleteOnboarding}
            disabled={isLoading || !selectedRole || !isConnected}
            className="w-full"
          >
            {isLoading ? "Saving..." : "Complete Onboarding"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
