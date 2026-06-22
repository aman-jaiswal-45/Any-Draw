import React from "react";

export default function Logo({ className = "h-10", colorMode }) {
  const textClass = colorMode === "dark"
    ? "fill-white"
    : colorMode === "light"
      ? "fill-slate-900"
      : "fill-slate-900 dark:fill-white";

  const subTextClass = colorMode === "dark"
    ? "fill-slate-300"
    : colorMode === "light"
      ? "fill-slate-500"
      : "fill-slate-500 dark:fill-slate-400";

  return (
    <svg
      viewBox="0 0 780 210"
      className={`${className} select-none`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="210" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <g transform="translate(10,10)">
        {/* Rounded gradient background box */}
        <rect x="0" y="0" width="190" height="190" rx="48" fill="url(#logoGrad)" />
        {/* Canvas drawing path */}
        <path
          d="M35 125 C 60 70, 130 70, 155 125"
          fill="none"
          stroke="#ffffff"
          strokeWidth="14"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* Pencil symbol */}
        <g transform="translate(110,65) rotate(35)">
          <rect x="-8" y="4" width="60" height="16" rx="8" fill="#f59e0b" />
          <rect x="38" y="2" width="14" height="20" rx="6" fill="#ffffff" />
          <polygon points="-8,4 -18,12 -8,20" fill="#fcd34d" />
          <polygon points="-18,12 -24,12 -21,11 -24,13 -18,12" fill="#1e293b" />
        </g>
      </g>
      {/* Brand Text - Theme adaptive */}
      <text
        x="235"
        y="110"
        fontSize="76"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        className={`${textClass} font-black`}
      >
        Any Draw
      </text>
      {/* Subtitle - Theme adaptive */}
      <text
        x="237"
        y="155"
        fontSize="24"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="500"
        className={subTextClass}
        letterSpacing="1"
      >
        Collaborate • Sketch • Share
      </text>
    </svg>
  );
}
