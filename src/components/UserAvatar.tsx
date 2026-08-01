import React, { useState, useEffect } from 'react';
import { isImageUrl } from '../types';

interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string;
  fallbackIcon?: string;
  className?: string;
  textClassName?: string;
}

/**
 * Universal UserAvatar Component
 * Prevents raw URL string rendering bugs by safely handling:
 * - Image URLs (http/https/data:image/blob)
 * - Image load failures (onError fallback to initial or default avatar icon)
 * - Emoji / Preset strings (length <= 4)
 * - Fallback to initial letter of name or default avatar icon
 */
export default function UserAvatar({
  avatarUrl,
  name,
  fallbackIcon = '👤',
  className = 'w-full h-full flex items-center justify-center overflow-hidden',
  textClassName = 'text-xs select-none font-black'
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Reset error state if avatarUrl changes
  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const rawAvatarUrl = avatarUrl?.trim();
  const rawName = name?.trim();
  
  // If avatarUrl is missing but name holds an image URL, use it as avatarUrl
  const cleanUrl = rawAvatarUrl || (rawName && isImageUrl(rawName) ? rawName : undefined);
  const isImg = !imageError && isImageUrl(cleanUrl);

  if (isImg && cleanUrl) {
    return (
      <div className={className}>
        <img
          src={cleanUrl}
          alt={rawName && !isImageUrl(rawName) ? rawName : 'Avatar'}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // Handle emoji or short preset string (e.g., '🧠', '⚔️')
  if (cleanUrl && cleanUrl.length <= 4 && !cleanUrl.includes('/') && !cleanUrl.includes('.')) {
    return (
      <div className={className}>
        <span className={textClassName}>{cleanUrl}</span>
      </div>
    );
  }

  // Fallback: Initial letter of valid name or fallbackIcon
  const validName = rawName && !isImageUrl(rawName) ? rawName : null;
  const initial = validName ? validName[0]?.toUpperCase() : null;

  return (
    <div className={className}>
      <span className={textClassName}>
        {initial || fallbackIcon}
      </span>
    </div>
  );
}
