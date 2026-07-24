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
    useEffect(() => { if (signedIn) api.order(orderId).then(setOrder).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load order.')); }, [orderId, signedIn]);
    if (!signedIn) return <Redirect to="/auth" />;
    const download = async () => { try { const result = await api.invoice(orderId); if (!openTrustedUrl(result.url)) throw new Error('Invoice URL was rejected'); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Invoice is not ready.'); } };
    const returnOrder = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get('reason')); try { await api.createReturn(orderId, reason); setReturnOpen(false); setNotice('Your return request was submitted for review.'); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create return.'); } };
    return <AccountShell title={order?.orderNumber || 'Order detail'} intro={order ? `Placed ${shortDate(order.createdAt)} · ${titleCase(order.status)}` : 'Loading your order from the backend.'}>
        {error && <p className="mb-5 border border-red-500/30 p-4 text-red-200">{error}</p>}{notice && <p className="mb-5 flex items-center gap-2 border border-gold-500/30 p-4 text-gold-200"><IconCheckCircle color="currentColor" />{notice}</p>}
        {order && <><div className="grid gap-6 lg:grid-cols-[1fr_320px]"><section className="border border-gold-500/20 bg-carbon p-6"><div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-[0.24em] text-gold-400">{titleCase(order.status)}</p>{order.invoice && <button onClick={() => void download()} className="flex items-center gap-2 text-xs text-gold-300"><IconDownload size={15} /> Invoice</button>}</div><div className="mt-6 divide-y divide-gold-500/15">{order.itemsSnapshot.map((item) => <article key={item.id || item.variantId} className="grid grid-cols-[72px_1fr_auto] items-center gap-4 py-5"><img src={item.imageUrl || fallbackImage} alt="" className="aspect-square object-cover" /><div><h2 className="font-display text-xl">{item.productName}</h2><p className="mt-1 text-xs text-cream/35">{item.quantity} × {item.variantName}</p></div><strong className="font-normal">{rupees(item.lineTotalPaise)}</strong></article>)}</div><button onClick={() => setReturnOpen(true)} className="mt-6 text-xs uppercase tracking-[0.18em] text-gold-300 underline-offset-4 hover:underline">Request a return</button></section><aside className="border border-gold-500/20 bg-carbon p-6"><IconMapPin className="text-gold-400" /><h2 className="mt-5 font-display text-2xl">Delivery address</h2><p className="mt-3 text-sm leading-7 text-cream/45">{order.addressSnapshot.recipientName}<br />{order.addressSnapshot.line1}<br />{order.addressSnapshot.city}, {order.addressSnapshot.state} {order.addressSnapshot.postalCode}<br />{order.addressSnapshot.phone}</p><dl className="mt-7 space-y-3 border-t border-gold-500/15 pt-5 text-sm"><div className="flex justify-between text-cream/45"><dt>Subtotal</dt><dd>{rupees(order.subtotalPaise)}</dd></div><div className="flex justify-between text-cream/45"><dt>GST</dt><dd>{rupees(order.taxPaise)}</dd></div><div className="flex justify-between pt-3 text-gold-300"><dt>Total paid</dt><dd className="font-display text-2xl">{rupees(order.totalPaise)}</dd></div></dl></aside></div><Link className="mt-8 inline-block text-xs text-gold-300" to="/account/orders">← Back to orders</Link></>}
        {returnOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-5"><form onSubmit={returnOrder} className="w-full max-w-lg border border-gold-500/30 bg-carbon p-7"><h2 className="font-display text-3xl">Request a return</h2><p className="mt-3 text-sm text-cream/45">Describe the issue in at least 10 characters.</p><textarea name="reason" minLength={10} maxLength={1000} required rows={5} className="mt-6 w-full border border-gold-500/25 bg-obsidian p-4 text-sm outline-none focus:border-gold-400" /><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setReturnOpen(false)} className="px-5 text-xs text-cream/40">Cancel</button><button className="h-12 bg-gold-400 px-6 text-xs font-bold uppercase tracking-[0.18em] text-obsidian">Submit request</button></div></form></div>}
    </AccountShell>;
};
export default OrderDetailPage;
