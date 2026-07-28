import React, { FormEvent, useEffect, useState } from 'react';
import { Link, Redirect, useHistory } from 'react-router-dom';
import { IconAlert, IconArrowRight, IconCheckCircle, IconRefresh, IconShieldCheck, IconTruck } from '../components/Icons';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { api } from '../lib/api';
import { fallbackImage, rupees } from '../lib/commerce';
import { formatRazorpayContact, resolveCheckoutEmail } from '../lib/razorpay';
import { Address, CheckoutQuote, Order, ShippingAddressInput } from '../types';

declare global {
    interface Window {
        Razorpay: new (options: Record<string, unknown>) => { open: () => void };
    }
}

const loadRazorpay = () => new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay Checkout could not be loaded.'));
    document.head.appendChild(script);
});

const CheckoutPage = () => {
    const history = useHistory();
    const { cart, resetCart } = useCart();
    const { signedIn, session } = useAuth();
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [selectedAddress, setSelectedAddress] = useState('');
    const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'express'>('standard');
    const [quote, setQuote] = useState<CheckoutQuote | null>(null);
    const [loading, setLoading] = useState(false);
    const [processingPayment, setProcessingPayment] = useState(false);
    const [paymentFailed, setPaymentFailed] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!signedIn) return;
        api.addresses()
            .then((items) => {
                setAddresses(items);
                setSelectedAddress(items.find((item) => item.isDefault)?.id || items[0]?.id || '');
            })
            .catch(() => setAddresses([]));
    }, [signedIn]);

    if (!cart?.items.length) return <Redirect to="/cart" />;

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!cart) return;
        setLoading(true);
        setProcessingPayment(true);
        setPaymentFailed(false);
        setError('');

        const form = new FormData(event.currentTarget);
        const submittedEmail = form.get('email');
        const contactEmail = resolveCheckoutEmail(
            typeof submittedEmail === 'string' ? submittedEmail : null,
            session?.user?.email,
        );
        const shippingAddress: ShippingAddressInput = {
            recipientName: String(form.get('recipientName')),
            phone: String(form.get('phone')),
            line1: String(form.get('line1')),
            line2: String(form.get('line2') || ''),
            city: String(form.get('city')),
            state: String(form.get('state')),
            postalCode: String(form.get('postalCode')),
            country: 'IN',
        };

        try {
            let addressId = selectedAddress;
            if (signedIn && !addressId) {
                const address = await api.createAddress({ ...shippingAddress, label: 'Home', isDefault: true });
                addressId = address.id;
            }

            const createdQuote = await api.quote({
                cartId: cart.id,
                contactEmail,
                couponCode: String(form.get('couponCode') || '') || undefined,
                deliveryMethod,
                ...(signedIn ? { addressId } : { shippingAddress }),
            });

            setQuote(createdQuote);
            const intent = await api.paymentIntent(createdQuote.id);
            await loadRazorpay();
            const checkoutAddress = intent.checkout.shippingAddress;

            await new Promise<void>((resolve, reject) => {
                const checkout = new window.Razorpay({
                    key: intent.keyId,
                    amount: intent.amount,
                    currency: intent.currency,
                    order_id: intent.razorpayOrderId,
                    name: 'Glockery Home Centre',
                    description: `Order ${intent.orderNumber}`,
                    theme: { color: '#d4af37' },
                    prefill: {
                        email: checkoutAddress.email || contactEmail,
                        contact: formatRazorpayContact(checkoutAddress.phone, checkoutAddress.country),
                        name: checkoutAddress.recipientName,
                    },
                    handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
                        try {
                            const verified = await api.verifyPayment({
                                razorpayPaymentId: response.razorpay_payment_id,
                                razorpayOrderId: response.razorpay_order_id,
                                razorpaySignature: response.razorpay_signature,
                            });
                            resetCart();
                            history.push(`/order-confirmation/${verified.id}`);
                            resolve();
                        } catch (caught) {
                            reject(caught);
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            setPaymentFailed(true);
                            reject(new Error('Payment window closed before completion.'));
                        },
                    },
                });
                checkout.open();
            });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Checkout could not be completed.');
        } finally {
            setLoading(false);
            setProcessingPayment(false);
        }
    };

    const input = 'field h-12 w-full text-sm placeholder:text-cream/25';

    return (
        <div className="min-h-screen bg-obsidian text-cream">
            <SEOHead title="Secure Checkout | Glockery" />
            <header className="flex h-20 items-center justify-between gap-4 border-b border-line px-4 sm:px-10">
                <Link to="/" className="shrink-0 text-base font-bold tracking-[0.22em] text-cream sm:text-lg">GLOCKERY</Link>
                <span className="flex items-center gap-2 text-right text-[9px] uppercase tracking-[0.12em] text-cream/35 sm:text-[10px] sm:tracking-[0.18em]">
                    <IconShieldCheck size={15} className="shrink-0" /> Secure Razorpay Checkout
                </span>
            </header>
            <nav className="border-b border-line" aria-label="Checkout progress">
                <ol className="mx-auto flex max-w-[1240px] items-center gap-3 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] sm:px-10 lg:px-12">
                    <li className="text-cream/35">Bag</li><li className="text-cream/25" aria-hidden="true">/</li>
                    <li className="text-gold-300" aria-current="step">Delivery</li><li className="text-cream/25" aria-hidden="true">/</li>
                    <li className="text-cream/35">Payment</li>
                </ol>
            </nav>

            {/* Payment Processing Overlay */}
            {processingPayment && !paymentFailed && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-busy="true" aria-label="Payment processing">
                    <div className="w-full max-w-sm text-center border border-gold-500/30 bg-carbon p-8 rounded-sm shadow-2xl">
                        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold-400/10 text-gold-300">
                            <IconRefresh size={28} className="animate-spin" />
                        </div>
                        <h3 className="mt-4 font-display text-2xl text-cream">Processing Payment</h3>
                        <p className="mt-2 text-xs text-cream/60">Connecting with Razorpay gateway. Please do not close or refresh this page.</p>
                    </div>
                </div>
            )}

            <main id="main-content" className="mx-auto grid max-w-[1240px] gap-12 px-6 py-12 sm:px-10 lg:grid-cols-[1fr_420px] lg:px-12 lg:py-16">
                <form onSubmit={submit}>
                    <p className="eyebrow">Delivery &amp; payment</p>
                    <h1 className="mt-2 font-display text-5xl font-semibold">Complete your order</h1>

                    {paymentFailed && (
                        <div className="mt-6 border border-amber-500/30 bg-amber-950/20 p-5 rounded-sm flex items-start gap-4">
                            <IconAlert size={24} className="text-amber-400 shrink-0" />
                            <div>
                                <h4 className="font-bold text-amber-300 text-sm">Payment Window Cancelled</h4>
                                <p className="mt-1 text-xs text-cream/70">Your cart items and delivery details remain saved. Click below to retry payment.</p>
                            </div>
                        </div>
                    )}

                    {/* Address Selection / Form */}
                    {signedIn && addresses.length > 0 && (
                        <section className="mt-8">
                            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gold-400">Saved Delivery Address</p>
                            <select value={selectedAddress} onChange={(e) => setSelectedAddress(e.target.value)} className={input}>
                                {addresses.map((address) => (
                                    <option key={address.id} value={address.id}>
                                        {address.label} — {address.line1}, {address.city} ({address.postalCode})
                                    </option>
                                ))}
                            </select>
                        </section>
                    )}

                    {(!signedIn || addresses.length === 0) && (
                        <section className="mt-8 grid gap-4 sm:grid-cols-2">
                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Full Name</span>
                                <input className={input} name="recipientName" autoComplete="name" required />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Email Address</span>
                                <input className={input} name="email" type="email" autoComplete="email" defaultValue={session?.user?.email || ''} required />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Mobile Number</span>
                                <input className={input} name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={10} required />
                            </label>
                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Street Address</span>
                                <input className={input} name="line1" autoComplete="address-line1" required />
                            </label>
                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Apartment / Suite / Landmark</span>
                                <input className={input} name="line2" autoComplete="address-line2" />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">City</span>
                                <input className={input} name="city" autoComplete="address-level2" required />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">State</span>
                                <input className={input} name="state" autoComplete="address-level1" required />
                            </label>
                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">PIN Code</span>
                                <input className={input} name="postalCode" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{6}" required />
                            </label>
                        </section>
                    )}

                    {/* Delivery Method Selection */}
                    <fieldset className="mt-8 border-t border-gold-500/20 pt-6">
                        <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-gold-400">Select Delivery Method</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label
                                className={`flex items-center justify-between border p-4 cursor-pointer rounded-sm transition-all focus-within:ring-2 focus-within:ring-gold-400/70 ${
                                    deliveryMethod === 'standard' ? 'border-gold-400 bg-gold-400/10' : 'border-gold-500/20 bg-carbon'
                                }`}
                            >
                                <input type="radio" name="deliveryMethod" value="standard" checked={deliveryMethod === 'standard'} onChange={() => setDeliveryMethod('standard')} className="sr-only" />
                                <div className="flex items-center gap-3">
                                    <IconTruck size={20} className="text-gold-400" />
                                    <div>
                                        <p className="text-xs font-bold text-cream">Standard Delivery</p>
                                        <p className="text-[10px] text-cream/50">3 – 5 Business Days</p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-emerald-400">FREE</span>
                            </label>

                            <label
                                className={`flex items-center justify-between border p-4 cursor-pointer rounded-sm transition-all focus-within:ring-2 focus-within:ring-gold-400/70 ${
                                    deliveryMethod === 'express' ? 'border-gold-400 bg-gold-400/10' : 'border-gold-500/20 bg-carbon'
                                }`}
                            >
                                <input type="radio" name="deliveryMethod" value="express" checked={deliveryMethod === 'express'} onChange={() => setDeliveryMethod('express')} className="sr-only" />
                                <div className="flex items-center gap-3">
                                    <IconTruck size={20} className="text-gold-400" />
                                    <div>
                                        <p className="text-xs font-bold text-cream">Express Courier</p>
                                        <p className="text-[10px] text-cream/50">1 – 2 Business Days</p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-gold-300">₹250</span>
                            </label>
                        </div>
                    </fieldset>

                    {/* Coupon Code Input */}
                    <section className="mt-6">
                        <label className="block">
                            <span className="mb-1.5 block text-xs text-cream/60">Promo Coupon Code</span>
                            <input className={input} name="couponCode" placeholder="Enter coupon code (e.g. WELCOME10)" />
                        </label>
                    </section>

                    {error && <p className="mt-5 border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-200" role="alert">{error}</p>}

                    <button
                        disabled={loading}
                        className="button-primary mt-8 h-14 w-full gap-3 disabled:opacity-50"
                    >
                        {loading ? 'Preparing Razorpay Gateway…' : <>Pay Securely with Razorpay <IconArrowRight size={16} /></>}
                    </button>
                </form>

                {/* Order Summary Sidebar */}
                <aside className="h-fit border border-gold-500/25 bg-carbon p-6 rounded-sm lg:sticky lg:top-10">
                    <p className="text-[10px] uppercase tracking-[0.3em] font-semibold text-gold-400">Order Summary</p>
                    <div className="mt-4 divide-y divide-gold-500/15">
                        {cart?.items.map((item) => (
                            <article key={item.id} className="grid grid-cols-[60px_1fr_auto] items-center gap-3 py-3">
                                <img src={item.imageUrl || fallbackImage} alt="" className="aspect-square object-cover rounded-sm border border-gold-500/20 bg-obsidian" />
                                <div>
                                    <h4 className="text-xs font-medium text-cream">{item.productName}</h4>
                                    <p className="text-[10px] text-cream/40">{item.quantity} × {item.variantName}</p>
                                </div>
                                <strong className="text-xs font-semibold text-gold-300">{rupees(item.lineTotalPaise)}</strong>
                            </article>
                        ))}
                    </div>
                    <div className="mt-6 border-t border-gold-500/20 pt-4 space-y-2 text-xs text-cream/60">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{rupees(cart?.subtotalPaise || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Shipping</span>
                            <span>{quote ? rupees(quote.shippingPaise) : deliveryMethod === 'express' ? '₹250' : 'Calculated at checkout'}</span>
                        </div>
                        {quote && quote.discountPaise > 0 && (
                            <div className="flex justify-between text-emerald-400 font-medium">
                                <span>Promo Discount</span>
                                <span>-{rupees(quote.discountPaise)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-display text-xl text-gold-300 pt-2 border-t border-gold-500/15 font-normal">
                            <span>Total Payable</span>
                            <span>{rupees(quote?.totalPaise || cart?.subtotalPaise || 0)}</span>
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
};
export default CheckoutPage;
