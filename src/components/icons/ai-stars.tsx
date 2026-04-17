'use client';

import type { SVGProps } from 'react';

export function AiStarsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none" {...props}>
      <path
        d="M24.9999 15L18.3333 12.5L24.9999 9.9975L27.4999 3.33336L30.0022 9.9975L36.6665 12.5L30.0022 15L27.4999 21.6666L24.9999 15ZM11.6665 28.3334L3.33325 25L11.6665 21.6666L14.9999 13.3334L18.3333 21.6666L26.6665 25L18.3333 28.3334L14.9999 36.6666L11.6665 28.3334Z"
        fill="url(#paint0_linear_2569_15006)"
      />
      <defs>
        <linearGradient
          id="paint0_linear_2569_15006"
          x1="19.9999"
          y1="3.33336"
          x2="19.9999"
          y2="36.6666"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0F77D9" />
          <stop offset="1" stopColor="#87F4B5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default AiStarsIcon;
