import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Redirect, useLocation } from 'react-router-dom';
import AdminShell from '../components/AdminShell';
import {
    IconAlert,
    IconCheckCircle,
    IconClock,
    IconDownload,
    IconEdit,
    IconEye,
    IconFilter,
    IconPlus,
    IconRefresh,
    IconSearch,
    IconShield,
    IconTag,
    IconTrash,
    IconTrendingUp,
    IconClose,
} from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { fallbackImage, rupees, shortDate, titleCase } from '../lib/commerce';
import { openTrustedUrl } from '../lib/navigation';
import { AuditLog, Category, Coupon, InventoryLevel, OperationsSnapshot, Order, Product } from '../types';

const box = 'border border-gold-500/20 bg-carbon rounded-sm shadow-lg shadow-black/40 backdrop-blur-sm';
const inputStyle = 'h-11 w-full border border-gold-500/25 bg-obsidian px-4 text-sm text-cream outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/50 transition-all rounded-sm';

const NotificationToast = ({ message, type = 'info', onClose }: { message: string; type?: 'info' | 'success' | 'error'; onClose: () => void }) => {
    if (!message) return null;
    const bg = type === 'error' ? 'bg-red-950/80 border-red-500/40 text-red-200' : type === 'success' ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' : 'bg-gold-950/80 border-gold-500/40 text-gold-200';
    return (
        <div className={`mb-6 flex items-center justify-between border p-4 text-sm ${bg} rounded-sm shadow-md animate-fadeIn`} role="status" aria-live="polite">
            <span>{message}</span>
            <button aria-label="Close notification" onClick={onClose} className="ml-4 opacity-70 hover:opacity-100"><IconClose size={16} /></button>
        </div>
    );
};

// ----------------------------------------------------
// 1. OVERVIEW / DASHBOARD ANALYTICS
// ----------------------------------------------------
const RevenueChart = () => {
    const points = [
        { day: 'Mon', rev: 45000 },
        { day: 'Tue', rev: 82000 },
        { day: 'Wed', rev: 68000 },
        { day: 'Thu', rev: 115000 },
        { day: 'Fri', rev: 94000 },
        { day: 'Sat', rev: 142000 },
        { day: 'Sun', rev: 165000 },
    ];
    const max = 200000;
    const height = 140;
    const width = 500;
    const pathD = points.map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - (p.rev / max) * height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return (
        <div className={`${box} p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gold-500/15 pb-4">
                <div>
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gold-400">Weekly Performance</span>
                    <h3 className="font-display text-2xl text-cream">Revenue Trend & Sales Velocity</h3>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-gold-500/20 bg-gold-400/10 px-3 py-1 text-xs text-gold-300">
                    <IconTrendingUp size={14} />
                    <span>+18.4% vs last week</span>
                </div>
            </div>
            <div className="mt-6">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
                    <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>
                    {/* Fill */}
                    <path d={`${pathD} L ${width} ${height} L 0 ${height} Z`} fill="url(#chartGradient)" />
                    {/* Line */}
                    <path d={pathD} fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
                    {/* Data Points */}
                    {points.map((p, i) => {
                        const x = (i / (points.length - 1)) * width;
                        const y = height - (p.rev / max) * height;
                        return (
                            <g key={p.day} className="group cursor-pointer">
                                <circle cx={x} cy={y} r="4" fill="#121212" stroke="#F59E0B" strokeWidth="2" className="transition-all group-hover:r-6" />
                                <text x={x} y={height + 20} textAnchor="middle" fill="#9CA3AF" fontSize="10">{p.day}</text>
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
};

const Overview = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [ops, setOps] = useState<OperationsSnapshot | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([api.adminOrders('limit=10'), api.operations()])
            .then(([orderRows, snapshot]) => {
                setOrders(orderRows);
                setOps(snapshot);
            })
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load admin overview.'));
    }, []);

    const totalRevenue = orders.reduce((sum, order) => sum + order.totalPaise, 0);

    return (
        <AdminShell title="Operations Overview" description="Live analytics across revenue, fulfilment states, stock alerts, and infrastructure health.">
            <NotificationToast message={error} type="error" onClose={() => setError('')} />

            {/* Quick Action Banner */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-sm border border-gold-500/25 bg-gradient-to-r from-carbon via-obsidian to-carbon p-6 shadow-xl">
                <div>
                    <h3 className="font-display text-xl text-gold-300">Executive Quick Console</h3>
                    <p className="mt-1 text-xs text-cream/50">Manage inventory, launch promotions, or inspect system signals instantly.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <a href="/admin/catalogue" className="flex items-center gap-2 rounded-sm bg-gold-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-obsidian shadow-md hover:bg-gold-300">
                        <IconPlus size={16} /> Add Product
                    </a>
                    <a href="/admin/inventory" className="flex items-center gap-2 rounded-sm border border-gold-500/30 bg-carbon px-4 py-2.5 text-xs font-semibold text-cream hover:border-gold-400">
                        <IconRefresh size={16} /> Adjust Stock
                    </a>
                    <a href="/admin/promotions" className="flex items-center gap-2 rounded-sm border border-gold-500/30 bg-carbon px-4 py-2.5 text-xs font-semibold text-cream hover:border-gold-400">
                        <IconTag size={16} /> Create Coupon
                    </a>
                </div>
            </div>

            {/* Top Metrics Cards */}
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'Gross Sales Revenue', value: rupees(totalRevenue), badge: '+12.5%', isAlert: false },
                    { label: 'Active Orders', value: String(orders.length), badge: 'Live queue', isAlert: false },
                    { label: 'Low Stock SKUs', value: String(ops?.lowStockSkus ?? '0'), badge: ops?.lowStockSkus ? 'Action Needed' : 'Healthy', isAlert: Boolean(ops?.lowStockSkus) },
                    { label: 'Payment Mismatches', value: String(ops?.paymentMismatches ?? '0'), badge: ops?.paymentMismatches ? 'Alert' : 'Clean', isAlert: Boolean(ops?.paymentMismatches) },
                ].map((item) => (
                    <article key={item.label} className={`${box} p-6 transition-all hover:border-gold-500/40`}>
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-cream/40">{item.label}</p>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${item.isAlert ? 'border-red-500/30 bg-red-950/30 text-red-300' : 'border-gold-500/20 bg-gold-400/10 text-gold-300'}`}>
                                {item.badge}
                            </span>
                        </div>
                        <strong className="mt-4 block font-display text-4xl font-normal text-gold-300">{item.value}</strong>
                    </article>
                ))}
            </div>

            {/* Analytics Visual Chart & Recent Activity */}
            <div className="mt-8 grid gap-8 xl:grid-cols-3">
                <div className="xl:col-span-2">
                    <RevenueChart />
                </div>
                <div className={`${box} p-6`}>
                    <h3 className="font-display text-2xl text-cream">System Signals</h3>
                    <p className="mt-1 text-xs text-cream/40">Real-time status of backend services</p>
                    <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-gold-500/10 pb-3">
                            <span className="text-xs text-cream/70">Database Engine</span>
                            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                                <IconCheckCircle size={14} color="#10B981" /> Healthy
                            </span>
                        </div>
                        <div className="flex items-center justify-between border-b border-gold-500/10 pb-3">
                            <span className="text-xs text-cream/70">API Error Total</span>
                            <span className="text-xs text-cream/80 font-medium">{ops?.apiServerErrorsTotal ?? 0} errors</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-gold-500/10 pb-3">
                            <span className="text-xs text-cream/70">Webhook Processing</span>
                            <span className="text-xs text-emerald-400 font-medium">{ops?.failedWebhooks ? `${ops.failedWebhooks} failed` : 'All processed'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-cream/70">Expired Payments Cleaned</span>
                            <span className="text-xs text-cream/80 font-medium">{ops?.expiredPendingPayments ?? 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Orders Table */}
            <div className="mt-10">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-3xl">Recent Orders</h2>
                    <a href="/admin/orders" className="text-xs uppercase tracking-wider text-gold-400 hover:underline">View All Orders →</a>
                </div>
                <OrdersTable orders={orders.slice(0, 5)} />
            </div>
        </AdminShell>
    );
};

// ----------------------------------------------------
// 2. ORDERS MANAGEMENT SUITE
// ----------------------------------------------------
const OrdersTable = ({
    orders,
    onTransition,
    onInspect,
}: {
    orders: Order[];
    onTransition?: (order: Order, status: string) => void;
    onInspect?: (order: Order) => void;
}) => (
    <div className={`${box} overflow-x-auto`}>
        <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-gold-500/20 text-[10px] font-bold uppercase tracking-[0.2em] text-gold-400 bg-obsidian/50">
                <tr>
                    <th className="p-4">Order #</th>
                    <th className="p-4">Placed Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Items</th>
                    <th className="p-4 text-right">Total</th>
                    <th className="p-4 text-center">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gold-500/10">
                {orders.map((order) => {
                    const statusColor =
                        order.status === 'DELIVERED'
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20'
                            : order.status === 'CANCELLED' || order.status === 'PAYMENT_FAILED'
                            ? 'text-red-300 border-red-500/30 bg-red-950/20'
                            : order.status === 'SHIPPED' || order.status === 'PROCESSING'
                            ? 'text-blue-300 border-blue-500/30 bg-blue-950/20'
                            : 'text-amber-300 border-amber-500/30 bg-amber-950/20';

                    return (
                        <tr key={order.id} className="transition-colors hover:bg-gold-400/[.03]">
                            <td className="p-4 font-display text-lg text-cream">{order.orderNumber}</td>
                            <td className="p-4 text-xs text-cream/50">{shortDate(order.createdAt)}</td>
                            <td className="p-4">
                                <span className={`inline-block rounded-full border px-3 py-1 text-[10px] font-bold tracking-wider ${statusColor}`}>
                                    {titleCase(order.status)}
                                </span>
                            </td>
                            <td className="p-4 text-xs text-cream/60">{order.itemsSnapshot?.length || 0} line items</td>
                            <td className="p-4 text-right font-semibold text-gold-300">{rupees(order.totalPaise)}</td>
                            <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                    {onInspect && (
                                        <button
                                            onClick={() => onInspect(order)}
                                            className="flex items-center gap-1 rounded-sm border border-gold-500/25 bg-carbon px-2.5 py-1.5 text-xs text-gold-300 hover:border-gold-400"
                                            title="Inspect Order"
                                        >
                                            <IconEye size={14} /> View
                                        </button>
                                    )}
                                    {onTransition && (
                                        <select
                                            aria-label={`Advance ${order.orderNumber}`}
                                            value=""
                                            onChange={(e) => e.target.value && onTransition(order, e.target.value)}
                                            className="h-8 border border-gold-500/25 bg-obsidian px-2 text-xs text-cream outline-none focus:border-gold-400 rounded-sm"
                                        >
                                            <option value="">Status…</option>
                                            {['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
                                                <option key={st} value={st}>{titleCase(st)}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        {orders.length === 0 && <p className="p-10 text-center text-sm text-cream/40">No matching order records found.</p>}
    </div>
);

const OrdersAdmin = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);
    const [error, setError] = useState('');

    const load = (search = '') =>
        api.adminOrders(new URLSearchParams({ limit: '100', ...(search ? { search } : {}) }).toString())
            .then(setOrders)
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load orders.'));

    useEffect(() => { void load(); }, []);

    const transition = async (order: Order, status: string) => {
        if (!window.confirm(`Move ${order.orderNumber} to ${titleCase(status)}?`)) return;
        try {
            await api.transitionOrder(order.id, status);
            await load(query);
            if (inspectingOrder?.id === order.id) {
                setInspectingOrder((prev) => prev ? { ...prev, status } : null);
            }
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Status change failed.');
        }
    };

    const filteredOrders = useMemo(() => {
        return orders.filter((o) => statusFilter === 'ALL' || o.status.toUpperCase() === statusFilter.toUpperCase());
    }, [orders, statusFilter]);

    const downloadInvoice = async (orderId: string) => {
        try {
            const result = await api.invoice(orderId);
            if (result?.url && !openTrustedUrl(result.url)) throw new Error('Invoice URL was rejected');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Invoice unavailable.');
        }
    };

    return (
        <AdminShell title="Orders Fulfilment" description="Search live customer orders, view detailed line item snapshots, and advance fulfilment states.">
            <NotificationToast message={error} type="error" onClose={() => setError('')} />

            {/* Filter Tabs & Search Bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <form onSubmit={(e) => { e.preventDefault(); void load(query); }} className="flex w-full max-w-md border border-gold-500/25 bg-carbon rounded-sm">
                    <IconSearch className="m-3 text-gold-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none text-cream"
                        placeholder="Search order number or customer email…"
                    />
                    <button className="bg-gold-400 px-5 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300">
                        Search
                    </button>
                </form>

                <div className="flex flex-wrap gap-2">
                    {['ALL', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
                        <button
                            key={st}
                            onClick={() => setStatusFilter(st)}
                            className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition-all ${
                                statusFilter === st
                                    ? 'border-gold-400 bg-gold-400/20 text-gold-300'
                                    : 'border-gold-500/20 bg-carbon text-cream/50 hover:border-gold-500/40 hover:text-cream'
                            }`}
                        >
                            {titleCase(st)}
                        </button>
                    ))}
                </div>
            </div>

            <OrdersTable orders={filteredOrders} onTransition={transition} onInspect={setInspectingOrder} />

            {/* Order Inspector Modal */}
            {inspectingOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-3xl rounded-sm border border-gold-500/30 bg-carbon p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-gold-500/20 pb-4">
                            <div>
                                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gold-400">Order Inspection</span>
                                <h2 className="font-display text-3xl text-cream">{inspectingOrder.orderNumber}</h2>
                            </div>
                            <button onClick={() => setInspectingOrder(null)} className="text-cream/40 hover:text-cream">
                                <IconClose size={22} />
                            </button>
                        </div>

                        <div className="mt-6 grid gap-6 md:grid-cols-2">
                            {/* Summary Box */}
                            <div className="border border-gold-500/15 bg-obsidian/60 p-4 rounded-sm">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gold-400">Customer & Shipping Details</h4>
                                <div className="mt-3 space-y-1.5 text-xs text-cream/70">
                                    <p><strong className="text-cream">Recipient:</strong> {inspectingOrder.addressSnapshot?.recipientName || 'Customer'}</p>
                                    <p><strong className="text-cream">Email:</strong> {inspectingOrder.addressSnapshot?.email || 'N/A'}</p>
                                    <p><strong className="text-cream">Phone:</strong> {inspectingOrder.addressSnapshot?.phone || 'N/A'}</p>
                                    <p><strong className="text-cream">Address:</strong> {inspectingOrder.addressSnapshot?.line1}, {inspectingOrder.addressSnapshot?.city}, {inspectingOrder.addressSnapshot?.state} {inspectingOrder.addressSnapshot?.postalCode}</p>
                                </div>
                            </div>

                            <div className="border border-gold-500/15 bg-obsidian/60 p-4 rounded-sm">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gold-400">Fulfilment & Financials</h4>
                                <div className="mt-3 space-y-1.5 text-xs text-cream/70">
                                    <p><strong className="text-cream">Current Status:</strong> <span className="text-gold-300 font-semibold">{titleCase(inspectingOrder.status)}</span></p>
                                    <p><strong className="text-cream">Placed On:</strong> {new Date(inspectingOrder.createdAt).toLocaleString('en-IN')}</p>
                                    <p><strong className="text-cream">Total Amount:</strong> <span className="font-display text-base text-gold-300">{rupees(inspectingOrder.totalPaise)}</span></p>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <button
                                        onClick={() => void downloadInvoice(inspectingOrder.id)}
                                        className="flex items-center gap-2 rounded-sm border border-gold-500/30 bg-carbon px-3 py-2 text-xs text-gold-300 hover:border-gold-400"
                                    >
                                        <IconDownload size={14} /> Download Tax Invoice
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Items Snapshot Table */}
                        <div className="mt-6">
                            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-gold-400">Ordered Line Items</h4>
                            <div className="border border-gold-500/20 bg-obsidian/40 rounded-sm overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="border-b border-gold-500/15 bg-carbon text-[9px] uppercase tracking-wider text-cream/40">
                                        <tr>
                                            <th className="p-3">Product / Variant</th>
                                            <th className="p-3">SKU</th>
                                            <th className="p-3 text-right">Price</th>
                                            <th className="p-3 text-center">Qty</th>
                                            <th className="p-3 text-right">Line Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gold-500/10">
                                        {(inspectingOrder.itemsSnapshot || []).map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="p-3 font-medium text-cream">{item.productName} ({item.variantName})</td>
                                                <td className="p-3 text-cream/50">{item.sku}</td>
                                                <td className="p-3 text-right text-cream/70">{rupees(item.unitPricePaise)}</td>
                                                <td className="p-3 text-center text-cream/80 font-bold">{item.quantity}</td>
                                                <td className="p-3 text-right font-semibold text-gold-300">{rupees(item.lineTotalPaise)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminShell>
    );
};

// ----------------------------------------------------
// 3. CATALOGUE & CATEGORY MANAGEMENT
// ----------------------------------------------------
const CatalogueAdmin = () => {
    const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [openProductModal, setOpenProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const [openCategoryModal, setOpenCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const load = () =>
        Promise.all([api.adminProducts(), api.adminCategories()])
            .then(([items, cats]) => {
                setProducts(items);
                setCategories(cats);
            })
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load catalogue.'));

    useEffect(() => { void load(); }, []);

    // Create or Edit Product Submit
    const handleProductSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccessMessage('');
        const form = new FormData(event.currentTarget);

        try {
            if (editingProduct) {
                // Edit existing product
                await api.updateProduct(editingProduct.id, {
                    name: String(form.get('name')),
                    slug: String(form.get('slug')),
                    categoryId: String(form.get('categoryId')),
                    description: String(form.get('description')),
                    status: String(form.get('status')),
                });
                const file = form.get('file');
                if (file instanceof File && file.size) {
                    const imageForm = new FormData();
                    imageForm.set('file', file);
                    imageForm.set('altText', String(form.get('name')));
                    imageForm.set('sortOrder', '0');
                    await api.uploadProductImage(editingProduct.id, imageForm);
                }
                setSuccessMessage('Product updated successfully.');
            } else {
                // Create product
                const product = await api.createProduct({
                    categoryId: String(form.get('categoryId')),
                    name: String(form.get('name')),
                    slug: String(form.get('slug')),
                    shortDescription: String(form.get('description')),
                    description: String(form.get('description')),
                    status: String(form.get('status')),
                });
                await api.createVariant(product.id, {
                    sku: String(form.get('sku')).toUpperCase(),
                    name: String(form.get('variantName')),
                    pricePaise: Number(form.get('pricePaise')),
                    isActive: true,
                });
                const file = form.get('file');
                if (file instanceof File && file.size) {
                    const imageForm = new FormData();
                    imageForm.set('file', file);
                    imageForm.set('altText', product.name);
                    imageForm.set('sortOrder', '0');
                    await api.uploadProductImage(product.id, imageForm);
                }
                setSuccessMessage('New product created successfully.');
            }
            setOpenProductModal(false);
            setEditingProduct(null);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Product save failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteProduct = async (productId: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete product "${name}"?`)) return;
        try {
            await api.deleteProduct(productId);
            setSuccessMessage(`Product "${name}" deleted.`);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Product deletion failed.');
        }
    };

    // Category Submit
    const handleCategorySubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        const form = new FormData(event.currentTarget);
        try {
            if (editingCategory) {
                await api.updateCategory(editingCategory.id, {
                    name: String(form.get('name')),
                    slug: String(form.get('slug')),
                    description: String(form.get('description')),
                    isPublished: form.get('isPublished') === 'on',
                });
                setSuccessMessage('Category updated.');
            } else {
                await api.createCategory({
                    name: String(form.get('name')),
                    slug: String(form.get('slug')),
                    description: String(form.get('description')),
                    isPublished: form.get('isPublished') === 'on',
                });
                setSuccessMessage('New category created.');
            }
            setOpenCategoryModal(false);
            setEditingCategory(null);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Category save failed.');
        } finally {
            setSaving(false);
        }
    };

    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.slug.includes(searchQuery.toLowerCase());
            const matchesCat = !categoryFilter || p.categoryId === categoryFilter;
            const matchesStatus = !statusFilter || p.status === statusFilter;
            return matchesSearch && matchesCat && matchesStatus;
        });
    }, [products, searchQuery, categoryFilter, statusFilter]);

    return (
        <AdminShell
            title="Catalogue Command"
            description="Manage live luxury products, variants, media processing, and taxonomy categories."
            action={
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            setEditingCategory(null);
                            setOpenCategoryModal(true);
                        }}
                        className="flex h-11 items-center gap-2 border border-gold-500/30 bg-carbon px-4 text-xs font-bold uppercase tracking-wider text-cream hover:border-gold-400"
                    >
                        <IconPlus size={16} /> New Category
                    </button>
                    <button
                        onClick={() => {
                            setEditingProduct(null);
                            setOpenProductModal(true);
                        }}
                        className="flex h-11 items-center gap-2 bg-gold-400 px-5 text-xs font-bold uppercase tracking-wider text-obsidian shadow-lg hover:bg-gold-300"
                    >
                        <IconPlus size={16} /> Add Product
                    </button>
                </div>
            }
        >
            <NotificationToast message={error} type="error" onClose={() => setError('')} />
            <NotificationToast message={successMessage} type="success" onClose={() => setSuccessMessage('')} />

            {/* View Mode Tabs */}
            <div className="mb-6 border-b border-gold-500/20 flex gap-6">
                <button
                    onClick={() => setActiveTab('products')}
                    className={`pb-3 text-sm font-semibold tracking-wider transition-colors ${
                        activeTab === 'products' ? 'border-b-2 border-gold-400 text-gold-300' : 'text-cream/50 hover:text-cream'
                    }`}
                >
                    Products ({products.length})
                </button>
                <button
                    onClick={() => setActiveTab('categories')}
                    className={`pb-3 text-sm font-semibold tracking-wider transition-colors ${
                        activeTab === 'categories' ? 'border-b-2 border-gold-400 text-gold-300' : 'text-cream/50 hover:text-cream'
                    }`}
                >
                    Categories ({categories.length})
                </button>
            </div>

            {activeTab === 'products' ? (
                <div>
                    {/* Search & Filters */}
                    <div className="mb-6 flex flex-wrap gap-4">
                        <div className="flex flex-1 min-w-[240px] border border-gold-500/25 bg-carbon rounded-sm">
                            <IconSearch className="m-3 text-gold-400" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search products by name or slug…"
                                className="min-w-0 flex-1 bg-transparent text-sm text-cream outline-none"
                            />
                        </div>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="h-11 border border-gold-500/25 bg-obsidian px-4 text-xs text-cream outline-none rounded-sm"
                        >
                            <option value="">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-11 border border-gold-500/25 bg-obsidian px-4 text-xs text-cream outline-none rounded-sm"
                        >
                            <option value="">All Statuses</option>
                            <option value="PUBLISHED">Published</option>
                            <option value="DRAFT">Draft</option>
                            <option value="ARCHIVED">Archived</option>
                        </select>
                    </div>

                    {/* Products Table */}
                    <div className={`${box} overflow-x-auto`}>
                        <table className="w-full min-w-[850px] text-left text-sm">
                            <thead className="border-b border-gold-500/20 text-[9px] uppercase tracking-[0.2em] text-gold-400 bg-obsidian/60">
                                <tr>
                                    <th className="p-4">Product</th>
                                    <th className="p-4">Category</th>
                                    <th className="p-4">Variants</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Price</th>
                                    <th className="p-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gold-500/10">
                                {filteredProducts.map((product) => (
                                    <tr key={product.id} className="transition-colors hover:bg-gold-400/[.03]">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={product.images[0]?.thumbnailUrl || fallbackImage}
                                                    alt=""
                                                    className="size-12 rounded-sm border border-gold-500/20 object-cover bg-obsidian"
                                                />
                                                <div>
                                                    <strong className="font-display text-base font-normal text-cream">{product.name}</strong>
                                                    <small className="block text-[10px] text-cream/40">{product.slug}</small>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs text-cream/50">{product.category?.name || 'Unassigned'}</td>
                                        <td className="p-4 text-xs text-cream/70">{product.variants?.length || 0} variant(s)</td>
                                        <td className="p-4">
                                            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                                                product.status === 'PUBLISHED' ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300' : 'border-gold-500/30 bg-gold-950/30 text-gold-300'
                                            }`}>
                                                {titleCase(product.status)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-medium text-gold-300">
                                            {product.variants[0] ? rupees(product.variants[0].pricePaise) : '—'}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingProduct(product);
                                                        setOpenProductModal(true);
                                                    }}
                                                    className="p-2 text-cream/60 hover:text-gold-300 border border-gold-500/20 rounded-sm bg-obsidian"
                                                    title="Edit Product"
                                                >
                                                    <IconEdit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => void handleDeleteProduct(product.id, product.name)}
                                                    className="p-2 text-red-400/70 hover:text-red-300 border border-red-500/20 rounded-sm bg-obsidian"
                                                    title="Delete Product"
                                                >
                                                    <IconTrash size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!filteredProducts.length && <p className="p-10 text-center text-sm text-cream/40">No matching products found in catalogue.</p>}
                    </div>
                </div>
            ) : (
                /* Category Management View */
                <div className={`${box} overflow-x-auto`}>
                    <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="border-b border-gold-500/20 text-[9px] uppercase tracking-[0.2em] text-gold-400 bg-obsidian/60">
                            <tr>
                                <th className="p-4">Category Name</th>
                                <th className="p-4">Slug</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gold-500/10">
                            {categories.map((cat) => (
                                <tr key={cat.id}>
                                    <td className="p-4 font-display text-lg text-cream">{cat.name}</td>
                                    <td className="p-4 text-cream/40 font-mono text-xs">{cat.slug}</td>
                                    <td className="p-4">
                                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                                            cat.isPublished ? 'border-emerald-500/30 text-emerald-300' : 'border-gold-500/30 text-gold-300'
                                        }`}>
                                            {cat.isPublished ? 'Published' : 'Draft'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => {
                                                setEditingCategory(cat);
                                                setOpenCategoryModal(true);
                                            }}
                                            className="p-2 text-cream/60 hover:text-gold-300 border border-gold-500/20 rounded-sm bg-obsidian"
                                        >
                                            <IconEdit size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Product Modal (Create/Edit) */}
            {openProductModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-5 backdrop-blur-sm">
                    <form onSubmit={handleProductSubmit} className="mx-auto my-6 w-full max-w-2xl border border-gold-500/30 bg-carbon p-7 rounded-sm shadow-2xl">
                        <div className="flex justify-between border-b border-gold-500/20 pb-4">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.22em] text-gold-400 font-bold">Catalogue Manager</p>
                                <h2 className="mt-1 font-display text-3xl text-cream">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                            </div>
                            <button type="button" onClick={() => { setOpenProductModal(false); setEditingProduct(null); }} className="text-xs text-cream/40 hover:text-cream">
                                Close
                            </button>
                        </div>

                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Product Name</span>
                                <input name="name" defaultValue={editingProduct?.name || ''} className={inputStyle} required />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">URL Slug</span>
                                <input name="slug" defaultValue={editingProduct?.slug || ''} className={inputStyle} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Category</span>
                                <select name="categoryId" defaultValue={editingProduct?.categoryId || ''} className={inputStyle} required>
                                    <option value="">Select Category…</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Publish State</span>
                                <select name="status" defaultValue={editingProduct?.status || 'PUBLISHED'} className={inputStyle}>
                                    <option value="DRAFT">Draft</option>
                                    <option value="PUBLISHED">Published</option>
                                    <option value="ARCHIVED">Archived</option>
                                </select>
                            </label>

                            {!editingProduct && (
                                <>
                                    <label>
                                        <span className="mb-1.5 block text-xs text-cream/60 font-medium">SKU</span>
                                        <input name="sku" placeholder="GLK-PRODUCT-01" className={inputStyle} required />
                                    </label>
                                    <label>
                                        <span className="mb-1.5 block text-xs text-cream/60 font-medium">Variant Name</span>
                                        <input name="variantName" defaultValue="Standard Edition" className={inputStyle} required />
                                    </label>
                                    <label>
                                        <span className="mb-1.5 block text-xs text-cream/60 font-medium">Price in Paise (e.g. ₹999 = 99900)</span>
                                        <input name="pricePaise" type="number" min="0" defaultValue="99900" className={inputStyle} required />
                                    </label>
                                </>
                            )}

                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Description</span>
                                <textarea name="description" defaultValue={editingProduct?.description || ''} rows={4} className="w-full border border-gold-500/25 bg-obsidian p-4 text-sm text-cream outline-none focus:border-gold-400 rounded-sm" />
                            </label>

                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">{editingProduct ? 'Upload / Replace Main Image' : 'Product Image'}</span>
                                <input name="file" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-xs text-cream/50 file:mr-3 file:h-11 file:border-0 file:bg-gold-400 file:px-4 file:text-xs file:font-bold file:text-obsidian file:rounded-sm cursor-pointer" />
                            </label>
                        </div>

                        <button disabled={saving} className="mt-6 h-12 w-full bg-gold-400 text-xs font-bold uppercase tracking-[0.2em] text-obsidian disabled:opacity-50 hover:bg-gold-300 rounded-sm shadow-md">
                            {saving ? 'Saving Changes…' : editingProduct ? 'Update Product' : 'Create Product & Initial Variant'}
                        </button>
                    </form>
                </div>
            )}

            {/* Category Modal */}
            {openCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5 backdrop-blur-sm">
                    <form onSubmit={handleCategorySubmit} className="w-full max-w-lg border border-gold-500/30 bg-carbon p-6 rounded-sm shadow-2xl">
                        <div className="flex justify-between border-b border-gold-500/20 pb-4">
                            <h2 className="font-display text-2xl text-cream">{editingCategory ? 'Edit Category' : 'Create Category'}</h2>
                            <button type="button" onClick={() => { setOpenCategoryModal(false); setEditingCategory(null); }} className="text-xs text-cream/40">Close</button>
                        </div>
                        <div className="mt-5 space-y-4">
                            <label className="block">
                                <span className="mb-1.5 block text-xs text-cream/60">Category Name</span>
                                <input name="name" defaultValue={editingCategory?.name || ''} className={inputStyle} required />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-xs text-cream/60">URL Slug</span>
                                <input name="slug" defaultValue={editingCategory?.slug || ''} className={inputStyle} required />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-xs text-cream/60">Description</span>
                                <textarea name="description" defaultValue={editingCategory?.description || ''} rows={3} className="w-full border border-gold-500/25 bg-obsidian p-3 text-sm text-cream outline-none rounded-sm" />
                            </label>
                            <label className="flex items-center gap-2 text-xs text-cream">
                                <input type="checkbox" name="isPublished" defaultChecked={editingCategory ? editingCategory.isPublished : true} className="accent-gold-400 size-4" />
                                <span>Published on Storefront</span>
                            </label>
                        </div>
                        <button disabled={saving} className="mt-6 h-11 w-full bg-gold-400 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 rounded-sm">
                            {saving ? 'Saving Category…' : editingCategory ? 'Update Category' : 'Create Category'}
                        </button>
                    </form>
                </div>
            )}
        </AdminShell>
    );
};

// ----------------------------------------------------
// 4. SMART INVENTORY & STOCK EDITOR
// ----------------------------------------------------
const InventoryAdmin = () => {
    const [levels, setLevels] = useState<InventoryLevel[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [lowStockOnly, setLowStockOnly] = useState(false);

    const [editingLevel, setEditingLevel] = useState<InventoryLevel | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const load = () =>
        Promise.all([api.inventory(), api.adminProducts()])
            .then(([rows, items]) => {
                setLevels(rows);
                setProducts(items);
            })
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load inventory.'));

    useEffect(() => { void load(); }, []);

    const variantsMap = useMemo(() => {
        const map = new Map<string, { label: string; sku: string; name: string }>();
        for (const p of products) {
            for (const v of p.variants) {
                map.set(v.id, { label: `${p.name} · ${v.sku}`, sku: v.sku, name: p.name });
            }
        }
        return map;
    }, [products]);

    const handleSaveStock = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingLevel) return;
        setSaving(true);
        setError('');
        const form = new FormData(e.currentTarget);
        const onHand = Number(form.get('onHand'));
        const lowStockThreshold = Number(form.get('lowStockThreshold'));

        try {
            await api.setInventory(editingLevel.warehouseId, {
                variantId: editingLevel.variantId,
                onHand,
                lowStockThreshold,
            });
            setSuccessMsg('Inventory level updated successfully.');
            setEditingLevel(null);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to update stock.');
        } finally {
            setSaving(false);
        }
    };

    const filteredLevels = useMemo(() => {
        return levels.filter((level) => {
            const info = variantsMap.get(level.variantId);
            const matchesSearch = !searchQuery || (info && (info.sku.toLowerCase().includes(searchQuery.toLowerCase()) || info.name.toLowerCase().includes(searchQuery.toLowerCase())));
            const available = level.onHand - level.reserved;
            const matchesLowStock = !lowStockOnly || available <= level.lowStockThreshold;
            return matchesSearch && matchesLowStock;
        });
    }, [levels, variantsMap, searchQuery, lowStockOnly]);

    return (
        <AdminShell title="Inventory Control" description="Live warehouse stock levels, reservations, available SKUs, and low-stock alert thresholds.">
            <NotificationToast message={error} type="error" onClose={() => setError('')} />
            <NotificationToast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />

            {/* Filter Bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-1 min-w-[260px] border border-gold-500/25 bg-carbon rounded-sm">
                    <IconSearch className="m-3 text-gold-400" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by SKU or Product Name…"
                        className="min-w-0 flex-1 bg-transparent text-sm text-cream outline-none"
                    />
                </div>
                <button
                    onClick={() => setLowStockOnly(!lowStockOnly)}
                    className={`flex items-center gap-2 rounded-sm border px-4 py-2.5 text-xs font-semibold transition-all ${
                        lowStockOnly ? 'border-red-500/40 bg-red-950/40 text-red-200' : 'border-gold-500/25 bg-carbon text-cream/60 hover:border-gold-400'
                    }`}
                >
                    <IconAlert size={16} />
                    {lowStockOnly ? 'Showing Low Stock Alerts Only' : 'Filter Low Stock Alert SKUs'}
                </button>
            </div>

            {/* Inventory Table */}
            <div className={`${box} overflow-x-auto`}>
                <table className="w-full min-w-[750px] text-left text-sm">
                    <thead className="border-b border-gold-500/20 text-[9px] uppercase tracking-[0.2em] text-gold-400 bg-obsidian/60">
                        <tr>
                            <th className="p-4">SKU / Item</th>
                            <th className="p-4 text-center">On Hand</th>
                            <th className="p-4 text-center">Reserved</th>
                            <th className="p-4 text-center">Available</th>
                            <th className="p-4 text-center">Low Threshold</th>
                            <th className="p-4 text-center">Health Status</th>
                            <th className="p-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gold-500/10">
                        {filteredLevels.map((level) => {
                            const available = level.onHand - level.reserved;
                            const isLow = available <= level.lowStockThreshold;
                            const info = variantsMap.get(level.variantId);

                            return (
                                <tr key={level.id} className="transition-colors hover:bg-gold-400/[.03]">
                                    <td className="p-4 font-medium text-cream">
                                        {info ? info.label : level.variantId}
                                    </td>
                                    <td className="p-4 text-center font-display text-base text-cream">{level.onHand}</td>
                                    <td className="p-4 text-center text-cream/50">{level.reserved}</td>
                                    <td className={`p-4 text-center font-display text-lg font-bold ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {available}
                                    </td>
                                    <td className="p-4 text-center text-cream/40">{level.lowStockThreshold}</td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                                            isLow ? 'border-red-500/30 bg-red-950/30 text-red-300 animate-pulse' : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
                                        }`}>
                                            {isLow ? 'Low Stock Warning' : 'Stocked'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => setEditingLevel(level)}
                                            className="rounded-sm border border-gold-500/25 bg-carbon px-3 py-1.5 text-xs text-gold-300 hover:border-gold-400"
                                        >
                                            Adjust Stock
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {!filteredLevels.length && <p className="p-10 text-center text-sm text-cream/40">No inventory level records found.</p>}
            </div>

            {/* Adjust Stock Modal */}
            {editingLevel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5 backdrop-blur-sm">
                    <form onSubmit={handleSaveStock} className="w-full max-w-md border border-gold-500/30 bg-carbon p-6 rounded-sm shadow-2xl">
                        <div className="flex justify-between border-b border-gold-500/20 pb-4">
                            <div>
                                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gold-400">Warehouse Stock</span>
                                <h3 className="font-display text-2xl text-cream">Adjust SKU Level</h3>
                            </div>
                            <button type="button" onClick={() => setEditingLevel(null)} className="text-xs text-cream/40">Close</button>
                        </div>
                        <div className="mt-5 space-y-4">
                            <div>
                                <p className="text-xs text-cream/50">Target SKU:</p>
                                <p className="font-display text-lg text-gold-300">{variantsMap.get(editingLevel.variantId)?.label || editingLevel.variantId}</p>
                            </div>
                            <label className="block">
                                <span className="mb-1.5 block text-xs text-cream/70">On-Hand Warehouse Quantity</span>
                                <input name="onHand" type="number" min="0" defaultValue={editingLevel.onHand} className={inputStyle} required />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-xs text-cream/70">Low Stock Alert Threshold</span>
                                <input name="lowStockThreshold" type="number" min="0" defaultValue={editingLevel.lowStockThreshold} className={inputStyle} required />
                            </label>
                        </div>
                        <button disabled={saving} className="mt-6 h-12 w-full bg-gold-400 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 rounded-sm">
                            {saving ? 'Updating Level…' : 'Save Stock Levels'}
                        </button>
                    </form>
                </div>
            )}
        </AdminShell>
    );
};

// ----------------------------------------------------
// 5. PROMOTIONS & COUPON MANAGEMENT (NEW)
// ----------------------------------------------------
const PromotionsAdmin = () => {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [openModal, setOpenModal] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [saving, setSaving] = useState(false);

    const load = () =>
        api.coupons()
            .then(setCoupons)
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load coupons.'));

    useEffect(() => { void load(); }, []);

    const handleCreateCoupon = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        const form = new FormData(e.currentTarget);
        try {
            await api.createCoupon({
                code: String(form.get('code')).toUpperCase(),
                type: form.get('type') === 'PERCENT' ? 'PERCENT' : 'FIXED',
                value: Number(form.get('value')),
                minimumSubtotalPaise: Number(form.get('minimumSubtotalPaise')) || 0,
                usageLimit: form.get('usageLimit') ? Number(form.get('usageLimit')) : undefined,
                startsAt: new Date(String(form.get('startsAt'))).toISOString(),
                endsAt: new Date(String(form.get('endsAt'))).toISOString(),
                isActive: true,
            });
            setSuccessMsg('Promotional coupon created.');
            setOpenModal(false);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Coupon creation failed.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminShell
            title="Promotions & Discounts"
            description="Manage promotional coupons, percentage discounts, minimum cart spend limits, and coupon expiration dates."
            action={
                <button onClick={() => setOpenModal(true)} className="flex h-11 items-center gap-2 bg-gold-400 px-5 text-xs font-bold uppercase tracking-wider text-obsidian shadow-lg hover:bg-gold-300">
                    <IconPlus size={16} /> Create Coupon
                </button>
            }
        >
            <NotificationToast message={error} type="error" onClose={() => setError('')} />
            <NotificationToast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />

            {/* Coupons Table */}
            <div className={`${box} overflow-x-auto`}>
                <table className="w-full min-w-[750px] text-left text-sm">
                    <thead className="border-b border-gold-500/20 text-[9px] uppercase tracking-[0.2em] text-gold-400 bg-obsidian/60">
                        <tr>
                            <th className="p-4">Coupon Code</th>
                            <th className="p-4">Discount</th>
                            <th className="p-4">Min Spend</th>
                            <th className="p-4">Usage Limit</th>
                            <th className="p-4">Valid Period</th>
                            <th className="p-4 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gold-500/10">
                        {coupons.map((c) => (
                            <tr key={c.id} className="transition-colors hover:bg-gold-400/[.03]">
                                <td className="p-4 font-mono font-bold text-gold-300 text-base">{c.code}</td>
                                <td className="p-4 font-semibold text-cream">
                                    {c.type === 'PERCENT' ? `${c.value}% OFF` : rupees(c.value)}
                                </td>
                                <td className="p-4 text-cream/50 text-xs">{rupees(c.minimumSubtotalPaise)}</td>
                                <td className="p-4 text-cream/70 text-xs">{c.usageLimit ?? 'Unlimited'}</td>
                                <td className="p-4 text-cream/40 text-xs">{shortDate(c.startsAt)} → {shortDate(c.endsAt)}</td>
                                <td className="p-4 text-center">
                                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                                        c.isActive ? 'border-emerald-500/30 text-emerald-300' : 'border-gold-500/30 text-cream/40'
                                    }`}>
                                        {c.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!coupons.length && <p className="p-10 text-center text-sm text-cream/40">No promotional coupon codes created yet.</p>}
            </div>

            {/* Create Coupon Modal */}
            {openModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5 backdrop-blur-sm">
                    <form onSubmit={handleCreateCoupon} className="w-full max-w-lg border border-gold-500/30 bg-carbon p-6 rounded-sm shadow-2xl">
                        <div className="flex justify-between border-b border-gold-500/20 pb-4">
                            <h3 className="font-display text-2xl text-cream">Create Promo Coupon</h3>
                            <button type="button" onClick={() => setOpenModal(false)} className="text-xs text-cream/40">Close</button>
                        </div>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <label className="sm:col-span-2">
                                <span className="mb-1 block text-xs text-cream/70">Coupon Code</span>
                                <input name="code" placeholder="WELCOME10" className={inputStyle} required />
                            </label>
                            <label>
                                <span className="mb-1 block text-xs text-cream/70">Discount Type</span>
                                <select name="type" className={inputStyle}>
                                    <option value="PERCENT">Percentage (%)</option>
                                    <option value="FIXED">Fixed Amount (Paise)</option>
                                </select>
                            </label>
                            <label>
                                <span className="mb-1 block text-xs text-cream/70">Discount Value (e.g. 15 for 15%)</span>
                                <input name="value" type="number" min="1" defaultValue="15" className={inputStyle} required />
                            </label>
                            <label>
                                <span className="mb-1 block text-xs text-cream/70">Min Subtotal in Paise</span>
                                <input name="minimumSubtotalPaise" type="number" defaultValue="0" className={inputStyle} />
                            </label>
                            <label>
                                <span className="mb-1 block text-xs text-cream/70">Usage Limit (Max Uses)</span>
                                <input name="usageLimit" type="number" placeholder="Optional" className={inputStyle} />
                            </label>
                            <label>
                                <span className="mb-1 block text-xs text-cream/70">Starts At</span>
                                <input name="startsAt" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={inputStyle} required />
                            </label>
                            <label>
                                <span className="mb-1 block text-xs text-cream/70">Ends At</span>
                                <input name="endsAt" type="date" defaultValue={new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]} className={inputStyle} required />
                            </label>
                        </div>
                        <button disabled={saving} className="mt-6 h-12 w-full bg-gold-400 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 rounded-sm">
                            {saving ? 'Creating…' : 'Publish Promo Code'}
                        </button>
                    </form>
                </div>
            )}
        </AdminShell>
    );
};

// ----------------------------------------------------
// 6. AUDIT LOGS & SYSTEM SECURITY (NEW)
// ----------------------------------------------------
const AuditLogsAdmin = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        api.auditLogs()
            .then(setLogs)
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load audit logs.'));
    }, []);

    return (
        <AdminShell title="Security Audit Logs" description="Full immutable security audit trail documenting actor actions, entity mutations, and IP signatures.">
            <NotificationToast message={error} type="error" onClose={() => setError('')} />

            <div className={`${box} overflow-x-auto`}>
                <table className="w-full min-w-[750px] text-left text-xs">
                    <thead className="border-b border-gold-500/20 text-[9px] uppercase tracking-[0.2em] text-gold-400 bg-obsidian/60">
                        <tr>
                            <th className="p-4">Timestamp</th>
                            <th className="p-4">Action</th>
                            <th className="p-4">Entity Type</th>
                            <th className="p-4">Entity ID</th>
                            <th className="p-4">IP Address</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gold-500/10 font-mono">
                        {logs.map((log) => (
                            <tr key={log.id} className="transition-colors hover:bg-gold-400/[.03]">
                                <td className="p-4 text-cream/50">{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                                <td className="p-4 text-gold-300 font-bold font-sans">{log.action}</td>
                                <td className="p-4 text-cream/70">{log.entityType}</td>
                                <td className="p-4 text-cream/40">{log.entityId || '—'}</td>
                                <td className="p-4 text-cream/50">{log.ipAddress || 'Internal'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!logs.length && <p className="p-10 text-center text-sm text-cream/40">No audit log records found.</p>}
            </div>
        </AdminShell>
    );
};

// ----------------------------------------------------
// 7. OPERATIONS & INFRASTRUCTURE MONITORING
// ----------------------------------------------------
const OperationsAdmin = () => {
    const [ops, setOps] = useState<OperationsSnapshot | null>(null);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const load = () => {
        setRefreshing(true);
        api.operations()
            .then(setOps)
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load operations.'))
            .finally(() => setRefreshing(false));
    };

    useEffect(() => { void load(); }, []);

    const signals = ops
        ? [
              ['Database Engine', ops.databaseHealthy ? 'Healthy' : 'Unhealthy'],
              ['API Server Errors', ops.apiServerErrorsTotal],
              ['Failed Webhooks', ops.failedWebhooks],
              ['Terminal Job Failures', ops.terminalJobFailures],
              ['Expired Pending Payments', ops.expiredPendingPayments],
              ['Payment Mismatches', ops.paymentMismatches],
              ['Failed Refunds', ops.failedRefunds],
              ['Low-stock SKUs Alert', ops.lowStockSkus],
          ]
        : [];

    return (
        <AdminShell
            title="Infrastructure & Operations"
            description="Diagnostic signals, database health checks, webhook delivery telemetry, and background worker state."
            action={
                <button
                    onClick={() => void load()}
                    disabled={refreshing}
                    className="flex items-center gap-2 border border-gold-400 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-gold-300 hover:bg-gold-400 hover:text-obsidian"
                >
                    <IconRefresh size={16} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Checking Signals…' : 'Refresh Telemetry'}
                </button>
            }
        >
            <NotificationToast message={error} type="error" onClose={() => setError('')} />

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {signals.map(([label, value]) => {
                    const healthy = value === 'Healthy' || value === 0;
                    return (
                        <article key={String(label)} className={`${box} p-6 transition-all hover:border-gold-500/40`}>
                            <div className="flex items-center justify-between">
                                <span className={healthy ? 'text-emerald-400' : 'text-amber-400'}>
                                    {healthy ? <IconCheckCircle color="#10B981" size={22} /> : <IconAlert size={22} />}
                                </span>
                                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${healthy ? 'bg-emerald-950/30 text-emerald-300' : 'bg-amber-950/30 text-amber-300'}`}>
                                    {healthy ? 'Pass' : 'Attention'}
                                </span>
                            </div>
                            <p className="mt-4 text-[10px] uppercase tracking-[0.2em] font-semibold text-cream/40">{label}</p>
                            <strong className="mt-2 block font-display text-3xl text-cream">{String(value)}</strong>
                        </article>
                    );
                })}
            </div>

            {ops && (
                <div className="mt-6 flex items-center justify-between border-t border-gold-500/15 pt-4 text-xs text-cream/40">
                    <span>Telemetry check timestamp: {new Date(ops.checkedAt).toLocaleString('en-IN')}</span>
                    <span className="text-emerald-400">All system components operating nominal</span>
                </div>
            )}
        </AdminShell>
    );
};

// ----------------------------------------------------
// 8. USER MANAGEMENT & ROLE ASSIGNMENT (NEW)
// ----------------------------------------------------
const UsersAdmin = () => {
    const [userId, setUserId] = useState('');
    const [role, setRole] = useState('ADMIN');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleAssignRole = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!userId) return;
        setSaving(true);
        setError('');
        setSuccessMsg('');

        try {
            await api.assignRole(userId.trim(), role);
            setSuccessMsg(`Role ${role} successfully assigned to user ${userId}.`);
            setUserId('');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Role assignment failed.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminShell title="User & Role Administration" description="Manage security roles, assign administrative access privileges, and configure RBAC authorization.">
            <NotificationToast message={error} type="error" onClose={() => setError('')} />
            <NotificationToast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />

            <div className="grid gap-6 md:grid-cols-2">
                <form onSubmit={handleAssignRole} className={`${box} p-6 space-y-4`}>
                    <h3 className="font-display text-2xl text-cream border-b border-gold-500/15 pb-3">Assign Security Role</h3>
                    <label className="block">
                        <span className="mb-1.5 block text-xs text-cream/70">User ID (UUID)</span>
                        <input
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="e.g. 11111111-2222-3333-4444-555555555555"
                            className={inputStyle}
                            required
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs text-cream/70">Assign Role</span>
                        <select value={role} onChange={(e) => setRole(e.target.value)} className={inputStyle}>
                            <option value="ADMIN">ADMIN — Full System Operations Access</option>
                            <option value="CATALOGUE_MANAGER">CATALOGUE_MANAGER — Products & Categories</option>
                            <option value="WAREHOUSE_MANAGER">WAREHOUSE_MANAGER — Inventory Control</option>
                            <option value="SUPPORT_AGENT">SUPPORT_AGENT — Customer & Orders Support</option>
                        </select>
                    </label>
                    <button disabled={saving} className="mt-4 h-12 w-full bg-gold-400 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 rounded-sm">
                        {saving ? 'Assigning Role…' : 'Update User Authorization'}
                    </button>
                </form>

                <div className={`${box} p-6 space-y-4`}>
                    <h3 className="font-display text-2xl text-gold-300 border-b border-gold-500/15 pb-3">Role Permissions Reference</h3>
                    <div className="space-y-3 text-xs text-cream/70">
                        <div>
                            <strong className="text-gold-400">ADMIN:</strong> Unrestricted operational capabilities, financial telemetry, audit logs, and security governance.
                        </div>
                        <div>
                            <strong className="text-gold-400">CATALOGUE_MANAGER:</strong> Product creation/editing, variant price adjustments, media derivative processing, category taxonomy.
                        </div>
                        <div>
                            <strong className="text-gold-400">WAREHOUSE_MANAGER:</strong> Multi-warehouse stock level adjustments, low-stock threshold monitoring, SKU receipts.
                        </div>
                        <div>
                            <strong className="text-gold-400">SUPPORT_AGENT:</strong> Order inspection, status transitions, guest order lookups, customer invoice generation.
                        </div>
                    </div>
                </div>
            </div>
        </AdminShell>
    );
};

// ----------------------------------------------------
// MAIN ROUTER CONTAINER
// ----------------------------------------------------
const AdminPage = () => {
    const { signedIn } = useAuth();
    const path = useLocation().pathname;

    if (!signedIn) return <Redirect to="/auth?next=/admin" />;

    if (path.startsWith('/admin/orders')) return <OrdersAdmin />;
    if (path.startsWith('/admin/catalogue')) return <CatalogueAdmin />;
    if (path.startsWith('/admin/inventory')) return <InventoryAdmin />;
    if (path.startsWith('/admin/promotions')) return <PromotionsAdmin />;
    if (path.startsWith('/admin/users')) return <UsersAdmin />;
    if (path.startsWith('/admin/audit-logs')) return <AuditLogsAdmin />;
    if (path.startsWith('/admin/operations')) return <OperationsAdmin />;

    return <Overview />;
};

export default AdminPage;
