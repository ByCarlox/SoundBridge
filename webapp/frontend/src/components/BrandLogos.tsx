import React, { useState } from 'react';
import type { BrowserKind } from '../types';

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Official-style Spotify Emerald (#1ED760) vector disc with three acoustic waves.
 */
export const SpotifyLogo: React.FC<LogoProps> = ({ size = 28, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <circle cx="24" cy="24" r="22" fill="#1ED760" />
    <path
      d="M34.2 21.1C27.9 17.4 17.5 17 11.5 18.8C10.5 19.1 9.5 18.5 9.2 17.6C8.9 16.6 9.5 15.6 10.4 15.3C17.3 13.2 28.8 13.6 36.1 17.9C37 18.4 37.3 19.6 36.7 20.5C36.2 21.3 35.1 21.6 34.2 21.1Z"
      fill="#060609"
    />
    <path
      d="M33.1 27.2C32.6 28 31.6 28.2 30.8 27.7C25.5 24.5 17.5 23.5 11.3 25.4C10.4 25.7 9.5 25.2 9.2 24.3C8.9 23.4 9.4 22.5 10.3 22.2C17.4 20.1 26.3 21.1 32.5 24.9C33.3 25.4 33.6 26.4 33.1 27.2Z"
      fill="#060609"
    />
    <path
      d="M29.9 33C29.5 33.6 28.7 33.8 28.1 33.4C23.5 30.6 17.7 30 10.9 31.5C10.2 31.7 9.5 31.2 9.3 30.5C9.1 29.8 9.6 29.1 10.3 28.9C17.8 27.2 24.2 27.9 29.4 31.1C30.1 31.5 30.3 32.3 29.9 33Z"
      fill="#060609"
    />
  </svg>
);

/**
 * Official-style YouTube Music Crimson (#FF0033) vector disc with white concentric vinyl ring and play triangle.
 */
export const YouTubeMusicLogo: React.FC<LogoProps> = ({
  size = 28,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <circle cx="24" cy="24" r="22" fill="#FF0033" />
    <circle
      cx="24"
      cy="24"
      r="12.5"
      stroke="#FFFFFF"
      strokeWidth="2.2"
      strokeOpacity="0.95"
    />
    <path d="M21 18.8L30.2 24L21 29.2V18.8Z" fill="#FFFFFF" />
  </svg>
);

/**
 * SoundBridge Brand Mark (Panel 1 of Brand Kit):
 * Waveform suspension bridge morphing from Spotify Emerald (#1ED760) -> Sonic Cyan (#00E5FF) -> YouTube Music Crimson (#FF0033).
 */
export const SoundBridgeLogo: React.FC<LogoProps> = ({
  size = 36,
  className = '',
}) => (
  <svg
    width={size}
    height={Math.round(size * 0.72)}
    viewBox="0 0 64 46"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="sb-sonic-grad" x1="0" y1="23" x2="64" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#1ED760" />
        <stop offset="50%" stopColor="#00E5FF" />
        <stop offset="100%" stopColor="#FF0033" />
      </linearGradient>
    </defs>
    {/* Left Acoustic Waveform & Tower */}
    <path
      d="M3 26H8L11 16L14 33L18 9V38M22 7V40"
      stroke="url(#sb-sonic-grad)"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Suspension Bridge Catenary Arch & Deck */}
    <path
      d="M22 10C27 21 37 21 42 10"
      stroke="url(#sb-sonic-grad)"
      strokeWidth="3"
      strokeLinecap="round"
    />
    {/* Vertical Acoustic Bars inside the Span */}
    <path
      d="M27 16V25M32 19V25M37 16V25"
      stroke="url(#sb-sonic-grad)"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* Bridge Deck & Lower Arch */}
    <path
      d="M19 26H59M22 40C26 30 38 30 42 40"
      stroke="url(#sb-sonic-grad)"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    {/* Right Tower & Outgoing Wave */}
    <path
      d="M42 7V40M46 11V34L50 18L54 22H61"
      stroke="url(#sb-sonic-grad)"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Recognizable Multi-Color Vector Browser Logos (Safari, Chrome, Firefox, Edge)
 */
export const SafariLogo: React.FC<LogoProps> = ({ size = 18, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <circle cx="16" cy="16" r="14" fill="#1E90FF" stroke="#FFFFFF" strokeWidth="1.5" />
    <polygon points="16,6 18.8,16 16,14.5 13.2,16" fill="#FF3B30" />
    <polygon points="16,26 18.8,16 16,17.5 13.2,16" fill="#FFFFFF" />
  </svg>
);

export const ChromeLogo: React.FC<LogoProps> = ({ size = 18, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <circle cx="16" cy="16" r="14" fill="#FBBF24" />
    <path d="M4.2 9.5A14 14 0 0 1 28 9.5H16L10 19.5L4.2 9.5Z" fill="#EF4444" />
    <path d="M4.2 9.5L10.5 20.5L16 30A14 14 0 0 1 4.2 9.5Z" fill="#22C55E" />
    <circle cx="16" cy="16" r="6.2" fill="#FFFFFF" />
    <circle cx="16" cy="16" r="4.6" fill="#3B82F6" />
  </svg>
);

export const FirefoxLogo: React.FC<LogoProps> = ({ size = 18, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <circle cx="16" cy="16" r="14" fill="#7C3AED" />
    <path
      d="M25 8C28 12 28 21 21 26C14 31 5 26 4 17C3 10 9 5 15 5C12 8 11 13 15 16C19 19 23 15 22 11C24 11 25 8 25 8Z"
      fill="#F97316"
    />
    <path
      d="M20 24C25 21 26 15 23 11C23 15 19 18 15 16C12 14 12 10 14 8C9 10 7 16 10 21C13 25 17 25 20 24Z"
      fill="#FACC15"
    />
  </svg>
);

export const EdgeLogo: React.FC<LogoProps> = ({ size = 18, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <circle cx="16" cy="16" r="14" fill="#0284C7" />
    <path
      d="M6 21C6 13 12 7 20 8C25 9 28 13 27 17C26 20 22 21 19 19C16 17 17 13 20 13C15 12 11 16 12 21C13 25 19 26 24 24C20 28 11 28 6 21Z"
      fill="#34D399"
    />
  </svg>
);

export const BrowserIcon: React.FC<{ browser: BrowserKind; size?: number }> = ({
  browser,
  size = 18,
}) => {
  switch (browser) {
    case 'Safari':
      return <SafariLogo size={size} />;
    case 'Firefox':
      return <FirefoxLogo size={size} />;
    case 'Edge':
      return <EdgeLogo size={size} />;
    case 'Chrome':
    default:
      return <ChromeLogo size={size} />;
  }
};

/**
 * Animated Multi-Bar Audio Equalizer Wave (Panel 5 of Brand Kit)
 * Morphs from #1ED760 (Spotify Emerald) -> #00E5FF (Sonic Cyan) -> #FF0033 (YouTube Music Crimson)
 */
const WAVE_HEIGHTS = [
  14, 24, 38, 22, 54, 76, 44, 62, 88, 52, 96, 68, 42, 78, 58, 36, 66, 84, 48, 72,
  38, 26, 16,
];

export const SonicWaveBridge: React.FC<{
  active?: boolean;
  className?: string;
}> = ({ active = false, className = '' }) => {
  return (
    <div
      className={`flex items-center justify-center gap-[4px] sm:gap-[5px] h-16 px-2 select-none ${className}`}
      aria-hidden="true"
    >
      {WAVE_HEIGHTS.map((baseHeight, idx) => {
        const ratio = idx / (WAVE_HEIGHTS.length - 1);
        let color = '#1ED760';
        let glow = 'rgba(30, 215, 96, 0.45)';
        if (ratio > 0.62) {
          color = '#FF0033';
          glow = 'rgba(255, 0, 51, 0.45)';
        } else if (ratio > 0.36) {
          color = '#00E5FF';
          glow = 'rgba(0, 229, 255, 0.45)';
        }

        return (
          <span
            key={idx}
            className={active ? 'sonic-bar-active' : 'sonic-bar-idle'}
            style={{
              height: `${Math.max(18, Math.round(baseHeight * 0.62))}px`,
              backgroundColor: color,
              boxShadow: `0 0 12px ${glow}`,
              animationDelay: `${(idx * 65) % 600}ms`,
            }}
          />
        );
      })}
    </div>
  );
};

/**
 * Rich Album Art / Vinyl Cover Fallback (Panel 6 of Brand Kit)
 * Ensures every playlist card looks like a rich Apple Music / Spotify album tile even when coverUrl is null.
 */
const ALBUM_PALETTES = [
  {
    bg: 'linear-gradient(135deg, #F9A8D4 0%, #9333EA 55%, #1E1B4B 100%)',
    accent: '#1ED760',
  },
  {
    bg: 'linear-gradient(135deg, #38BDF8 0%, #3B82F6 50%, #1E1B4B 100%)',
    accent: '#00E5FF',
  },
  {
    bg: 'linear-gradient(135deg, #FBBF24 0%, #EA580C 55%, #431407 100%)',
    accent: '#FF0033',
  },
  {
    bg: 'linear-gradient(135deg, #34D399 0%, #059669 50%, #064E3B 100%)',
    accent: '#1ED760',
  },
];

export const PlaylistCoverArt: React.FC<{
  coverUrl?: string | null;
  title: string;
  isLikedSongs?: boolean;
  index?: number;
  className?: string;
}> = ({ coverUrl, title, isLikedSongs = false, index = 0, className = '' }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const palette = ALBUM_PALETTES[index % ALBUM_PALETTES.length];

  if (coverUrl && !imgFailed) {
    return (
      <div
        className={`relative overflow-hidden bg-[#151722] ${className}`}
      >
        <img
          src={coverUrl}
          alt={title}
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </div>
    );
  }

  if (isLikedSongs) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden ${className}`}
        style={{
          background:
            'linear-gradient(135deg, #4F46E5 0%, #00E5FF 55%, #1ED760 100%)',
        }}
      >
        <svg
          viewBox="0 0 64 64"
          className="h-1/2 w-1/2 drop-shadow-[0_6px_16px_rgba(0,0,0,0.4)]"
          fill="#FFFFFF"
        >
          <path d="M32 54.6L27.9 50.9C13.4 37.8 4 29.2 4 18.6C4 10 10.7 3.2 19.4 3.2C24.3 3.2 29 5.5 32 9.1C35 5.5 39.7 3.2 44.6 3.2C53.3 3.2 60 10 60 18.6C60 29.2 50.6 37.8 36.1 50.9L32 54.6Z" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-end justify-between overflow-hidden p-3 ${className}`}
      style={{ background: palette.bg }}
    >
      {/* Artistic Vinyl / Silhouette Overlay matching Panel 6 */}
      <svg
        viewBox="0 0 120 120"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
        fill="none"
      >
        <circle cx="88" cy="36" r="42" stroke="#FFFFFF" strokeWidth="1.5" />
        <circle cx="88" cy="36" r="26" stroke="#FFFFFF" strokeWidth="1" />
        <circle cx="88" cy="36" r="10" fill="#FFFFFF" fillOpacity="0.4" />
        <path
          d="M10 120C18 86 42 74 68 88C88 98 104 94 120 76V120H10Z"
          fill="#060609"
          fillOpacity="0.65"
        />
      </svg>
      <span className="relative z-10 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-xs">
        Spotify
      </span>
    </div>
  );
};
