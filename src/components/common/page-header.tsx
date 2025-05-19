import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  action?: ReactNode;
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      {action && <div>{action}</div>}
    </div>
  );
}
