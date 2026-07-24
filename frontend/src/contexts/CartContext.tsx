import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError, getCartIdentity, getSession, saveCartIdentity } from '../lib/api';
import { Cart, ProductVariant } from '../types';

interface CartContextValue {
    cart: Cart | null;
    itemCount: number;
    loading: boolean;
    error: string;
    isCartOpen: boolean;
    toastMessage: string | null;
    addVariant: (variant: ProductVariant, quantity?: number) => Promise<void>;
    updateQuantity: (variantId: string, quantity: number) => Promise<void>;
    removeItem: (variantId: string) => Promise<void>;
    refreshCart: () => Promise<Cart | null>;
    resetCart: () => void;
    openCart: () => void;
    closeCart: () => void;
    toggleCart: () => void;
    clearToast: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider = ({ children }: { children: ReactNode }) => {
    const [cart, setCart] = useState<Cart | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isCartOpen, setCartOpen] = useState(false);
    const [toastMessage, setToast] = useState<string | null>(null);

    const ensureCart = useCallback(async () => {
        const identity = getCartIdentity();
        if (identity) {
            try {
                const current = await api.getCart(identity.cartId);
                setCart(current);
                return current;
            } catch (caught) {
                if (!(caught instanceof ApiError) || ![401, 404].includes(caught.status)) throw caught;
                saveCartIdentity(null);
            }
        }
        const created = await api.createCart();
        saveCartIdentity({ cartId: created.cart.id, guestToken: created.guestToken });
        setCart(created.cart);
        return created.cart;
    }, []);

    const refreshCart = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            return await ensureCart();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to load your bag.');
            return null;
        } finally {
            setLoading(false);
        }
    }, [ensureCart]);

    useEffect(() => { void refreshCart(); }, [refreshCart]);
    useEffect(() => {
        const reset = () => { setCart(null); void refreshCart(); };
        window.addEventListener('ghc:cart-reset', reset);
        return () => window.removeEventListener('ghc:cart-reset', reset);
    }, [refreshCart]);

    const mutate = async (task: (active: Cart) => Promise<Cart>) => {
        setLoading(true);
        setError('');
        try {
            const active = cart || await ensureCart();
            const next = await task(active);
            setCart(next);
            return next;
        } catch (caught) {
            const message = caught instanceof Error ? caught.message : 'Unable to update your bag.';
            setError(message);
            throw caught;
        } finally {
            setLoading(false);
        }
    };

    const addVariant = async (variant: ProductVariant, quantity = 1) => {
        const current = cart?.items.find((item) => item.variantId === variant.id)?.quantity || 0;
        await mutate((active) => api.setCartItem(active.id, variant.id, Math.min(99, current + quantity)));
        setToast(`${variant.name} added to your bag`);
        setCartOpen(true);
    };

    const updateQuantity = async (variantId: string, quantity: number) => {
        if (quantity <= 0) return removeItem(variantId);
        await mutate((active) => api.setCartItem(active.id, variantId, quantity));
    };

    const removeItem = async (variantId: string) => {
        await mutate((active) => api.removeCartItem(active.id, variantId));
    };

    const resetCart = () => {
        saveCartIdentity(null);
        setCart(null);
        void refreshCart();
    };

    return (
        <CartContext.Provider value={{
            cart,
            itemCount: cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0,
            loading,
            error,
            isCartOpen,
            toastMessage,
            addVariant,
            updateQuantity,
            removeItem,
            refreshCart,
            resetCart,
            openCart: () => setCartOpen(true),
            closeCart: () => setCartOpen(false),
            toggleCart: () => setCartOpen((value) => !value),
            clearToast: () => setToast(null),
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const value = useContext(CartContext);
    if (!value) throw new Error('useCart must be used inside CartProvider');
    return value;
};
