/**
 * Instagram Public Service
 * Handles public Instagram profile display without OAuth
 * Uses Instagram's oEmbed API for post embeds
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

export interface InstagramOEmbedResponse {
  version: string;
  title: string;
  author_name: string;
  author_url: string;
  author_id: number;
  media_id: string;
  provider_name: string;
  provider_url: string;
  type: string;
  width: number;
  height?: number;
  html: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
}

export interface InstagramPost {
  url: string;
  thumbnail?: string;
  embedHtml?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InstagramPublicService {
  private readonly OEMBED_API = 'https://graph.facebook.com/v18.0/instagram_oembed';
  
  constructor(private readonly http: HttpClient) {}

  /**
   * Get Instagram profile URL from username
   */
  getProfileUrl(username: string): string {
    const cleanUsername = username.replace('@', '').trim();
    return `https://www.instagram.com/${cleanUsername}`;
  }

  /**
   * Get Instagram post embed data using oEmbed API
   * Note: This requires the full post URL
   */
  getPostEmbed(postUrl: string): Observable<InstagramOEmbedResponse | null> {
    const params = {
      url: postUrl,
      omitscript: 'true',
      hidecaption: 'true'
    };

    return this.http.get<InstagramOEmbedResponse>(this.OEMBED_API, { params }).pipe(
      catchError(error => {
        console.error('Failed to fetch Instagram embed:', error);
        return of(null);
      })
    );
  }

  /**
   * Extract username from Instagram URL
   */
  extractUsername(url: string): string | null {
    const match = url.match(/instagram\.com\/([^\/\?]+)/);
    return match ? match[1] : null;
  }

  /**
   * Validate Instagram username format
   */
  isValidUsername(username: string): boolean {
    const cleanUsername = username.replace('@', '').trim();
    // Instagram usernames: 1-30 characters, letters, numbers, periods, underscores
    return /^[a-zA-Z0-9._]{1,30}$/.test(cleanUsername);
  }

  /**
   * Format username for display (with @ symbol)
   */
  formatUsername(username: string): string {
    const cleanUsername = username.replace('@', '').trim();
    return `@${cleanUsername}`;
  }
}
