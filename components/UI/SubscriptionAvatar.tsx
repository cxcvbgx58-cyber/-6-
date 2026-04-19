import React from 'react';
import { User } from 'lucide-react';

interface SubscriptionAvatarProps {
  tier: 'free' | '1month' | '3months' | '1year';
  size?: number;
  padding?: string;
}

export const SubscriptionAvatar: React.FC<SubscriptionAvatarProps> = ({ tier, size = 128, padding = "p-4" }) => {
  const getImageUrl = () => {
    switch (tier) {
      case '1month':
        return "https://pbs.twimg.com/media/HE2Fw9Ga8AE5HPa?format=jpg&name=medium";
      case '3months':
        return "https://pbs.twimg.com/media/HE2DgDEawAAPE2h?format=jpg&name=medium";
      case '1year':
        return "https://preview.redd.it/fg6prjm3tlsg1.png?auto=webp&s=b5fe045014198344a021a2b7a7ef73f4bfc1d054";
      default:
        // Fallback for free tier (Zero period)
        return "https://preview.redd.it/%D1%80%D0%BF%D0%B0%D0%B0%D0%BE%D0%B5-v0-h3eaef1mbmsg1.png?auto=webp&s=b46c29ac638125f2d72219c4b964e53f33c8981c";
    }
  };

  const getVipLevel = () => {
    switch (tier) {
      case '1month': return 1;
      case '3months': return 2;
      case '1year': return 3;
      default: return 0;
    }
  };

  const imageUrl = getImageUrl();
  const vipLevel = getVipLevel();

  return (
    <div className="relative flex items-center justify-center select-none group" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white/10 relative bg-[#0a0a0a] flex items-center justify-center">
        <img 
          src={imageUrl!} 
          alt={`${tier} avatar`} 
          className="w-full h-full object-cover object-top transition-transform duration-500 scale-[1.4] translate-y-[2%]"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity duration-300" />
      </div>
    </div>
  );
};
