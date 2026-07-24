import React, { FormEvent, useEffect, useState } from 'react';
import { Link, Redirect, useLocation } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import {
    IconArrowRight,
    IconCheckCircle,
    IconChevronRight,
    IconDownload,
    IconMapPin,
    IconPackage,
    IconRefresh,
    IconShield,
    IconTrash,
} from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { useWishlist } from '../contexts/WishlistContext';
import { api } from '../lib/api';
import { fallbackImage, rupees, shortDate, titleCase } from '../lib/commerce';
import { openTrustedUrl } from '../lib/navigation';
import { Address, Order, Product, Profile } from '../types';

const panel = 'border border-gold-500/20 bg-carbon p-6 rounded-sm shadow-md';
const input = 'h-12 w-full border border-gold-500/25 bg-obsidian px-4 text-sm text-cream outline-none focus:border-gold-400 rounded-sm';

const OrdersView = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.orders()
            .then(setOrders)
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load orders.'))
            .finally(() => setLoading(false));
    }, []);

    const handleInvoiceDownload = async (orderId: string) => {
        try {
            const res = await api.invoice(orderId);
            if (res?.url && !openTrustedUrl(res.url)) throw new Error('Invoice URL was rejected');
        } catch {
            alert('Tax invoice is being generated. Please check back shortly.');
        }
    };

    return (
        <AccountShell title="Your Orders" intro="Every order, payment status, tax invoice, and return detail stored securely in your account.">
            {error && <p className="border border-red-500/30 p-4 text-xs text-red-200">{error}</p>}
            {loading ? (
                <p className="text-sm text-cream/40">Loading your purchase records…</p>
            ) : !orders.length ? (
                <div className={`${panel} py-16 text-center`}>
                    <h2 className="font-display text-3xl">No Orders Placed Yet</h2>
                    <p className="mt-2 text-xs text-cream/50">Explore our luxury tableware and home accent collections.</p>
                    <Link to="/" className="mt-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold-300 hover:underline">
                        Explore Collection <IconArrowRight size={15} />
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((order) => (
                        <article key={order.id} className={`${panel} grid gap-5 sm:grid-cols-[84px_1fr_auto] sm:items-center`}>
                            <img
                                src={order.itemsSnapshot?.[0]?.imageUrl || fallbackImage}
                                alt=""
                                className="aspect-square w-20 object-cover rounded-sm border border-gold-500/20 bg-obsidian"
                            />
                            <div>
                                <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.18em]">
                                    <span className="font-bold text-gold-400">{titleCase(order.status)}</span>
                                    <span className="text-cream/40">• Placed {shortDate(order.createdAt)}</span>
                                </div>
                                <h2 className="mt-2 font-display text-2xl text-cream">
                                    {order.itemsSnapshot?.[0]?.productName || 'Glockery Order'}
                                </h2>
                                <p className="mt-1 text-xs text-cream/50 font-mono">
                                    Ref: {order.orderNumber} • <span className="text-gold-300 font-sans font-semibold">{rupees(order.totalPaise)}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleInvoiceDownload(order.id)}
                                    className="p-2.5 text-gold-300 border border-gold-500/25 rounded-sm hover:border-gold-400 bg-obsidian"
                                    title="Download Tax Invoice"
                                >
                                    <IconDownload size={18} />
                                </button>
                                <Link
                                    to={`/account/orders/${order.id}`}
                                    className="grid size-11 place-items-center border border-gold-500/25 text-gold-300 hover:border-gold-400 rounded-sm bg-obsidian"
                                    aria-label={`View ${order.orderNumber}`}
                                >
                                    <IconChevronRight size={18} />
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </AccountShell>
    );
};

const AddressesView = () => {
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');

    const load = () =>
        api.addresses()
            .then(setAddresses)
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load addresses.'));

    useEffect(() => { void load(); }, []);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError('');
        try {
            await api.createAddress({
                label: String(form.get('label')),
                recipientName: String(form.get('recipientName')),
                phone: String(form.get('phone')),
                line1: String(form.get('line1')),
                line2: String(form.get('line2') || ''),
                city: String(form.get('city')),
                state: String(form.get('state')),
                postalCode: String(form.get('postalCode')),
                country: 'IN',
                isDefault: Boolean(form.get('isDefault')),
            });
            setOpen(false);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to save address.');
        }
    };

    return (
        <AccountShell title="Saved Delivery Addresses" intro="Secure destinations used during seamless checkout.">
            {error && <p className="mb-5 border border-red-500/30 p-4 text-xs text-red-200">{error}</p>}
            <div className="grid gap-4 md:grid-cols-2">
                {addresses.map((address) => (
                    <article className={panel} key={address.id}>
                        <div className="flex items-start justify-between">
                            <IconMapPin className="text-gold-400" />
                            <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-gold-300">
                                {address.isDefault ? 'Default Destination' : address.label}
                            </span>
                        </div>
                        <h2 className="mt-4 font-display text-2xl text-cream">{address.recipientName}</h2>
                        <p className="mt-2 text-xs leading-relaxed text-cream/60">
                            {address.line1}
                            {address.line2 ? `, ${address.line2}` : ''}
                            <br />
                            {address.city}, {address.state} {address.postalCode}
                            <br />
                            Phone: {address.phone}
                        </p>
                        <button
                            onClick={async () => {
                                if (window.confirm('Remove this saved address?')) {
                                    await api.deleteAddress(address.id);
                                    await load();
                                }
                            }}
                            className="mt-4 flex items-center gap-1 text-xs text-red-400/80 hover:text-red-300"
                        >
                            <IconTrash size={14} /> Remove Address
                        </button>
                    </article>
                ))}
                <button
                    onClick={() => setOpen(true)}
                    className="min-h-[180px] border border-dashed border-gold-500/35 text-xs font-bold uppercase tracking-[0.2em] text-gold-300 hover:bg-gold-400/5 rounded-sm"
                >
                    + Add New Destination Address
                </button>
            </div>

            {open && (
                <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/85 p-5 backdrop-blur-sm">
                    <form onSubmit={submit} className="my-8 w-full max-w-xl border border-gold-500/30 bg-carbon p-7 rounded-sm shadow-2xl">
                        <div className="flex justify-between border-b border-gold-500/20 pb-4">
                            <h2 className="font-display text-3xl text-cream">Add Saved Address</h2>
                            <button type="button" onClick={() => setOpen(false)} className="text-xs text-cream/40">Close</button>
                        </div>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            {[
                                ['label', 'Address Tag (e.g. Home, Office)'],
                                ['recipientName', 'Recipient Full Name'],
                                ['phone', 'Phone Number'],
                                ['line1', 'Street Address'],
                                ['line2', 'Landmark / Apartment (Optional)'],
                                ['city', 'City'],
                                ['state', 'State'],
                                ['postalCode', 'PIN Code'],
                            ].map(([name, label]) => (
                                <label key={name} className={name === 'line1' || name === 'line2' ? 'sm:col-span-2' : ''}>
                                    <span className="mb-1.5 block text-xs text-cream/60">{label}</span>
                                    <input className={input} name={name} required={name !== 'line2'} pattern={name === 'postalCode' ? '[0-9]{6}' : undefined} />
                                </label>
                            ))}
                        </div>
                        <label className="mt-5 flex gap-2 text-xs text-cream/60">
                            <input type="checkbox" name="isDefault" className="accent-gold-400" /> Make this my default delivery address
                        </label>
                        <button className="mt-6 h-12 w-full bg-gold-400 text-xs font-bold uppercase tracking-[0.2em] text-obsidian hover:bg-gold-300 rounded-sm">
                            Save Address
                        </button>
                    </form>
                </div>
            )}
        </AccountShell>
    );
};

const WishlistView = () => {
    const { wishlistIds, toggleWishlist } = useWishlist();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.products(new URLSearchParams({ limit: '100' }))
            .then((res) => {
                setProducts(res.items.filter((p) => wishlistIds.includes(p.id)));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [wishlistIds]);

    return (
        <AccountShell title="Your Wishlist" intro="Curated pieces saved for your future dining and tableware acquisition.">
            {loading ? (
                <p className="text-sm text-cream/40">Loading saved wishlist items…</p>
            ) : !products.length ? (
                <div className={`${panel} py-16 text-center`}>
                    <h2 className="font-display text-3xl">Your Wishlist is Empty</h2>
                    <p className="mt-2 text-xs text-cream/50">Save items while browsing the collection to review them later.</p>
                    <Link to="/" className="mt-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold-300">
                        Explore Collection <IconArrowRight size={15} />
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {products.map((product) => (
                        <div key={product.id} className={`${panel} relative`}>
                            <img src={product.images[0]?.thumbnailUrl || fallbackImage} alt="" className="aspect-square w-full object-cover rounded-sm border border-gold-500/20 bg-obsidian" />
                            <h3 className="mt-3 font-display text-xl text-cream">{product.name}</h3>
                            <p className="mt-1 font-semibold text-gold-300 text-sm">{product.variants[0] ? rupees(product.variants[0].pricePaise) : '—'}</p>
                            <div className="mt-4 flex gap-2">
                                <Link to={`/product/${product.slug}`} className="flex-1 bg-gold-400 text-obsidian font-bold text-[10px] uppercase tracking-wider py-2.5 text-center rounded-sm">
                                    View Piece
                                </Link>
                                <button onClick={() => toggleWishlist(product.id)} className="p-2 text-red-400 border border-red-500/20 rounded-sm">
                                    <IconTrash size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </AccountShell>
    );
};

const ProfileView = () => {
    const { session } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.profile()
            .then(setProfile)
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load profile.'));
    }, []);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
            setProfile(
                await api.updateProfile({
                    fullName: String(form.get('fullName')),
                    phone: String(form.get('phone') || '') || undefined,
                })
            );
            setSaved(true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to update profile.');
        }
    };

    return (
        <AccountShell title="Account Settings" intro="Private credentials and contact details used for orders and notifications.">
            <form onSubmit={submit} className={`${panel} max-w-2xl space-y-4`}>
                {saved && (
                    <p className="flex items-center gap-2 text-sm text-gold-300 font-semibold">
                        <IconCheckCircle color="#10B981" /> Profile details saved successfully.
                    </p>
                )}
                {error && <p className="text-xs text-red-200 border border-red-500/30 p-3">{error}</p>}
                <label className="block">
                    <span className="mb-1.5 block text-xs text-cream/60">Full Name</span>
                    <input name="fullName" className={input} defaultValue={profile?.fullName || ''} required />
                </label>
                <label className="block">
                    <span className="mb-1.5 block text-xs text-cream/60">Email Address</span>
                    <input className={input} value={session?.user?.email || profile?.email || ''} readOnly aria-describedby="account-email-help" />
                    <span id="account-email-help" className="mt-1.5 block text-[10px] text-cream/35">Your login email is managed by your authentication provider.</span>
                </label>
                <label className="block">
                    <span className="mb-1.5 block text-xs text-cream/60">Mobile Number</span>
                    <input name="phone" className={input} defaultValue={profile?.phone || ''} />
                </label>
                <button className="mt-4 h-12 bg-gold-400 px-8 text-xs font-bold uppercase tracking-[0.2em] text-obsidian rounded-sm">
                    Save Changes
                </button>
            </form>
        </AccountShell>
    );
};

const AccountPage = () => {
    const { signedIn } = useAuth();
    const location = useLocation();
    if (!signedIn) return <Redirect to={`/auth?next=${encodeURIComponent(location.pathname)}`} />;
    if (location.pathname.startsWith('/account/orders')) return <OrdersView />;
    if (location.pathname.startsWith('/account/addresses')) return <AddressesView />;
    if (location.pathname.startsWith('/account/wishlist')) return <WishlistView />;
    return <ProfileView />;
};

export default AccountPage;
