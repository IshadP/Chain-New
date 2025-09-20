// FILE: apps/web/src/lib/dataservice.ts

import { supabase } from "./supabase";

/**
 * This file serves as the data access layer for the application.
 * It contains all the functions that interact with the Supabase database.
 */

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
  console.log("Creating inventory item with data (quantity excluded):", item);
  
  // Input validation (quantity check removed)
  if (!item.batch_id?.trim()) {
    throw new Error('Batch ID is required and cannot be empty');
  }
  if (!item.product_name?.trim()) {
    throw new Error('Product name is required and cannot be empty');
  }
  if (!item.manufacturer_id?.trim()) {
    throw new Error('Manufacturer ID is required and cannot be empty');
  }
  if (!item.current_holder_wallet?.trim()) {
    throw new Error('Current holder wallet is required and cannot be empty');
  }
  if (!item.eway_bill_no?.trim()) {
    throw new Error('E-way bill number is required and cannot be empty');
  }
   if (!item.category?.trim()) {
    throw new Error('Category is required');
  }
  
  try {
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        // quantity field is removed from the insert operation
        batch_id: item.batch_id.trim(),
        product_name: item.product_name.trim(),
        manufacturer_id: item.manufacturer_id.trim(),
        current_holder_wallet: item.current_holder_wallet.trim(),
        eway_bill_no: item.eway_bill_no.trim(),
        categories: item.category.trim(),
        internal_batch_no: item.internal_batch_no?.trim() || null,
        created_at: item.created_at,
        description: item.description?.trim() || null,
        cost: item.cost || null
      })
      .select()
      .single();
    
    if (error) {
      console.error("Supabase error creating inventory item:", error);
      // Specific error handling remains
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
    throw error; // Re-throw so the API route can handle it
  }
};

// Original function - gets all batches (keep for admin use cases)
export const getAllBatches = async () => {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      throw new Error(`Failed to fetch batches: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getAllBatches:', error);
    return [];
  }
};

// Fixed function - gets batches filtered by manufacturer_id
export const getBatchesByManufacturer = async (manufacturerId: string) => {
  try {
    const manid = manufacturerId.trim();
    if (!manid) {
      throw new Error('Manufacturer ID is required');
    }

    console.log(`Fetching batches for manufacturer ID: ${manid}`);

    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('manufacturer_id', manid)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error(`Supabase error fetching manufacturer batches:`, error);
      throw new Error(`Failed to fetch manufacturer batches: ${error.message}`);
    }
    
    console.log(`Found ${data?.length || 0} batches for manufacturer: ${manufacturerId}`);
    return data || [];
  } catch (error) {
    console.error('Error in getBatchesByManufacturer:', error);
    throw error; // Re-throw to allow caller to handle
  }
};

// Fixed function - gets batches filtered by current_holder_wallet
export const getBatchesByCurrentHolder = async (walletAddress: string) => {
  try {
    if (!walletAddress?.trim()) {
      throw new Error('Wallet address is required');
    }

    const cleanWallet = walletAddress.trim();
    console.log(`Fetching batches for current holder wallet: ${cleanWallet}`);

    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('current_holder_wallet', cleanWallet)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error(`Supabase error fetching current holder batches:`, error);
      throw new Error(`Failed to fetch current holder batches: ${error.message}`);
    }
    
    console.log(`Found ${data?.length || 0} batches for current holder: ${walletAddress}`);
    return data || [];
  } catch (error) {
    console.error('Error in getBatchesByCurrentHolder:', error);
    throw error; // Re-throw to allow caller to handle
  }
};

// Fixed function - gets batches based on user role and wallet/manufacturer info
export const getBatchesForUser = async (userRole: string, walletAddress?: string, manufacturerId?: string) => {
  try {
    if (!userRole?.trim()) {
      throw new Error('User role is required');
    }

    const role = userRole.toLowerCase().trim();
    console.log(`Fetching batches for user role: ${role}, manufacturerId: ${manufacturerId}, walletAddress: ${walletAddress}`);
    
    switch (role) {
      case 'manufacturer':
        if (!manufacturerId?.trim()) {
          throw new Error('Manufacturer ID is required for manufacturer role');
        }
        return await getBatchesByManufacturer(manufacturerId);
      
      case 'distributor':
      case 'retailer':
        if (!walletAddress?.trim()) {
          throw new Error('Wallet address is required for distributor/retailer role');
        }
        return await getBatchesByCurrentHolder(walletAddress);
      
      case 'admin':
        // Admin can see all batches
        return await getAllBatches();
      
      default:
        console.warn(`Unknown user role: ${role}`);
        return [];
    }
  } catch (error) {
    console.error('Error in getBatchesForUser:', error);
    throw error; // Re-throw to allow caller to handle
  }
};

// Helper function to validate required parameters based on role
export const validateUserRoleRequirements = (userRole: string, walletAddress?: string, manufacturerId?: string): {
  valid: boolean;
  missing?: string;
} => {
  const role = userRole.toLowerCase().trim();
  
  switch (role) {
    case 'manufacturer':
      if (!manufacturerId?.trim()) {
        return { valid: false, missing: 'manufacturer_id' };
      }
      break;
    
    case 'distributor':
    case 'retailer':
      if (!walletAddress?.trim()) {
        return { valid: false, missing: 'wallet_address' };
      }
      break;
    
    case 'admin':
      // Admin doesn't need specific requirements
      break;
    
    default:
      return { valid: false, missing: 'valid_role' };
  }
  
  return { valid: true };
};

// Fixed function - properly named and implemented
export const getManufacturerBatches = async (manufacturerId: string) => {
  try {
    if (!manufacturerId?.trim()) {
      throw new Error('Manufacturer ID is required');
    }

    return await getBatchesByManufacturer(manufacturerId);
  } catch (error) {
    console.error('Error in getManufacturerBatches:', error);
    throw error;
  }
};

// Fixed function - properly named and implemented with correct column name
export const getWalletHolderBatches = async (walletAddress: string) => {
  try {
    if (!walletAddress?.trim()) {
      throw new Error('Wallet address is required');
    }

    return await getBatchesByCurrentHolder(walletAddress);
  } catch (error) {
    console.error('Error in getWalletHolderBatches:', error);
    throw error;
  }
};

// ... etc.