import type { SVGProps, ReactNode } from 'react';
type Props = SVGProps<SVGSVGElement> & { size?: number };
function Icon({children,size=24,strokeWidth=1.65,...props}:Props & {children:ReactNode}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>; }
export function StrawHatIcon(props:Props) { return <Icon {...props}><ellipse cx="12" cy="16" rx="10" ry="3.5"/><path d="M6 15v-2a6 6 0 0 1 12 0v2M6 12c3 2 9 2 12 0M10 7v3m4-3v3"/></Icon>; }
export function LogPoseIcon(props:Props) { return <Icon {...props}><path d="M8 3h8l1 4M8 21h8l1-4M7 7l1-4m-1 14 1 4"/><circle cx="12" cy="12" r="7"/><path d="m15 8-2 5-4 3 2-5 4-3Z"/><path d="M12 5V3m7 9h2"/></Icon>; }
export function TreasureMapIcon(props:Props) { return <Icon {...props}><path d="m3 5 6-2 6 3 6-2v16l-6 2-6-3-6 2V5Zm6-2v16m6-13v16"/><path d="m16.5 10 3 3m0-3-3 3M5 15c2-4 3 1 6-3" strokeDasharray="1 2"/></Icon>; }
export function SnailPhoneIcon(props:Props) { return <Icon {...props}><path d="M3 18h18v3H3zM6 18v-5c0-5 9-6 12-2s-1 7-5 7"/><path d="M13 17c-5 0-5-6-1-6 3 0 3 4 1 4M5 13l-2-3V7m4 5 1-3V6"/><circle cx="3" cy="5" r="1.5"/><circle cx="8" cy="4" r="1.5"/><path d="M3 15h2"/></Icon>; }
export function DevilFruitIcon(props:Props) { return <Icon {...props}><path d="M12 6c-8-5-14 11-4 15l4-1 4 1c10-4 4-20-4-15Zm0 0c-1-4 2-5 5-3M12 6c-2-4-4-4-6-3"/><path d="M7 9c-3 0-3 4 0 4s3 4 0 4m9-8c-3 0-3 4 0 4s3 4 0 4M11 11c-2 0-2 4 0 4s2 3 0 4"/></Icon>; }
export function TreasureChestIcon(props:Props) { return <Icon {...props}><path d="M3 11V8c0-3 18-3 18 0v3M3 11h18v9H3v-9Zm3 0V7m12 4V7M6 12v8m12-8v8"/><path d="M10 10h4v5h-4z"/></Icon>; }
export function VivreCardIcon(props:Props) { return <Icon {...props}><path d="m7 3 12 2-2 17-12-2 2-17ZM5 7 2 8l3 13"/><path d="m10 7 6 1m-6 3 5 1m-6 3 4 1M14 18h1"/></Icon>; }
export function ThreeSwordsIcon(props:Props) { return <Icon {...props}><path d="m5 3 15 15m-3 0 3-3m-1 4 2 2M19 3 4 18m0-3 3 3m-2 1-2 2M12 2v15m-3 0h6m-3 1v4"/><path d="M5 3v4m0-4h4m10 0v4m0-4h-4"/></Icon>; }
export function BountyPosterIcon(props:Props) { return <Icon {...props}><path d="M4 2h16v20H4zM7 5h10M7 18h10"/><circle cx="12" cy="10" r="3"/><path d="M8 15c1-3 7-3 8 0"/></Icon>; }
export function CaptainLogIcon(props:Props) { return <Icon {...props}><path d="M5 3h12a2 2 0 0 1 2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 0v18m3-15h7m-7 3h4"/><path d="m11 17 1-4 7-7 3 3-7 7-4 1Z"/></Icon>; }
