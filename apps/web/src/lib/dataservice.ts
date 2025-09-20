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

// ... (The rest of your dataservice.ts functions remain unchanged)

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

// ... etc.