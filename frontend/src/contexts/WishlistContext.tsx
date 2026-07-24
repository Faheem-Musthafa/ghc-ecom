import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

const WISHLIST_KEY = 'ghc_wishlist';

interface WishlistContextValue {
    wishlistIds: string[];
    toggleWishlist: (productId: string) => void;
    isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
        try {
            const raw = localStorage.getItem(WISHLIST_KEY);
            return raw ? (JSON.parse(raw) as string[]) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlistIds));
        } catch {
            // Ignore storage errors
        }
    }, [wishlistIds]);

    const toggleWishlist = (productId: string) => {
        setWishlistIds((prev) =>
            prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
        );
    };

    const isInWishlist = (productId: string) => wishlistIds.includes(productId);

    return (
        <WishlistContext.Provider value={{ wishlistIds, toggleWishlist, isInWishlist }}>
            {children}
        </WishlistContext.Provider>
    );
};

export const useWishlist = () => {
    const context = useContext(WishlistContext);
    if (!context) {
        return { wishlistIds: [], toggleWishlist: () => {}, isInWishlist: () => false };
    }
    return context;
};
