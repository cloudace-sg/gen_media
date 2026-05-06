import React from 'react';

export default function PageHeader({ title, subtitle, right }) {
  return (
    <header className="mb-4 md:mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-dark-text">{title}</h1>
          {subtitle ? <p className="text-sm text-dark-text-secondary mt-1">{subtitle}</p> : null}
        </div>
        {right || null}
      </div>
    </header>
  );
}


