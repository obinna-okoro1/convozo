/**
 * Storage Service
 *
 * Handles all Supabase Storage operations: avatar uploads, banner uploads,
 * shop file uploads, shop thumbnails, and file deletion.
 *
 * Extracted from SupabaseService to follow Single Responsibility Principle.
 */

import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

interface UploadResult {
  path: string;
  publicUrl: string;
}

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Upload a file to a public bucket and return both the storage path and public URL.
   */
  async uploadPublicFile(
    bucket: string,
    path: string,
    file: File,
  ): Promise<{ data: UploadResult | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase.client.storage
        .from(bucket)
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = this.supabase.client.storage
        .from(bucket)
        .getPublicUrl(path);

      return { data: { path: data.path, publicUrl }, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Upload failed'),
      };
    }
  }

  /**
   * Delete a file from a bucket.
   */
  async deleteFile(bucket: string, path: string): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.client.storage.from(bucket).remove([path]);
    return { error };
  }

  /**
   * Upload a digital file to the private shop-files bucket.
   * Returns the storage path (never a public URL — access via signed URLs only).
   * Path format: {creatorId}/{timestamp}_{safeFilename}
   */
  async uploadShopFile(
    creatorId: string,
    file: File,
  ): Promise<{ path: string | null; error: Error | null }> {
    try {
      const safeName = this.sanitizeFilename(file.name);
      const storagePath = `${creatorId}/${Date.now()}_${safeName}`;

      const { data, error } = await this.supabase.client.storage
        .from('shop-files')
        .upload(storagePath, file, { upsert: false });

      if (error) throw error;
      return { path: data.path, error: null };
    } catch (error) {
      return { path: null, error: error instanceof Error ? error : new Error('Upload failed') };
    }
  }

  /**
   * Upload a thumbnail to the public shop-thumbnails bucket.
   * Returns both the storage path and the derived public URL.
   */
  async uploadShopThumbnail(
    creatorId: string,
    file: File,
  ): Promise<{ path: string | null; publicUrl: string | null; error: Error | null }> {
    try {
      const safeName = this.sanitizeFilename(file.name);
      const storagePath = `${creatorId}/${Date.now()}_${safeName}`;

      const { data, error } = await this.supabase.client.storage
        .from('shop-thumbnails')
        .upload(storagePath, file, { upsert: false });

      if (error) throw error;

      const { data: { publicUrl } } = this.supabase.client.storage
        .from('shop-thumbnails')
        .getPublicUrl(data.path);

      return { path: data.path, publicUrl, error: null };
    } catch (error) {
      return {
        path: null,
        publicUrl: null,
        error: error instanceof Error ? error : new Error('Upload failed'),
      };
    }
  }

  /**
   * Strip non-safe characters from a filename and limit to 80 chars.
   */
  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  }
}
