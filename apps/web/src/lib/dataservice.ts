// FILE: apps/web/src/lib/dataservice.ts

import { createClient } from '@supabase/supabase-js';
import { supabase } from "./supabase"; // Your existing client-side client

/**
 * This file serves as the data access layer for the application.
 * It contains all the functions that interact with the Supabase database.
 */

// ==================================================================
// HELPER FUNCTIONS
// ==================================================================

// Helper function to create a Supabase client with the service role key.
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
        throw new Error('Supabase URL or service key is missing from environment variables.');
    }

    return createClient(supabaseUrl, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

/**
 * Aggressively cleans a string by trimming whitespace and removing any newline characters.
 * @param str The string to clean.
 * @returns The cleaned string.
 */
const cleanString = (str: string | null | undefined): string => {
    if (!str) return '';
    // This regex removes newline characters (\n, \r) globally.
    return str.trim().replace(/(\r\n|\n|\r)/gm, "");
}


// ==================================================================
// USER PROFILE FUNCTIONS
// ==================================================================

export const upsertUserProfile = async (profile: {
  id: string;
  role: 'manufacturer' | 'distributor' | 'retailer';
  wallet_address: string;
}) => {
  try {
    const cleanId = cleanString(profile.id);
    const cleanWallet = cleanString(profile.wallet_address);

    if (!cleanId) throw new Error("User ID is required.");
    if (!profile.role) throw new Error("User role is required.");
    if (!cleanWallet) throw new Error("Wallet address is required.");

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: cleanId,
        role: profile.role,
        wallet_address: cleanWallet,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error upserting user profile:", error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!data) {
        throw new Error('No data returned from database after upsert');
    }

    console.log("Successfully upserted user profile:", data);
    return data;
  } catch (error) {
    console.error("Error in upsertUserProfile:", error);
    throw error;
  }
};


export const getAllProfiles = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');

    if (error) {
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllProfiles:', error);
    return [];
  }
}

/**
 * NEW FUNCTION
 * Fetches all users who are distributors or retailers, excluding the current user.
 */
export const getPotentialRecipients = async (currentUserId: string) => {
    try {
        const cleanedCurrentUserId = cleanString(currentUserId);
        if (!cleanedCurrentUserId) {
            throw new Error("Current user ID is required to fetch recipients.");
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('id, wallet_address, role')
            // Exclude the current user from the list
            .not('id', 'eq', cleanedCurrentUserId)
            // Only include users who can receive batches
            .in('role', ['distributor', 'retailer']);

        if (error) {
            throw new Error(`Failed to fetch recipients: ${error.message}`);
        }

        return data || [];
    } catch (error) {
        console.error('Error in getPotentialRecipients:', error);
        return [];
    }
};



// ==================================================================
// INVENTORY (BATCHES) FUNCTIONS
// ==================================================================

export const createInventoryItem = async (item: {
  batch_id: string;
  product_name: string;
  manufacturer_id: string;
  current_holder_wallet: string;
  eway_bill_no: string;
  category: string;
  internal_batch_no: string;
  created_at: string;
  description?: string | null;
  cost?: number | null;
}) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('inventory')
      .insert({
        batch_id: cleanString(item.batch_id),
        product_name: item.product_name.trim(),
        manufacturer_id: cleanString(item.manufacturer_id),
        current_holder_wallet: cleanString(item.current_holder_wallet),
        eway_bill_no: item.eway_bill_no.trim(),
        categories: item.category.trim(),
        internal_batch_no: item.internal_batch_no?.trim() || null,
        created_at: item.created_at,
        description: item.description?.trim() || null,
        cost: item.cost || null,
        status: 'Received', // <-- ADD THIS LINE
      })
      .select()
      .single();
    
    if (error) {
      console.error("Supabase error creating inventory item:", error);
      if (error.code === '23505') {
        throw new Error(`Batch ID '${item.batch_id}' already exists`);
      }
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('No data returned from database after insert');
    }
    
    console.log("Successfully created inventory item:", data);
    return data;
  } catch (error) {
    console.error("Error in createInventoryItem:", error);
    throw error;
  }
};

export const transferBatchOffChain = async (batchId: string, recipientWallet: string) => {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin
            .from('inventory')
            .update({
                current_holder_wallet: cleanString(recipientWallet), // Directly set the new holder
                status: 'InTransit', // Mirror the on-chain status
                updated_at: new Date().toISOString(),
            })
            .eq('batch_id', cleanString(batchId))
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error in transferBatchOffChain:", error);
        throw error;
    }
};

/**
 * UPDATED FUNCTION
 * Updates the batch status to 'Received'.
 */
export const receiveBatchOffChain = async (batchId: string) => {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin
            .from('inventory')
            .update({
                status: 'Received', // Mirror the on-chain status
                updated_at: new Date().toISOString(),
            })
            .eq('batch_id', cleanString(batchId))
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error in receiveBatchOffChain:", error);
        throw error;
    }
};



export const getBatchesByManufacturer = async (manufacturerId: string) => {
  try {
    const cleanManId = cleanString(manufacturerId); // Use the cleaning function here
    if (!cleanManId) {
      throw new Error('Manufacturer ID is required');
    }

    console.log(`Fetching batches for cleaned manufacturer ID: '${cleanManId}'`);

    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('manufacturer_id', cleanManId) // Query with the cleaned ID
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error(`Supabase error fetching manufacturer batches:`, error);
      throw new Error(`Failed to fetch manufacturer batches: ${error.message}`);
    }
    
    console.log(`Found ${data?.length || 0} batches for manufacturer: ${manufacturerId}`);
    return data || [];
  } catch (error) {
    console.error('Error in getBatchesByManufacturer:', error);
    throw error;
  }
};

export const getBatchesByCurrentHolder = async (walletAddress: string) => {
  try {
    const cleanWallet = cleanString(walletAddress); // Use the cleaning function here
    if (!cleanWallet) {
      throw new Error('Wallet address is required');
    }

    console.log(`Fetching batches for current holder wallet: ${cleanWallet}`);

    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('current_holder_wallet', cleanWallet) // Query with the cleaned address
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error(`Supabase error fetching current holder batches:`, error);
      throw new Error(`Failed to fetch current holder batches: ${error.message}`);
    }
    
    console.log(`Found ${data?.length || 0} batches for current holder: ${walletAddress}`);
    return data || [];
  } catch (error) {
    console.error('Error in getBatchesByCurrentHolder:', error);
    throw error;
  }
};

export const getBatchesForUser = async (userRole: string, walletAddress?: string, manufacturerId?: string) => {
    try {
        const role = userRole.toLowerCase().trim();
        
        switch (role) {
            case 'manufacturer':
                if (!manufacturerId) throw new Error('Manufacturer ID is required');
                // Manufacturers see all batches they created.
                return await getBatchesByManufacturer(manufacturerId);
            
            case 'distributor':
            case 'retailer':
                if (!walletAddress) throw new Error('Wallet address is required');
                // Distributors/Retailers ONLY see batches they currently hold.
                return await getBatchesByCurrentHolder(walletAddress);
            
            default:
                console.warn(`Unknown user role: ${role}`);
                return [];
        }
    } catch (error) {
        console.error('Error in getBatchesForUser:', error);
        throw error;
    }
};