import React from 'react';

const Skeleton = ({ className = "", variant = "rect", width, height }) => {
  const baseClass = "animate-shimmer bg-slate-800/50 relative overflow-hidden";
  
  const variants = {
    rect: "rounded-lg",
    circle: "rounded-full",
    text: "rounded h-4 w-full mb-2",
  };

  const style = {
    width: width ? width : undefined,
    height: height ? height : undefined,
  };

  return (
    <div 
      className={`${baseClass} ${variants[variant]} ${className}`} 
      style={style}
    />
  );
};

export default Skeleton;
