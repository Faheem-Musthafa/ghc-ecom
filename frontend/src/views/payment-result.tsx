'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Link, useHistory, useLocation } from '../lib/router';
import Header from '../components/Header';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';
import { IconAlert, IconRefresh } from '../components/Icons';
import { useCart } from '../contexts/CartContext';
import { api } from '../lib/api';
import { Order } from '../types';

type Outcome = 'success' | 'failed' | 'pending';

const POLL_INTERVAL_MS = 3_000;
const MAX_AUTOMATIC_POLLS = 10;

const readOutcome = (value: string | null): Outcome =>
    value === 'success' || value === 'failed' ? value : 'pending';

const isUuid = (value: string | null): value is string =>
    Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

/**
 * Landing page for the bank gateway redirect flow. The API's Response URL sends the
 * customer here with `?order=<id>&outcome=<hint>`; the order status from the API is
 * the source of truth and is polled while the bank confirmation is still pending.
 */
export const PaymentResultPage = () => {
    const history = useHistory();
    const { search } = useLocation();
    const { resetCart } = useCart();
    const params = new URLSearchParams(search);
    const orderId = isUuid(params.get('order')) ? params.get('order') : null;
    const hint = readOutcome(params.get('outcome'));
    const [status, setStatus] = useState<'checking' | 'pending' | 'failed'>(orderId ? 'checking' : 'failed');
    const [error, setError] = useState('');
    const polls = useRef(0);
    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (!orderId) return;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const check = async () => {
            try {
                const order: Order = await api.fssPaymentStatus(orderId);
                if (!isMounted.current) return;
                if (order.status === 'PAYMENT_PENDING') {
                    polls.current += 1;
                    if (polls.current < MAX_AUTOMATIC_POLLS) {
                        timer = setTimeout(check, POLL_INTERVAL_MS);
                    } else {
                        setStatus('pending');
                    }
                    return;
                }
                if (order.status === 'PAYMENT_FAILED' || order.status === 'CANCELLED') {
                    setStatus('failed');
                    return;
                }
                resetCart();
                history.replace(`/order-confirmation/${order.id}`);
            } catch (caught) {
                if (!isMounted.current) return;
                setError(caught instanceof Error ? caught.message : 'Payment status could not be checked.');
                setStatus('pending');
            }
        };

        void check();
        return () => {
            if (timer) clearTimeout(timer);
        };
        // resetCart/history are stable; re-running on them would restart polling.
    }, [orderId]);

    const retry = () => {
        polls.current = 0;
        setError('');
        setStatus('checking');
        api.fssPaymentStatus(orderId!)
            .then((order) => {
                if (!isMounted.current) return;
                if (order.status === 'PAYMENT_PENDING') {
                    setStatus('pending');
                } else if (order.status === 'PAYMENT_FAILED' || order.status === 'CANCELLED') {
                    setStatus('failed');
                } else {
                    resetCart();
                    history.replace(`/order-confirmation/${order.id}`);
                }
            })
            .catch((caught) => {
                if (!isMounted.current) return;
                setError(caught instanceof Error ? caught.message : 'Payment status could not be checked.');
                setStatus('pending');
            });
    };

    const failed = status === 'failed' || (!orderId && hint === 'failed');

    return (
        <div className="min-h-screen bg-obsidian text-cream flex flex-col justify-between font-body">
            <SEOHead title="Payment status | Glockery" noIndex />
            <Header />
            <main id="main-content" className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-8 lg:py-16">
                {status === 'checking' ? (
                    <div className="border border-line bg-carbon p-8 text-center sm:p-12" role="status" aria-live="polite">
                        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold-400/10 text-gold-300">
                            <IconRefresh size={28} className="animate-spin" />
                        </div>
                        <h1 className="mt-5 font-display text-3xl">Confirming your payment</h1>
                        <p className="mt-3 text-xs text-cream/60">
                            We are waiting for your bank to confirm the transaction. Please do not close this page or pay again.
                        </p>
                    </div>
                ) : failed ? (
                    <div className="border border-amber-500/30 bg-amber-950/20 p-8 text-center sm:p-12">
                        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
                            <IconAlert size={28} />
                        </div>
                        <h1 className="mt-5 font-display text-3xl text-amber-200">Payment not completed</h1>
                        <p className="mt-3 text-xs text-cream/60">
                            Your bank did not confirm this payment and nothing has been charged. Your bag has been kept so you can try again.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <Link to="/checkout" className="button-primary h-12 px-6">Retry payment</Link>
                            <Link to="/cart" className="inline-flex h-12 items-center justify-center border border-line px-6 text-xs font-bold uppercase tracking-[0.14em] text-cream/70">Review bag</Link>
                        </div>
                    </div>
                ) : (
                    <div className="border border-line bg-carbon p-8 text-center sm:p-12">
                        <h1 className="font-display text-3xl">Payment confirmation pending</h1>
                        <p className="mt-3 text-xs text-cream/60">
                            Your bank has not sent the final confirmation yet. If money was debited, the order will be confirmed automatically
                            once the bank responds — you do not need to pay again.
                        </p>
                        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                            {orderId && (
                                <button type="button" onClick={retry} className="button-primary h-12 px-6 gap-2">
                                    <IconRefresh size={16} /> Check again
                                </button>
                            )}
                            <Link to="/order-lookup" className="inline-flex h-12 items-center justify-center border border-line px-6 text-xs font-bold uppercase tracking-[0.14em] text-cream/70">Track my order</Link>
                        </div>
                    </div>
                )}
            </main>
            <StoreFooter />
        </div>
    );
};

export default PaymentResultPage;
