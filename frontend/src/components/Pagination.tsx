import React from 'react';
import { IconChevronLeft, IconChevronRight } from './Icons';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-2 py-6">
            <button
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="flex size-9 items-center justify-center rounded-sm border border-gold-500/25 bg-carbon text-cream transition-colors hover:border-gold-400 disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Previous Page"
            >
                <IconChevronLeft size={16} />
            </button>

            <span className="px-4 font-mono text-xs text-cream/70">
                Page <strong className="text-gold-300 font-bold">{currentPage}</strong> of <strong className="text-cream font-bold">{totalPages}</strong>
            </span>

            <button
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="flex size-9 items-center justify-center rounded-sm border border-gold-500/25 bg-carbon text-cream transition-colors hover:border-gold-400 disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Next Page"
            >
                <IconChevronRight size={16} />
            </button>
        </div>
    );
};
export default Pagination;
