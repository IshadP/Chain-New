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
  quantity: number;
  manufacturer_id: string;
  current_holder_wallet: string;
  eway_bill_no: string;
  description?: string | null;
  cost?: number | null;
}) => {
  console.log("Creating inventory item with data:", item);
  
  // Input validation
  if (!item.batch_id?.trim()) {
    throw new Error('Batch ID is required and cannot be empty');
  }
  
  if (!item.product_name?.trim()) {
    throw new Error('Product name is required and cannot be empty');
  }
  
  if (typeof item.quantity !== 'number' || item.quantity <= 0) {
    throw new Error('Quantity must be a positive number');
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
  
  if (item.cost !== null && item.cost !== undefined && (typeof item.cost !== 'number' || item.cost < 0)) {
    throw new Error('Cost must be a non-negative number or null');
  }
  
  try {
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        batch_id: item.batch_id.trim(),
        product_name: item.product_name.trim(),
        quantity: item.quantity,
        manufacturer_id: item.manufacturer_id.trim(),
        current_holder_wallet: item.current_holder_wallet.trim(),
        eway_bill_no: item.eway_bill_no.trim(),
        description: item.description?.trim() || null,
        cost: item.cost || null
      })
      .select()
      .single();
    
    if (error) {
      console.error("Supabase error creating inventory item:", error);
      
      // Provide more specific error messages
      if (error.code === '23505') { // Unique violation
        if (error.message.includes('batch_id')) {
          throw new Error(`Batch ID '${item.batch_id}' already exists`);
        }
        throw new Error('Duplicate entry found');
      } else if (error.code === '23503') { // Foreign key violation
        throw new Error('Invalid manufacturer ID or wallet address');
      } else if (error.code === '23502') { // Not null violation
        throw new Error(`Required field missing: ${error.message}`);
      } else if (error.code === '23514') { // Check constraint violation
        throw new Error('Invalid data format or constraint violation');
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

export const getAllBatches = async () => {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching all batches:', error);
      throw new Error(`Failed to fetch batches: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getAllBatches:', error);
    return [];
  }
};

export const getBatchById = async (batchId: string) => {
  if (!batchId?.trim()) {
    throw new Error('Batch ID is required');
  }
  
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('batch_id', batchId.trim())
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error(`Error fetching batch ${batchId}:`, error);
      throw new Error(`Failed to fetch batch: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error in getBatchById for ${batchId}:`, error);
    throw error;
  }
};

// ==================================================================
// PROFILE FUNCTIONS
// ==================================================================

export const upsertUserProfile = async (profile: {
  id: string; // This is the Clerk user ID
  role: string;
  wallet_address: string;
  display_name?: string;
}) => {
  if (!profile.id?.trim()) {
    throw new Error('User ID is required');
  }
  
  if (!profile.role?.trim()) {
    throw new Error('Role is required');
  }
  
  if (!profile.wallet_address?.trim()) {
    throw new Error('Wallet address is required');
  }
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: profile.id.trim(),
        role: profile.role.trim(),
        wallet_address: profile.wallet_address.trim(),
        display_name: profile.display_name?.trim() || null
      }, { onConflict: 'id' })
      .select()
      .single();
      
    if (error) {
      console.error('Error upserting user profile:', error);
      throw new Error(`Failed to save user profile: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error in upsertUserProfile:', error);
    throw error;
  }
};

export const getRecipients = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, wallet_address, role')
      .in('role', ['distributor', 'retailer']);

    if (error) {
      console.error('Error fetching recipients:', error);
      throw new Error(`Failed to fetch recipients: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getRecipients:', error);
    return [];
  }
};

export const getAllProfiles = async () => {
  try {
    const { data, error } = await supabase.from('profiles').select('*');
    
    if (error) {
      console.error('Error fetching all profiles:', error);
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getAllProfiles:', error);
    return [];
  }
};

export const getProfileByWallet = async (walletAddress: string) => {
  if (!walletAddress?.trim()) {
    throw new Error('Wallet address is required');
  }
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', walletAddress.trim())
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error(`Error fetching profile for wallet ${walletAddress}:`, error);
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error in getProfileByWallet for ${walletAddress}:`, error);
    throw error;
  }
};

// ==================================================================
// BATCH HISTORY FUNCTIONS
// ==================================================================

export const addHistoryEvent = async (event: {
  batch_id: string;
  event_type: string;
  actor_address: string;
  details?: string;
}) => {
  if (!event.batch_id?.trim()) {
    throw new Error('Batch ID is required for history event');
  }
  
  if (!event.event_type?.trim()) {
    throw new Error('Event type is required for history event');
  }
  
  if (!event.actor_address?.trim()) {
    throw new Error('Actor address is required for history event');
  }
  
  try {
    const { data, error } = await supabase
      .from('batch_history')
      .insert({
        batch_id: event.batch_id.trim(),
        event_type: event.event_type.trim().toUpperCase(),
        actor_address: event.actor_address.trim(),
        details: event.details?.trim() || null
      })
      .select()
      .single();
      
    if (error) {
      console.error('Error adding history event:', error);
      
      if (error.code === '23503') { // Foreign key violation
        throw new Error(`Invalid batch ID or actor address: ${error.message}`);
      }
      
      throw new Error(`Failed to add history event: ${error.message}`);
    }
    
    console.log('Successfully added history event:', data);
    return true;
  } catch (error) {
    console.error('Error in addHistoryEvent:', error);
    throw error;
  }
};

export const getBatchHistory = async (batchId: string) => {
  if (!batchId?.trim()) {
    throw new Error('Batch ID is required');
  }
  
  try {
    const { data, error } = await supabase
      .from('batch_history')
      .select(`
        *,
        profiles:actor_address (display_name, role)
      `)
      .eq('batch_id', batchId.trim())
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`Error fetching history for batch ${batchId}:`, error);
      throw new Error(`Failed to fetch batch history: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error(`Error in getBatchHistory for batch ${batchId}:`, error);
    return [];
  }
};

export const getRecentHistory = async (limit: number = 10) => {
  try {
    const { data, error } = await supabase
      .from('batch_history')
      .select(`
        *,
        inventory:batch_id (product_name),
        profiles:actor_address (display_name, role)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent history:', error);
      throw new Error(`Failed to fetch recent history: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getRecentHistory:', error);
    return [];
  }
};

// ==================================================================
// TRANSFER FUNCTIONS
// ==================================================================

export const updateBatchHolder = async (batchId: string, newHolderWallet: string) => {
  if (!batchId?.trim()) {
    throw new Error('Batch ID is required');
  }
  
  if (!newHolderWallet?.trim()) {
    throw new Error('New holder wallet is required');
  }
  
  try {
    const { data, error } = await supabase
      .from('inventory')
      .update({ current_holder_wallet: newHolderWallet.trim() })
      .eq('batch_id', batchId.trim())
      .select()
      .single();
      
    if (error) {
      console.error(`Error updating batch holder for ${batchId}:`, error);
      
      if (error.code === 'PGRST116') {
        throw new Error(`Batch ${batchId} not found`);
      }
      
      throw new Error(`Failed to update batch holder: ${error.message}`);
    }
    
    console.log(`Successfully updated batch ${batchId} holder to ${newHolderWallet}`);
    return data;
  } catch (error) {
    console.error(`Error in updateBatchHolder for ${batchId}:`, error);
    throw error;
  }
};