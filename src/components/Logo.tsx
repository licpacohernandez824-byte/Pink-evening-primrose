import React from 'react';

export default function Logo({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 150" 
      fill="currentColor" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon points="12,20 88,20 50,60" />
      
      {/* 5 vertical lines */}
      <rect x="20" y="70" width="6" height="60" />
      
      {/* 2nd line */}
      <rect x="34" y="70" width="6" height="20" />
      <rect x="34" y="105" width="6" height="25" />
      
      {/* 3rd line (Center) */}
      <rect x="47" y="70" width="6" height="15" />
      <rect x="47" y="95" width="6" height="25" />
      <rect x="47" y="130" width="6" height="20" />
      
      {/* 4th line */}
      <rect x="60" y="70" width="6" height="42" />
      <rect x="60" y="122" width="6" height="8" />
      
      {/* 5th line */}
      <rect x="74" y="70" width="6" height="60" />
      
      {/* Horizontal connections */}
      <rect x="34" y="90" width="16" height="5" />
      <rect x="47" y="112" width="16" height="5" />
    </svg>
  );
}
