import React from 'react';

export interface AppMainProps {
  header?: React.ReactNode;
  children: React.ReactNode;
}

export const PageContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="app-page-content">{children}</div>
);

export const AppMain: React.FC<AppMainProps> = ({ header, children }) => {
  return (
    <main id="main-content" className="app-main" tabIndex={-1}>
      <div className="app-main-container">
        {header}
        <PageContent>{children}</PageContent>
      </div>
    </main>
  );
};
