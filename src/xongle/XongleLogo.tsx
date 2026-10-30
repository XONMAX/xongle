import React from 'react';

interface XongleLogoProps {
  size?: number;
  className?: string;
  imgSrc?: string;
}

export const XongleLogo: React.FC<XongleLogoProps> = ({
  size = 38,
  className = '',
  imgSrc = '/favicon.png',
}) => {
  return (
    <img
      src={imgSrc}
      alt="Xongle Logo"
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      className={`inline-block object-contain shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
