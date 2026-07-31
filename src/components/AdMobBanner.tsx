import React, { memo } from 'react';
import { ADMOB_CONFIG } from '../utils/admob';

interface AdMobBannerProps {
  type: 'top' | 'bottom';
  className?: string;
}

function AdMobBanner({ type, className = '' }: AdMobBannerProps) {
  const isTop = type === 'top';
  const adUnitId = isTop ? ADMOB_CONFIG.TOP_BANNER_ID : ADMOB_CONFIG.BOTTOM_BANNER_ID;
  const placeholderId = isTop ? 'top-ad-placeholder' : 'bottom-ad-placeholder';

  return (
    <div
      id={placeholderId}
      data-ad-unit-id={adUnitId}
      data-ad-format="banner"
      className={`h-[50px] min-h-[50px] w-full shrink-0 bg-transparent pointer-events-none select-none z-20 relative overflow-hidden ${
        isTop ? '' : 'mt-auto'
      } ${className}`}
    />
  );
}

export default memo(AdMobBanner);
