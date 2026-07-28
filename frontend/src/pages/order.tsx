import React, { FormEvent, useEffect, useState } from 'react';
import { Link, Redirect, useParams } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import { IconCheckCircle, IconDownload, IconMapPin } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { fallbackImage, rupees, shortDate, titleCase } from '../lib/commerce';
import { openTrustedUrl } from '../lib/navigation';
import { Order } from '../types';

const OrderDetailPage = () => {
    const { signedIn } = useAuth();
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<Order | null>(null);
    const [error, setError] = useState('');
    const [returnOpen, setReturnOpen] = useState(false);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        if (signedIn) {
            api.order(orderId)
                .then(setOrder)
                .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load order.'));
        }
    }, [orderId, signedIn]);

    if (!signedIn) return <Redirect to="/auth" />;

    const download = async () => {
        try {
            const result = await api.invoice(orderId);
            if (!openTrustedUrl(result.url)) throw new Error('Invoice URL was rejected');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Invoice is not ready.');
        }
    };

    const returnOrder = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const reason = String(new FormData(event.currentTarget).get('reason'));
        try {
            await api.createReturn(orderId, reason);
            setReturnOpen(false);
            setNotice('Your return request was submitted for review.');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to create return.');
        }
    };

    return (
        <AccountShell
            title={order?.orderNumber || 'Order Detail'}
            intro={order ? `Placed ${shortDate(order.createdAt)} · Status: ${titleCase(order.status)}` : 'Loading your order details from backend.'}
        >
            {error && <p className="mb-5 rounded-sm border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-200">{error}</p>}
            {notice && (
                <p className="mb-5 flex items-center gap-2 rounded-sm border border-gold-500/30 bg-gold-950/20 p-4 text-xs font-semibold text-gold-200">
                    <IconCheckCircle color="#D4AF37" /> {notice}
                </p>
            )}

            {order && (
                <>
                    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                        <section className="rounded-sm border border-gold-500/20 bg-carbon p-6 shadow-xl">
                            <div className="flex items-center justify-between border-b border-gold-500/15 pb-4">
                                <span className="rounded-sm border border-gold-400/40 bg-gold-400/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.24em] text-gold-300">
                                    {titleCase(order.status)}
                                </span>
                                {order.invoice && (
                                    <button onClick={() => void download()} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-300 hover:text-gold-200 transition">
                                        <IconDownload size={15} /> Download Invoice
                                    </button>
                                )}
                            </div>

                            <div className="divide-y divide-gold-500/15 my-4">
                                {order.itemsSnapshot.map((item) => (
                                    <article key={item.id || item.variantId} className="grid grid-cols-[72px_1fr_auto] items-center gap-5 py-5">
                                        <img
                                            src={item.imageUrl || fallbackImage}
                                            alt=""
                                            className="aspect-square object-cover rounded-sm border border-gold-500/20 bg-obsidian"
                                        />
                                        <div>
                                            <h2 className="font-display text-xl font-bold text-cream">{item.productName}</h2>
                                            <p className="mt-1 text-xs text-cream/45">{item.quantity} × {item.variantName}</p>
                                        </div>
                                        <strong className="font-display text-lg font-bold text-gold-300">{rupees(item.lineTotalPaise)}</strong>
                                    </article>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-gold-500/15 flex justify-between items-center">
                                <button onClick={() => setReturnOpen(true)} className="text-xs uppercase tracking-[0.18em] font-bold text-gold-300 hover:underline">
                                    Request Return
                                </button>
                            </div>
                        </section>

                        <aside className="rounded-sm border border-gold-500/20 bg-carbon p-6 shadow-xl h-fit">
                            <div className="flex items-center gap-2 text-gold-400 border-b border-gold-500/15 pb-3">
                                <IconMapPin size={18} />
                                <h2 className="font-display text-xl font-bold text-cream">Delivery Address</h2>
                            </div>
                            <p className="mt-4 text-xs leading-relaxed text-cream/65">
                                <strong className="block text-cream font-semibold">{order.addressSnapshot.recipientName}</strong>
                                {order.addressSnapshot.line1}<br />
                                {order.addressSnapshot.city}, {order.addressSnapshot.state} {order.addressSnapshot.postalCode}<br />
                                Phone: {order.addressSnapshot.phone}
                            </p>

                            <dl className="mt-6 space-y-3 border-t border-gold-500/15 pt-5 text-xs">
                                <div className="flex justify-between text-cream/55">
                                    <dt>Subtotal</dt>
                                    <dd className="font-mono">{rupees(order.subtotalPaise)}</dd>
                                </div>
                                <div className="flex justify-between text-cream/55">
                                    <dt>GST Tax</dt>
                                    <dd className="font-mono">{rupees(order.taxPaise)}</dd>
                                </div>
                                <div className="flex justify-between pt-3 border-t border-gold-500/15 text-gold-300">
                                    <dt className="font-display text-base font-bold">Total Paid</dt>
                                    <dd className="font-display text-2xl font-bold">{rupees(order.totalPaise)}</dd>
                                </div>
                            </dl>
                        </aside>
                    </div>

                    <Link className="mt-8 inline-block text-xs uppercase tracking-wider font-semibold text-gold-300 hover:underline" to="/account/orders">
                        Back to order history
                    </Link>
                </>
            )}

            {returnOpen && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-5 backdrop-blur-md">
                    <form onSubmit={returnOrder} className="w-full max-w-lg rounded-sm border border-gold-500/30 bg-carbon p-8 shadow-2xl">
                        <h2 className="font-display text-3xl font-bold text-cream">Request a Return</h2>
                        <p className="mt-2 text-xs text-cream/50">Describe the reason for returning this item (minimum 10 characters).</p>
                        <textarea
                            name="reason"
                            minLength={10}
                            maxLength={1000}
                            required
                            rows={5}
                            placeholder="Please explain the issue or reason for returning this item…"
                            className="mt-6 w-full rounded-sm border border-gold-500/25 bg-obsidian p-4 text-xs text-cream outline-none focus:border-gold-400"
                        />
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setReturnOpen(false)} className="px-5 py-2 text-xs text-cream/50 hover:text-cream">
                                Cancel
                            </button>
                            <button className="h-11 bg-gold-400 px-6 text-xs font-bold uppercase tracking-[0.18em] text-obsidian hover:bg-gold-300 rounded-sm shadow-md transition">
                                Submit Request
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </AccountShell>
    );
};

export default OrderDetailPage;
