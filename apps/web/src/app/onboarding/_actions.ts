"use server";

import { clerkClient, auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { upsertUserProfile } from "@/lib/dataservice"; // 1. Import the dataservice function

type Role = "manufacturer" | "distributor" | "retailer";

interface UpdateUserParams {
  role: Role;
  walletAddress: string;
}

/**
 * This server action is called when a user completes the onboarding form.
 * It performs two critical tasks:
 * 1. Updates the user's public metadata in Clerk to store their role and wallet.
 * 2. Creates a corresponding record in the local `profiles` table to link the Clerk ID to the wallet.
 */
export async function updateUserRoleAndProfile({ role, walletAddress }: UpdateUserParams) {
  const { userId } =await auth();
  if (!userId) {
    throw new Error("You must be signed in to update your profile.");
  }

  try {
    // Step 1: Update the user's metadata in Clerk
    const clerk = await clerkClient(); // Await the resolution of the Promise
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        role: role,
        wallet_address: walletAddress,
        onboardingComplete: true
      },
    });

    // Step 2: Create or update the user's profile in our own database
    // This is the crucial step that links the Clerk ID to the wallet address
    await upsertUserProfile({
        id: userId,
        role: role,
        wallet_address: walletAddress,
    });

    // Revalidate the path to ensure the middleware can pick up the changes
    revalidatePath("/", "layout");

    return { success: true };

  } catch (error) {
    console.error("Failed to update user role and profile:", error);
    throw new Error("Could not update profile. Please try again.");
  }
}
