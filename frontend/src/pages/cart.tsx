import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { IconArrowRight, IconMinus, IconPackage, IconPlus, IconShieldCheck } from '../components/Icons';
import StoreFooter from '../components/StoreFooter';
import SEOHead from '../components/SEOHead';
import { useCart } from '../contexts/CartContext';
import { fallbackImage, rupees } from '../lib/commerce';

const CartPage = () => {
    const { cart, loading, error, updateQuantity, removeItem } = useCart();
    const items = cart?.items || [];
    return (
        <div className="min-h-screen bg-obsidian text-cream"><SEOHead title="Shopping bag | Glockery" /><Header />
            <main id="main-content" className="mx-auto max-w-[1280px] px-6 py-14 sm:px-10 lg:px-12 lg:py-20">
                <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">Your selection</p><h1 className="mt-4 font-display text-6xl">Shopping bag.</h1>
                {error && <p className="mt-6 border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">{error}</p>}
                {!items.length && !loading ? <div className="mt-14 grid min-h-[420px] place-content-center border border-gold-500/20 bg-carbon text-center"><IconPackage className="mx-auto text-gold-400" size={44} /><h2 className="mt-6 font-display text-4xl">Nothing here—yet.</h2><Link to="/" className="mt-7 inline-flex h-12 items-center justify-center bg-gold-400 px-6 text-xs font-bold uppercase tracking-[0.2em] text-obsidian">Explore collection</Link></div> :
                    <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_380px]">
                        <div className="divide-y divide-gold-500/20 border-y border-gold-500/20">
                            {items.map((item) => <article key={item.id} className="grid gap-6 py-7 sm:grid-cols-[130px_1fr]">
                                <img src={item.imageUrl || fallbackImage} alt={item.productName} className="aspect-[4/5] w-full object-cover" />
                                <div className="flex min-w-0 flex-col justify-between">
                                    <div className="flex items-start justify-between gap-4"><div><p className="text-[9px] uppercase tracking-[0.22em] text-gold-400">{item.sku}</p><h2 className="mt-2 font-display text-2xl">{item.productName}</h2><p className="mt-2 text-sm text-cream/40">{item.variantName}</p></div><button onClick={() => void removeItem(item.variantId)} className="text-xs text-cream/40 hover:text-gold-300">Remove</button></div>
                                    <div className="mt-6 flex items-center justify-between"><div className="flex h-11 border border-gold-500/25"><button className="grid w-11 place-items-center" onClick={() => void updateQuantity(item.variantId, item.quantity - 1)}><IconMinus size={13} /></button><span className="grid w-10 place-items-center text-sm">{item.quantity}</span><button className="grid w-11 place-items-center" onClick={() => void updateQuantity(item.variantId, item.quantity + 1)}><IconPlus size={13} /></button></div><strong className="font-display text-2xl font-normal text-gold-300">{rupees(item.lineTotalPaise)}</strong></div>
                                </div>
                            </article>)}
                        </div>
                        <aside className="h-fit border border-gold-500/25 bg-carbon p-7 lg:sticky lg:top-32"><p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">Order summary</p><div className="mt-7 flex justify-between border-b border-gold-500/15 pb-5 text-sm"><span className="text-cream/45">Subtotal</span><strong className="font-normal">{rupees(cart?.subtotalPaise || 0)}</strong></div><p className="mt-5 text-xs leading-6 text-cream/40">Delivery, discount, and GST are calculated securely by the backend at checkout.</p><Link to="/checkout" className="mt-7 flex h-14 items-center justify-center gap-3 bg-gold-400 text-xs font-bold uppercase tracking-[0.2em] text-obsidian hover:bg-gold-300">Continue securely <IconArrowRight size={17} /></Link><p className="mt-5 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.14em] text-cream/35"><IconShieldCheck size={14} /> Razorpay protected</p></aside>
                    </div>}
            </main><StoreFooter />
        </div>
    );
};
export default CartPage;
