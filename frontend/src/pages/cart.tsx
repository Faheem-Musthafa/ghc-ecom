import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { IconArrowRight, IconMinus, IconPackage, IconPlus, IconShieldCheck, IconTrash, IconTruck } from '../components/Icons';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';
import { useCart } from '../contexts/CartContext';
import { fallbackImage, rupees } from '../lib/commerce';

const FREE_DELIVERY_THRESHOLD_PAISE = 100000; // ₹1,000

const CartPage = () => {
    const { cart, loading, error, updateQuantity, removeItem } = useCart();
    const items = cart?.items || [];
    const subtotal = cart?.subtotalPaise || 0;
    const amountNeeded = FREE_DELIVERY_THRESHOLD_PAISE - subtotal;
    const progressPercent = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD_PAISE) * 100);

    return (
        <div className="min-h-screen bg-obsidian text-cream font-body flex flex-col justify-between">
            <SEOHead title="Your Shopping Bag | Glockery Home Centre" />
            <Header />

            <main id="main-content" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-16">
                <header className="mb-10 flex flex-col items-start justify-between gap-4 border-y border-line py-8 sm:flex-row sm:items-end">
                    <div>
                        <span className="eyebrow">Your selection</span>
                        <h1 className="mt-1 font-display text-5xl font-semibold text-cream">Shopping bag</h1>
                    </div>
                    <Link to="/" className="text-xs font-semibold uppercase tracking-wider text-gold-300 hover:text-gold-100">
                        Continue shopping
                    </Link>
                </header>

                {/* Free Delivery Bar */}
                {items.length > 0 && (
                    <div className="mb-8 rounded-sm border border-gold-500/20 bg-carbon p-4 shadow-md">
                        <div className="flex items-center justify-between text-xs mb-2">
                            <span className="flex items-center gap-2 text-cream/80">
                                <IconTruck size={16} className="text-gold-400 shrink-0" />
                                {amountNeeded <= 0 ? (
                                    <strong className="font-bold text-gold-300">Complimentary delivery applied</strong>
                                ) : (
                                    <span>Add <strong className="text-gold-300 font-bold">{rupees(amountNeeded)}</strong> more to unlock Free Express Delivery</span>
                                )}
                            </span>
                            <span className="text-gold-400 font-bold font-mono">{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="h-2 w-full bg-obsidian rounded-full overflow-hidden border border-gold-500/20">
                            <div className="h-full bg-gold-400 transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
                        </div>
                    </div>
                )}

                {error && <p className="mb-6 rounded-sm border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-200">{error}</p>}

                {!items.length && !loading ? (
                    <div className="rounded-sm border border-gold-500/20 bg-carbon py-24 text-center shadow-xl">
                        <div className="mx-auto mb-4 grid size-16 place-items-center border border-gold-500/30 bg-obsidian text-gold-400">
                            <IconPackage size={32} />
                        </div>
                        <h2 className="font-display text-3xl font-bold text-cream">Nothing here—yet.</h2>
                        <p className="mx-auto mt-2 max-w-sm text-xs text-cream/50">Explore tableware, serveware, and living objects selected for everyday use.</p>
                        <Link to="/" className="mt-8 inline-flex items-center gap-2 rounded-sm bg-gold-400 px-7 py-3 text-xs font-bold uppercase tracking-wider text-obsidian shadow-md hover:bg-gold-300 transition">
                            Explore collection <IconArrowRight size={15} />
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-8 lg:grid-cols-12">
                        {/* Items List */}
                        <div className="lg:col-span-8 space-y-4">
                            {items.map((item) => (
                                <article key={item.id} className="rounded-sm border border-gold-500/20 bg-carbon p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-md hover:border-gold-400/40 transition">
                                    <div className="flex items-center gap-5">
                                        <img
                                            src={item.imageUrl || fallbackImage}
                                            alt={item.productName}
                                            className="aspect-[4/5] w-20 object-cover rounded-sm border border-gold-500/20 bg-obsidian"
                                            onError={(e) => { e.currentTarget.src = fallbackImage; }}
                                        />
                                        <div>
                                            <span className="text-[9px] uppercase tracking-[0.2em] font-mono text-gold-400">{item.sku}</span>
                                            <h3 className="font-display text-xl font-bold text-cream mt-0.5">{item.productName}</h3>
                                            <p className="text-xs text-cream/50 mt-1">{item.variantName}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between w-full sm:w-auto sm:gap-8 pt-4 sm:pt-0 border-t sm:border-t-0 border-gold-500/15">
                                        <div className="flex h-10 border border-gold-500/30 bg-obsidian rounded-sm">
                                            <button
                                                disabled={loading}
                                                className="grid w-10 place-items-center text-cream/60 hover:text-gold-300 transition"
                                                onClick={() => void updateQuantity(item.variantId, item.quantity - 1)}
                                                aria-label="Decrease quantity"
                                            >
                                                <IconMinus size={13} />
                                            </button>
                                            <span className="grid w-8 place-items-center text-xs font-bold text-cream font-mono">{item.quantity}</span>
                                            <button
                                                disabled={loading}
                                                className="grid w-10 place-items-center text-cream/60 hover:text-gold-300 transition"
                                                onClick={() => void updateQuantity(item.variantId, item.quantity + 1)}
                                                aria-label="Increase quantity"
                                            >
                                                <IconPlus size={13} />
                                            </button>
                                        </div>

                                        <strong className="font-display text-xl font-bold text-gold-300 tracking-tight">
                                            {rupees(item.lineTotalPaise)}
                                        </strong>

                                        <button
                                            onClick={() => void removeItem(item.variantId)}
                                            className="p-2 text-red-400 hover:text-red-300 transition"
                                            title="Remove item"
                                            aria-label={`Remove ${item.productName}`}
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>

                        {/* Order Summary Sidebar */}
                        <aside className="lg:col-span-4 rounded-sm border border-gold-500/20 bg-carbon p-6 shadow-xl h-fit lg:sticky lg:top-28">
                            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-gold-400">Order Summary</span>

                            <div className="mt-6 space-y-3 border-b border-gold-500/15 pb-5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-cream/60">Subtotal</span>
                                    <strong className="font-bold text-cream font-mono">{rupees(cart?.subtotalPaise || 0)}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-cream/60">Estimated Shipping</span>
                                    <span className="text-gold-300 font-semibold">{amountNeeded <= 0 ? 'FREE' : 'Calculated at checkout'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-cream/60">GST Taxes</span>
                                    <span className="text-cream/40">Included</span>
                                </div>
                            </div>

                            <div className="mt-5 flex justify-between items-baseline">
                                <span className="font-display text-lg font-bold text-cream">Total</span>
                                <strong className="font-display text-3xl font-bold text-gold-300">{rupees(cart?.subtotalPaise || 0)}</strong>
                            </div>

                            <Link
                                to="/checkout"
                                className="mt-6 flex h-12 w-full items-center justify-center gap-2 bg-gold-400 text-xs font-bold uppercase tracking-[0.2em] text-obsidian hover:bg-gold-300 rounded-sm shadow-md transition"
                            >
                                Continue Securely <IconArrowRight size={16} />
                            </Link>

                            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.14em] text-cream/40">
                                <IconShieldCheck size={14} className="text-gold-400" /> Razorpay 256-bit SSL Protected
                            </div>
                        </aside>
                    </div>
                )}
            </main>

            <StoreFooter />
        </div>
    );
};

export default CartPage;
