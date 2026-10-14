export function buildDemoMapSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="640" viewBox="0 0 1024 640">
  <defs>
    <radialGradient id="sea" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#1d3350"/>
      <stop offset="100%" stop-color="#132238"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="640" fill="url(#sea)"/>
  <path d="M120 300 Q240 180 420 220 Q600 250 660 180 Q720 120 820 170 Q900 210 860 330 Q820 450 700 470 Q560 500 470 440 Q330 480 250 420 Q130 380 120 300 Z"
        fill="#2e4d3a" stroke="#8a7322" stroke-width="3"/>
  <path d="M480 150 Q560 110 640 150 Q700 185 640 230 Q560 260 500 220 Q440 185 480 150 Z"
        fill="#35563f" stroke="#8a7322" stroke-width="2"/>
  <path d="M700 350 Q780 320 830 370 Q860 420 790 440 Q720 450 690 400 Q670 365 700 350 Z"
        fill="#28402f" stroke="#8a7322" stroke-width="2"/>
  <g stroke="#5d5d7a" stroke-width="1.2" opacity="0.5">
    <path d="M100 100 Q512 40 924 100" fill="none"/>
    <path d="M80 200 Q512 130 944 200" fill="none"/>
    <path d="M70 300 Q512 230 954 300" fill="none"/>
    <path d="M80 400 Q512 330 944 400" fill="none"/>
    <path d="M100 500 Q512 430 924 500" fill="none"/>
    <path d="M140 580 Q512 520 884 580" fill="none"/>
  </g>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
