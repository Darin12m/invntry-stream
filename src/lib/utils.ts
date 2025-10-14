import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a Google Drive share link to a direct image URL.
 * If the URL is not a Google Drive share link, it returns the original URL.
 * Example: https://drive.google.com/file/d/FILE_ID/view?usp=drive_link
 * Converts to: https://drive.google.com/uc?export=view&id=FILE_ID
 */
export function getGoogleDriveDirectLink(shareLink: string): string {
  const regex = /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/(?:view|edit|preview)?(?:\?usp=drive_link)?/;
  const match = shareLink.match(regex);

  if (match && match[1]) {
    const fileId = match[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
  return shareLink; // Return original if not a Google Drive share link
}