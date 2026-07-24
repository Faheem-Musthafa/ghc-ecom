import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';
import { IconCheckCircle, IconDownload, IconPackage, IconTruck } from '../components/Icons';
import { api } from '../lib/api';
import { rupees, shortDate } from '../lib/commerce';
import { openTrustedUrl } from '../lib/navigation';
import { Order } from '../types';

export const OrderConfirmationPage = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!orderId) return;
        api.order(orderId)
            .then(setOrder)
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to fetch order confirmation.'))
            .finally(() => setLoading(false));
    }, [orderId]);

    const handleDownloadInvoice = async () => {
        if (!order) return;
        try {
            const res = await api.invoice(order.id);
            if (res?.url && !openTrustedUrl(res.url)) throw new Error('Invoice URL was rejected');
        } catch {
            alert('Tax invoice is generating. Please check again shortly.');
        }
    };

    return (
        <div className="min-h-screen bg-obsidian text-cream flex flex-col justify-between">
            <SEOHead title="Order Confirmed | Glockery" />
            <Header />
            <main className="flex-1 px-6 py-12 lg:px-10 lg:py-16 max-w-4xl mx-auto w-full">
                {loading ? (
                    <div className="text-center py-20 text-cream/40">Loading order confirmation details…</div>
                ) : error || !order ? (
                    <div className="border border-red-500/30 bg-red-950/20 p-8 text-center rounded-sm">
                        <h2 className="font-display text-2xl text-red-200">Confirmation Unavailable</h2>
                        <p className="mt-2 text-xs text-cream/60">{error || 'Order detail not found.'}</p>
                        <Link to="/" className="mt-6 inline-block bg-gold-400 px-6 py-2.5 text-xs font-bold text-obsidian uppercase">Return to Store</Link>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fadeIn">
                        {/* Banner */}
                        <div className="border border-gold-500/30 bg-gradient-to-r from-carbon via-obsidian to-carbon p-8 text-center rounded-sm shadow-2xl">
                            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-950/50 border border-emerald-500/40 text-emerald-400">
                                <IconCheckCircle size={36} color="#10B981" />
                            </div>
                            <span className="mt-4 block text-[10px] font-bold uppercase tracking-[0.3em] text-gold-400">
                                Payment Verified & Confirmed
                            </span>
                            <h1 className="mt-2 font-display text-4xl text-cream">Thank You for Your Order</h1>
                            <p className="mt-2 text-xs text-cream/60">
                                Order number <strong className="text-gold-300 font-mono text-sm">{order.orderNumber}</strong> has been successfully received and dispatched to fulfilment.
                            </p>
                        </div>

                        {/* Order Snapshot & Timeline */}
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="border border-gold-500/20 bg-carbon p-6 rounded-sm">
                                <h3 className="font-display text-xl text-gold-300 border-b border-gold-500/15 pb-3">Order Details</h3>
                                <div className="mt-4 space-y-2 text-xs text-cream/70">
                                    <p><strong>Order Reference:</strong> {order.orderNumber}</p>
                                    <p><strong>Placed Date:</strong> {shortDate(order.createdAt)}</p>
                                    <p><strong>Payment Status:</strong> <span className="text-emerald-400 font-bold">VERIFIED</span></p>
                                    <p><strong>Total Amount:</strong> <span className="font-display text-lg text-gold-300">{rupees(order.totalPaise)}</span></p>
                                </div>
                                <button
                                    onClick={handleDownloadInvoice}
                                    className="mt-6 flex items-center gap-2 rounded-sm border border-gold-500/30 bg-obsidian px-4 py-2.5 text-xs text-gold-300 hover:border-gold-400 w-full justify-center"
                                >
                                    <IconDownload size={16} /> Download Tax Invoice
                                </button>
                            </div>

                            <div className="border border-gold-500/20 bg-carbon p-6 rounded-sm">
                                <h3 className="font-display text-xl text-gold-300 border-b border-gold-500/15 pb-3">Delivery Information</h3>
                                <div className="mt-4 space-y-2 text-xs text-cream/70">
                                    <p><strong>Recipient:</strong> {order.addressSnapshot?.recipientName}</p>
                                    <p><strong>Shipping Address:</strong> {order.addressSnapshot?.line1}, {order.addressSnapshot?.city}, {order.addressSnapshot?.state} {order.addressSnapshot?.postalCode}</p>
                                    <p><strong>Estimated Delivery:</strong> 3 – 5 Business Days</p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-gold-500/15 flex items-center justify-between text-xs text-cream/50">
                                    <span className="flex items-center gap-2"><IconTruck size={16} /> Express Carrier</span>
                                    <Link to={`/tracking/${order.orderNumber}`} className="text-gold-400 hover:underline">Track Package →</Link>
                                </div>
                            </div>
                        </div>

                        {/* Items Snapshot */}
                        <div className="border border-gold-500/20 bg-carbon p-6 rounded-sm">
                            <h3 className="font-display text-xl text-cream mb-4">Purchased Luxury Items</h3>
                            <div className="divide-y divide-gold-500/10">
                                {(order.itemsSnapshot || []).map((item, idx) => (
                                    <div key={idx} className="py-3 flex items-center justify-between text-xs">
                                        <div>
                                            <p className="font-medium text-cream">{item.productName}</p>
                                            <p className="text-[10px] text-cream/40">SKU: {item.sku} · Qty: {item.quantity}</p>
                                        </div>
                                        <span className="font-semibold text-gold-300">{rupees(item.lineTotalPaise)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>
            <StoreFooter />
        </div>
    );
};
export default OrderConfirmationPage;
