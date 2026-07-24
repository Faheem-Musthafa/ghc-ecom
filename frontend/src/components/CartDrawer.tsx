import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { fallbackImage, rupees } from '../lib/commerce';
import { IconArrowRight, IconClose, IconMinus, IconPackage, IconPlus, IconTruck } from './Icons';

const FREE_DELIVERY_THRESHOLD_PAISE = 100000; // ₹1,000

const CartDrawer = () => {
    const { cart, error, isCartOpen, closeCart, updateQuantity, removeItem, loading } = useCart();

    useEffect(() => {
        if (!isCartOpen) return;
        const key = (event: KeyboardEvent) => event.key === 'Escape' && closeCart();
        window.addEventListener('keydown', key);
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', key); document.body.style.overflow = ''; };
    }, [isCartOpen, closeCart]);

    if (!isCartOpen) return null;
    const items = cart?.items || [];
    const subtotal = cart?.subtotalPaise || 0;
    const progressPercent = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD_PAISE) * 100);
    const amountNeeded = FREE_DELIVERY_THRESHOLD_PAISE - subtotal;

    return (
        <div className="fixed inset-0 z-50">
            <button className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={closeCart} aria-label="Close bag" />
            <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-gold-500/30 bg-carbon shadow-2xl shadow-black animate-slide-left" role="dialog" aria-modal="true" aria-labelledby="bag-title">
                <header className="flex items-center justify-between border-b border-gold-500/20 px-6 py-6 sm:px-8">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.28em] text-gold-400">Your selection</p>
                        <h2 id="bag-title" className="mt-1 font-display text-3xl text-cream">The bag <span className="text-gold-400">({items.length})</span></h2>
                    </div>
                    <button className="grid size-11 place-items-center border border-gold-500/25 text-cream/70 hover:text-gold-300 rounded-sm" onClick={closeCart} aria-label="Close"><IconClose /></button>
                </header>

                {/* Free Delivery Progress Bar */}
                {items.length > 0 && (
                    <div className="border-b border-gold-500/15 bg-obsidian/70 px-6 py-3 sm:px-8">
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                            <span className="flex items-center gap-1.5 text-cream/70">
                                <IconTruck size={14} className="text-gold-400" />
                                {amountNeeded <= 0 ? (
                                    <strong className="text-gold-300">You unlocked Free Delivery!</strong>
                                ) : (
                                    <span>Add <strong className="text-gold-300">{rupees(amountNeeded)}</strong> more for Free Delivery</span>
                                )}
                            </span>
                            <span className="text-gold-400 font-bold">{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-line rounded-full overflow-hidden">
                            <div className="h-full bg-gold-400 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                        </div>
                    </div>
                )}

                {error && <p className="border-b border-red-500/30 bg-red-950/40 px-6 py-3 text-sm text-red-200">{error}</p>}

                <div className="flex-1 overflow-y-auto px-6 py-2 sm:px-8">
                    {items.length === 0 ? (
                        <div className="grid h-full place-content-center text-center">
                            <IconPackage size={42} className="mx-auto text-gold-400" />
                            <h3 className="mt-6 font-display text-3xl text-cream">Your bag awaits.</h3>
                            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-cream/50">Explore statement tableware made for evenings worth remembering.</p>
                            <button onClick={closeCart} className="mx-auto mt-8 border border-gold-400 bg-gold-400 px-6 py-3 text-xs font-bold uppercase tracking-[0.18em] text-obsidian hover:bg-gold-300 rounded-sm">Explore collection</button>
                        </div>
                    ) : items.map((item) => (
                        <article key={item.id} className="grid grid-cols-[88px_1fr] gap-5 border-b border-gold-500/15 py-6">
                            <img src={item.imageUrl || fallbackImage} alt={item.productName} className="aspect-[4/5] h-full w-full object-cover rounded-sm border border-gold-500/20" />
                            <div className="flex min-w-0 flex-col justify-between">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[9px] uppercase tracking-[0.2em] text-gold-400">{item.sku}</p>
                                        <h3 className="mt-1 font-display text-xl text-cream">{item.productName}</h3>
                                        <p className="mt-0.5 text-xs text-cream/45">{item.variantName}</p>
                                    </div>
                                    <button disabled={loading} onClick={() => void removeItem(item.variantId)} className="text-xs text-cream/40 underline-offset-4 hover:text-gold-300 hover:underline">Remove</button>
                                </div>
                                <div className="mt-5 flex items-center justify-between">
                                    <div className="flex h-9 items-center border border-gold-500/25 rounded-sm">
                                        <button disabled={loading} className="grid size-9 place-items-center hover:text-gold-300" onClick={() => void updateQuantity(item.variantId, item.quantity - 1)} aria-label="Decrease quantity"><IconMinus size={13} /></button>
                                        <span className="w-8 text-center text-sm font-bold text-cream">{item.quantity}</span>
                                        <button disabled={loading} className="grid size-9 place-items-center hover:text-gold-300" onClick={() => void updateQuantity(item.variantId, item.quantity + 1)} aria-label="Increase quantity"><IconPlus size={13} /></button>
                                    </div>
                                    <strong className="font-normal text-gold-300">{rupees(item.lineTotalPaise)}</strong>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
                {items.length > 0 && (
                    <footer className="border-t border-gold-500/20 bg-obsidian px-6 py-6 sm:px-8">
                        <div className="mb-5 flex items-end justify-between">
                            <span className="text-sm text-cream/55">Subtotal<small className="mt-1 block text-[10px]">Tax & Shipping calculated at checkout</small></span>
                            <strong className="font-display text-3xl font-normal text-gold-300">{rupees(cart?.subtotalPaise || 0)}</strong>
                        </div>
                        <Link to="/checkout" onClick={closeCart} className="flex h-14 items-center justify-center gap-3 bg-gold-400 text-xs font-bold uppercase tracking-[0.2em] text-obsidian hover:bg-gold-300 rounded-sm gold-glow transition">
                            Secure checkout <IconArrowRight size={17} />
                        </Link>
                    </footer>
                )}
            </aside>
        </div>
    );
};

export default CartDrawer;
