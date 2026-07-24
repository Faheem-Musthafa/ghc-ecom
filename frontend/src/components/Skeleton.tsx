import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
    <div className={`animate-pulse rounded-sm bg-gold-500/10 ${className}`} />
);

export const ProductCardSkeleton: React.FC = () => (
    <div className="border border-gold-500/20 bg-carbon p-4 rounded-sm">
        <Skeleton className="aspect-square w-full rounded-sm" />
        <Skeleton className="mt-4 h-5 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <div className="mt-4 flex justify-between">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-24 rounded-sm" />
        </div>
    </div>
);

export const TableRowSkeleton: React.FC<{ cols?: number }> = ({ cols = 5 }) => (
    <tr>
        {Array.from({ length: cols }).map((_, i) => (
            <td key={i} className="p-4">
                <Skeleton className="h-4 w-full" />
            </td>
        ))}
    </tr>
);
