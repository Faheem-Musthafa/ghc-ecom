import React, { FormEvent, useState } from 'react';
import Header from '../components/Header';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';
import { IconSearch, IconTruck, IconPackage } from '../components/Icons';
import { api } from '../lib/api';
import { rupees, shortDate, titleCase } from '../lib/commerce';
import { Order } from '../types';

export const OrderLookupPage = () => {
    const [orderNumber, setOrderNumber] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Order | null>(null);
    const [error, setError] = useState('');

    const handleLookup = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const orders = await api.orders();
            const found = orders.find(
                (o) =>
                    o.orderNumber.toUpperCase() === orderNumber.trim().toUpperCase() ||
                    o.id === orderNumber.trim()
            );

            if (!found) {
                setError('No order matching that reference number was located.');
            } else {
                setResult(found);
            }
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Lookup failed. Please check credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-obsidian text-cream flex flex-col justify-between">
            <SEOHead title="Guest Order Lookup | Glockery" />
            <Header />
            <main className="flex-1 px-6 py-12 lg:px-10 lg:py-16 max-w-xl mx-auto w-full">
                <div className="border border-gold-500/25 bg-carbon p-8 rounded-sm shadow-2xl">
                    <div className="mb-6 border-b border-gold-500/20 pb-4">
                        <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gold-400">
                            Client Support
                        </span>
                        <h1 className="mt-1 font-display text-3xl text-cream">Guest Order Lookup</h1>
                        <p className="mt-1 text-xs text-cream/50">
                            Track order status or view fulfilment details using your order reference.
                        </p>
                    </div>

                    <form onSubmit={handleLookup} className="space-y-4">
                        {error && <p className="border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-200">{error}</p>}
                        <label className="block">
                            <span className="mb-1.5 block text-xs text-cream/70">Order Reference Number</span>
                            <input
                                value={orderNumber}
                                onChange={(e) => setOrderNumber(e.target.value)}
                                placeholder="GLK-1002"
                                className="h-12 w-full border border-gold-500/25 bg-obsidian px-4 text-sm text-cream outline-none focus:border-gold-400 rounded-sm"
                                required
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-xs text-cream/70">Contact Email Address</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="client@example.com"
                                className="h-12 w-full border border-gold-500/25 bg-obsidian px-4 text-sm text-cream outline-none focus:border-gold-400 rounded-sm"
                                required
                            />
                        </label>
                        <button
                            disabled={loading}
                            className="flex h-12 w-full items-center justify-center gap-2 bg-gold-400 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 disabled:opacity-50 rounded-sm shadow-md"
                        >
                            <IconSearch size={16} /> {loading ? 'Searching Record…' : 'Locate Order'}
                        </button>
                    </form>

                    {/* Result */}
                    {result && (
                        <div className="mt-8 border-t border-gold-500/20 pt-6 animate-fadeIn">
                            <div className="flex items-center justify-between">
                                <span className="font-display text-2xl text-gold-300">{result.orderNumber}</span>
                                <span className="rounded-full border border-gold-500/30 bg-gold-950/30 px-3 py-1 text-xs font-bold text-gold-300">
                                    {titleCase(result.status)}
                                </span>
                            </div>
                            <div className="mt-4 space-y-1.5 text-xs text-cream/70">
                                <p><strong>Date Placed:</strong> {shortDate(result.createdAt)}</p>
                                <p><strong>Total Amount:</strong> {rupees(result.totalPaise)}</p>
                                <p><strong>Items:</strong> {result.itemsSnapshot?.length || 0} line items</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <StoreFooter />
        </div>
    );
};
export default OrderLookupPage;
