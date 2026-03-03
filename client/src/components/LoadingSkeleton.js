import React from 'react';

const LoadingSkeleton = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="loading-skeleton aspect-square rounded-lg" />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
