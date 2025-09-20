// FILE: apps/web/src/app/onboarding/page.tsx

"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { updateUserRoleAndProfile } from "./_actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useToast } from "@/hooks/use-toast";

type Role = "manufacturer" | "distributor" | "retailer";

/**
 * The updated onboarding page.
 * Step 1: User selects their role.
 * Step 2: User connects their wallet.
 * Step 3: User submits to save their profile.
 */
export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { address: walletAddress, isConnected } = useAccount();

  const [selectedRole, setSelectedRole] = useState<Role | "">("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleSelection = (value: Role) => {
    if (value) setSelectedRole(value);
  };

  const handleCompleteOnboarding = async () => {
    if (!user || !selectedRole || !walletAddress) {
      toast({
        title: "Error",
        description: "Please select a role and connect your wallet to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await updateUserRoleAndProfile({
        role: selectedRole,
        walletAddress: walletAddress,
      });

      toast({
        title: "Onboarding Complete!",
        description: "Your profile has been saved.",
      });

      // Redirect to the dashboard after successful onboarding
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
            Complete these two steps to start using the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Step 1: Role Selection */}
          <div className="space-y-2">
            <h3 className="font-semibold">Step 1: Choose Your Role</h3>
            <ToggleGroup
              type="single"
              variant="outline"
              value={selectedRole}
              onValueChange={handleRoleSelection}
              className="w-full"
            >
              <ToggleGroupItem value="manufacturer" className="flex-1">
                Manufacturer
              </ToggleGroupItem>
              <ToggleGroupItem value="distributor" className="flex-1">
                Distributor
              </ToggleGroupItem>
              <ToggleGroupItem value="retailer" className="flex-1">
                Retailer
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Step 2: Wallet Connection */}
          <div className="space-y-2">
            <h3 className="font-semibold">Step 2: Connect Your Wallet</h3>
            <div className="p-4 border rounded-md flex items-center justify-center">
              <ConnectWallet />
            </div>
          </div>
          
          {/* Completion Button */}
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