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
import { useDialog } from '../hooks/useDialog';
import { api } from '../lib/api';
import {
    catalogueCsvExport,
    catalogueCsvTemplate,
    driveLinksFromCsvCell,
    importBoolean,
    importRupeesToPaise,
    parseCatalogueCsv,
    validateCatalogueCsvRows,
} from '../lib/catalogue-csv';
import { fallbackImage, rupees, shortDate, titleCase } from '../lib/commerce';
import { openTrustedUrl } from '../lib/navigation';
import { AuditLog, Category, Coupon, InventoryLevel, OperationsSnapshot, Order, Product, ProductVariant, Warehouse } from '../types';

const box = 'border border-line bg-carbon';
const inputStyle = 'field h-12 w-full text-sm';

const downloadCsv = (filename: string, contents: string): void => {
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
};

const NotificationToast = ({ message, type = 'info', onClose }: { message: string; type?: 'info' | 'success' | 'error'; onClose: () => void }) => {
    if (!message) return null;
    const bg =
        type === 'error'
            ? 'bg-red-950/80 border-red-500/40 text-red-200'
            : type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-gold-950/80 border-gold-500/40 text-gold-200';
    return (
        <div className={`mb-6 flex items-center justify-between border p-4 text-sm ${bg} rounded-sm shadow-md animate-fadeIn`} role="status" aria-live="polite">
            <span>{message}</span>
            <button aria-label="Close notification" onClick={onClose} className="ml-4 opacity-70 hover:opacity-100">
                <IconClose size={16} />
            </button>
        </div>
    );
};

// ----------------------------------------------------
// 1. OVERVIEW / DASHBOARD ANALYTICS
// ----------------------------------------------------
const RevenueChart = ({ orders }: { orders: Order[] }) => {
    const points = Array.from({ length: 7 }, (_, offset) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - offset));
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const rev = orders
            .filter((order) => {
                const createdAt = new Date(order.createdAt);
                return createdAt >= date && createdAt < nextDate;
            })
            .reduce((sum, order) => sum + order.totalPaise, 0);
        return { day: date.toLocaleDateString('en-IN', { weekday: 'short' }), rev };
    });
    const max = Math.max(...points.map((point) => point.rev), 1);
    const weeklyRevenue = points.reduce((sum, point) => sum + point.rev, 0);
    const height = 140;
    const width = 500;
    const pathD = points
        .map((p, i) => {
            const x = (i / (points.length - 1)) * width;
            const y = height - (p.rev / max) * height;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');

    return (
        <div className={`${box} p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gold-500/15 pb-4">
                <div>
                    <span className="eyebrow">Weekly performance</span>
                    <h3 className="font-display text-2xl text-cream">Revenue by day</h3>
                </div>
                <div className="flex items-center gap-2 border border-line px-3 py-1 text-xs text-cream/55">
                    <IconTrendingUp size={14} />
                    <span>Last 7 days</span>
                </div>
            </div>
            <div className="mt-6">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full overflow-visible"
                    role="img"
                    aria-label={`Revenue over the last seven days. Total ${rupees(weeklyRevenue)}.`}
                >
                    <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c9a35b" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#c9a35b" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {/* Fill */}
                    <path d={`${pathD} L ${width} ${height} L 0 ${height} Z`} fill="url(#chartGradient)" />
                    {/* Line */}
                    <path d={pathD} fill="none" stroke="#c9a35b" strokeWidth="2.5" strokeLinecap="round" />
                    {/* Data Points */}
                    {points.map((p, i) => {
                        const x = (i / (points.length - 1)) * width;
                        const y = height - (p.rev / max) * height;
                        return (
                            <g key={p.day} className="group cursor-pointer">
                                <circle cx={x} cy={y} r="4" fill="#11110f" stroke="#c9a35b" strokeWidth="2" />
                                <text x={x} y={height + 20} textAnchor="middle" fill="#9CA3AF" fontSize="10">
                                    {p.day}
                                </text>
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

            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border border-line bg-panel p-6">
                <div>
                    <h3 className="font-display text-xl text-cream">Common actions</h3>
                    <p className="mt-1 text-xs text-cream/50">Add products, reconcile stock, or create a promotion.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <a href="/admin/catalogue" className="button-primary gap-2">
                        <IconPlus size={16} /> Add Product
                    </a>
                    <a href="/admin/inventory" className="button-secondary gap-2">
                        <IconRefresh size={16} /> Adjust Stock
                    </a>
                    <a href="/admin/promotions" className="button-secondary gap-2">
                        <IconTag size={16} /> Create Coupon
                    </a>
                </div>
            </div>

            {/* Top Metrics Cards */}
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    {
                        label: 'Loaded order value',
                        value: rupees(totalRevenue),
                        badge: 'Current result set',
                        isAlert: false,
                    },
                    {
                        label: 'Orders loaded',
                        value: String(orders.length),
                        badge: 'Current result set',
                        isAlert: false,
                    },
                    {
                        label: 'Low Stock SKUs',
                        value: String(ops?.lowStockSkus ?? '0'),
                        badge: ops?.lowStockSkus ? 'Action Needed' : 'Healthy',
                        isAlert: Boolean(ops?.lowStockSkus),
                    },
                    {
                        label: 'Payment Mismatches',
                        value: String(ops?.paymentMismatches ?? '0'),
                        badge: ops?.paymentMismatches ? 'Alert' : 'Clean',
                        isAlert: Boolean(ops?.paymentMismatches),
                    },
                ].map((item) => (
                    <article key={item.label} className={`${box} p-6 transition-colors hover:border-gold-500/40`}>
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-cream/40">{item.label}</p>
                            <span
                                className={`border px-2.5 py-0.5 text-[10px] font-bold ${item.isAlert ? 'border-red-500/30 bg-red-950/30 text-red-300' : 'border-line text-cream/50'}`}
                            >
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
                    <RevenueChart orders={orders} />
                </div>
                <div className={`${box} p-6`}>
                    <h3 className="font-display text-2xl text-cream">System Signals</h3>
                    <p className="mt-1 text-xs text-cream/40">Real-time status of backend services</p>
                    <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-gold-500/10 pb-3">
                            <span className="text-xs text-cream/70">Database Engine</span>
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${ops?.databaseHealthy ? 'text-emerald-400' : 'text-amber-300'}`}>
                                <IconCheckCircle size={14} color={ops?.databaseHealthy ? '#10B981' : '#f59e0b'} />{' '}
                                {ops ? (ops.databaseHealthy ? 'Healthy' : 'Needs attention') : 'Unavailable'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between border-b border-gold-500/10 pb-3">
                            <span className="text-xs text-cream/70">API Error Total</span>
                            <span className="text-xs text-cream/80 font-medium">{ops?.apiServerErrorsTotal ?? 0} errors</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-gold-500/10 pb-3">
                            <span className="text-xs text-cream/70">Webhook Processing</span>
                            <span className="text-xs text-cream/80 font-medium">
                                {ops ? (ops.failedWebhooks ? `${ops.failedWebhooks} failed` : 'All processed') : '—'}
                            </span>
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
                    <a href="/admin/orders" className="text-xs uppercase tracking-wider text-gold-400 hover:text-gold-200">
                        View all orders
                    </a>
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
                                                <option key={st} value={st}>
                                                    {titleCase(st)}
                                                </option>
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
    const orderDialogRef = useDialog<HTMLDivElement>(Boolean(inspectingOrder), () => setInspectingOrder(null));

    const load = (search = '') =>
        api
            .adminOrders(
                new URLSearchParams({
                    limit: '100',
                    ...(search ? { search } : {}),
                }).toString(),
            )
            .then(setOrders)
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load orders.'));

    useEffect(() => {
        void load();
    }, []);

    const transition = async (order: Order, status: string) => {
        if (!window.confirm(`Move ${order.orderNumber} to ${titleCase(status)}?`)) return;
        try {
            await api.transitionOrder(order.id, status);
            await load(query);
            if (inspectingOrder?.id === order.id) {
                setInspectingOrder((prev) => (prev ? { ...prev, status } : null));
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
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void load(query);
                    }}
                    className="flex w-full max-w-md border border-gold-500/25 bg-carbon rounded-sm"
                >
                    <IconSearch className="m-3 text-gold-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none text-cream"
                        placeholder="Search order number or customer email…"
                    />
                    <button className="bg-gold-400 px-5 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300">Search</button>
                </form>

                <div className="flex flex-wrap gap-2">
                    {['ALL', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
                        <button
                            key={st}
                            onClick={() => setStatusFilter(st)}
                            className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors ${
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
                    <div
                        ref={orderDialogRef}
                        tabIndex={-1}
                        className="w-full max-w-3xl rounded-sm border border-gold-500/30 bg-carbon p-6 shadow-2xl max-h-[90vh] overflow-y-auto outline-none"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-order-dialog-title"
                    >
                        <div className="flex items-center justify-between border-b border-gold-500/20 pb-4">
                            <div>
                                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gold-400">Order Inspection</span>
                                <h2 id="admin-order-dialog-title" className="font-display text-3xl text-cream">
                                    {inspectingOrder.orderNumber}
                                </h2>
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
                                    <p>
                                        <strong className="text-cream">Recipient:</strong> {inspectingOrder.addressSnapshot?.recipientName || 'Customer'}
                                    </p>
                                    <p>
                                        <strong className="text-cream">Email:</strong> {inspectingOrder.addressSnapshot?.email || 'N/A'}
                                    </p>
                                    <p>
                                        <strong className="text-cream">Phone:</strong> {inspectingOrder.addressSnapshot?.phone || 'N/A'}
                                    </p>
                                    <p>
                                        <strong className="text-cream">Address:</strong> {inspectingOrder.addressSnapshot?.line1},{' '}
                                        {inspectingOrder.addressSnapshot?.city}, {inspectingOrder.addressSnapshot?.state}{' '}
                                        {inspectingOrder.addressSnapshot?.postalCode}
                                    </p>
                                </div>
                            </div>

                            <div className="border border-gold-500/15 bg-obsidian/60 p-4 rounded-sm">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gold-400">Fulfilment & Financials</h4>
                                <div className="mt-3 space-y-1.5 text-xs text-cream/70">
                                    <p>
                                        <strong className="text-cream">Current Status:</strong>{' '}
                                        <span className="text-gold-300 font-semibold">{titleCase(inspectingOrder.status)}</span>
                                    </p>
                                    <p>
                                        <strong className="text-cream">Placed On:</strong> {new Date(inspectingOrder.createdAt).toLocaleString('en-IN')}
                                    </p>
                                    <p>
                                        <strong className="text-cream">Total Amount:</strong>{' '}
                                        <span className="font-display text-base text-gold-300">{rupees(inspectingOrder.totalPaise)}</span>
                                    </p>
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
                                                <td className="p-3 font-medium text-cream">
                                                    {item.productName} ({item.variantName})
                                                </td>
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
interface VariantDraft {
    key: string;
    id?: string;
    sku: string;
    barcode: string;
    name: string;
    color: string;
    colorHex: string;
    priceRupees: string;
    compareAtPriceRupees: string;
    isActive: boolean;
    attributes: Record<string, unknown>;
    images: File[];
    driveImageUrls: string;
}

let variantDraftCounter = 0;

const variantAttribute = (variant: ProductVariant, key: string): string => {
    const value = variant.attributes?.[key];
    return typeof value === 'string' ? value : '';
};

const paiseToRupeesInput = (paise: number): string => String(paise / 100);

const rupeesInputToPaise = (rupeesValue: string): number =>
    Math.round(Number(rupeesValue) * 100);

const driveImageLinks = (value: string): string[] =>
    value
        .split(/\r?\n/)
        .map((link) => link.trim())
        .filter(Boolean);

const createVariantDraft = (variant?: ProductVariant): VariantDraft => ({
    key: variant?.id || `new-variant-${++variantDraftCounter}`,
    id: variant?.id,
    sku: variant?.sku || '',
    barcode: variant?.barcode || '',
    name: variant?.name || '',
    color: variant ? variantAttribute(variant, 'color') : '',
    colorHex: variantAttribute(variant || ({ attributes: {} } as ProductVariant), 'colorHex') || '#C5A059',
    priceRupees: variant ? paiseToRupeesInput(variant.pricePaise) : '',
    compareAtPriceRupees: variant?.compareAtPricePaise
        ? paiseToRupeesInput(variant.compareAtPricePaise)
        : '',
    isActive: variant?.isActive ?? true,
    attributes: variant?.attributes || {},
    images: [],
    driveImageUrls: '',
});

const CatalogueAdmin = () => {
    const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [openProductModal, setOpenProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([createVariantDraft()]);
    const [imageAssignments, setImageAssignments] = useState<Record<string, string | null>>({});

    const [openCategoryModal, setOpenCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const [bulkImporting, setBulkImporting] = useState(false);
    const [bulkImportErrors, setBulkImportErrors] = useState<string[]>([]);
    const productDialogRef = useDialog<HTMLFormElement>(openProductModal, () => {
        setOpenProductModal(false);
        setEditingProduct(null);
    });
    const categoryDialogRef = useDialog<HTMLFormElement>(openCategoryModal, () => {
        setOpenCategoryModal(false);
        setEditingCategory(null);
    });

    const load = () =>
        Promise.all([api.adminProducts(), api.adminCategories()])
            .then(([items, cats]) => {
                setProducts(items);
                setCategories(cats);
            })
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load catalogue.'));

    useEffect(() => {
        void load();
    }, []);

    const openProductEditor = (product: Product | null) => {
        setEditingProduct(product);
        setVariantDrafts(product?.variants.length ? product.variants.map(createVariantDraft) : [createVariantDraft()]);
        setImageAssignments(Object.fromEntries((product?.images || []).map((image) => [image.id, image.variantId || null])));
        setError('');
        setOpenProductModal(true);
    };

    const updateVariantDraft = (key: string, update: Partial<VariantDraft>) => {
        setVariantDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...update } : draft)));
    };

    // Create or Edit Product Submit
    const handleProductSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccessMessage('');
        const form = new FormData(event.currentTarget);

        try {
            let productId: string;
            let productName: string;
            if (variantDrafts.length === 0 || !variantDrafts.some((variant) => variant.isActive)) {
                throw new Error('Add at least one active product option.');
            }

            if (editingProduct) {
                const product = await api.updateProduct(editingProduct.id, {
                    name: String(form.get('name')),
                    slug: String(form.get('slug')),
                    categoryId: String(form.get('categoryId')),
                    description: String(form.get('description')),
                    shortDescription: String(form.get('description')),
                    material: String(form.get('material')),
                    dimensions: String(form.get('dimensions')),
                    status: String(form.get('status')),
                });
                productId = product.id;
                productName = product.name;
            } else {
                const product = await api.createProduct({
                    categoryId: String(form.get('categoryId')),
                    name: String(form.get('name')),
                    slug: String(form.get('slug')),
                    shortDescription: String(form.get('description')),
                    description: String(form.get('description')),
                    material: String(form.get('material')),
                    dimensions: String(form.get('dimensions')),
                    status: String(form.get('status')),
                });
                productId = product.id;
                productName = product.name;
            }

            for (const draft of variantDrafts) {
                const color = draft.color.trim();
                const input = {
                    sku: draft.sku.trim().toUpperCase(),
                    barcode: draft.barcode.trim().toUpperCase() || null,
                    name: draft.name.trim(),
                    pricePaise: rupeesInputToPaise(draft.priceRupees),
                    ...(draft.compareAtPriceRupees
                        ? { compareAtPricePaise: rupeesInputToPaise(draft.compareAtPriceRupees) }
                        : {}),
                    attributes: draft.attributes,
                    ...(color ? { color, colorHex: draft.colorHex } : {}),
                    isActive: draft.isActive,
                };
                const savedVariant = draft.id ? await api.updateVariant(draft.id, input) : await api.createVariant(productId, input);

                for (const [index, file] of draft.images.entries()) {
                    const imageForm = new FormData();
                    imageForm.set('file', file);
                    imageForm.set('variantId', savedVariant.id);
                    imageForm.set('altText', `${productName} — ${color || draft.name}`);
                    imageForm.set('sortOrder', String(index));
                    await api.uploadProductImage(productId, imageForm);
                }

                for (const [index, driveUrl] of driveImageLinks(draft.driveImageUrls).entries()) {
                    await api.importGoogleDriveImage(productId, {
                        driveUrl,
                        variantId: savedVariant.id,
                        altText: `${productName} — ${color || draft.name}`,
                        sortOrder: draft.images.length + index,
                    });
                }
            }

            if (editingProduct) {
                for (const image of editingProduct.images) {
                    const variantId = imageAssignments[image.id] ?? null;
                    if (variantId !== (image.variantId ?? null)) {
                        await api.updateProductImage(productId, image.id, { variantId });
                    }
                }
            }

            const imageFiles = form.getAll('images').filter((file): file is File => file instanceof File && file.size > 0);
            for (const [index, file] of imageFiles.entries()) {
                const imageForm = new FormData();
                imageForm.set('file', file);
                imageForm.set('altText', productName);
                imageForm.set('sortOrder', String(index));
                await api.uploadProductImage(productId, imageForm);
            }

            const sharedDriveLinks = driveImageLinks(String(form.get('driveImageUrls') || ''));
            for (const [index, driveUrl] of sharedDriveLinks.entries()) {
                await api.importGoogleDriveImage(productId, {
                    driveUrl,
                    altText: productName,
                    sortOrder: imageFiles.length + index,
                });
            }

            const videoUrl = String(form.get('videoUrl') || '').trim();
            if (videoUrl) {
                await api.addProductVideoUrl(productId, {
                    url: videoUrl,
                    altText: productName,
                });
            }
            const videoFile = form.get('videoFile');
            if (videoFile instanceof File && videoFile.size > 0) {
                const videoForm = new FormData();
                videoForm.set('file', videoFile);
                videoForm.set('altText', productName);
                await api.uploadProductVideo(productId, videoForm);
            }
            setSuccessMessage(editingProduct ? 'Product updated successfully.' : 'New product created successfully.');
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

    const handleBulkImport = async (file: File) => {
        setBulkImporting(true);
        setBulkImportErrors([]);
        setError('');
        setSuccessMessage('');
        try {
            const rows = parseCatalogueCsv(await file.text());
            const validationErrors = validateCatalogueCsvRows(rows, new Set(categories.map((category) => category.slug)));
            if (validationErrors.length > 0) {
                setBulkImportErrors(validationErrors);
                setError(`Import stopped: ${validationErrors.length} validation error(s). No products were changed.`);
                return;
            }

            const groups = new Map<string, typeof rows>();
            for (const row of rows) groups.set(row.product_slug, [...(groups.get(row.product_slug) || []), row]);
            if (!window.confirm(`Import ${rows.length} variant row(s) across ${groups.size} product(s)? Matching slugs and SKUs will be updated.`)) return;

            const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
            const productBySlug = new Map(products.map((product) => [product.slug, product]));
            const importErrors: string[] = [];
            let productsCreated = 0;
            let productsUpdated = 0;
            let variantsCreated = 0;
            let variantsUpdated = 0;

            for (const [slug, productRows] of groups) {
                const base = productRows[0];
                const category = categoryBySlug.get(base.category_slug)!;
                let savedProduct: Product;
                try {
                    const productInput = {
                        categoryId: category.id,
                        name: base.product_name,
                        slug,
                        shortDescription: base.short_description,
                        description: base.description,
                        material: base.material,
                        dimensions: base.dimensions,
                        status: base.status.toUpperCase(),
                    };
                    const existingProduct = productBySlug.get(slug);
                    if (existingProduct) {
                        savedProduct = await api.updateProduct(existingProduct.id, productInput);
                        productsUpdated += 1;
                    } else {
                        savedProduct = await api.createProduct(productInput);
                        productsCreated += 1;
                    }
                    productBySlug.set(slug, savedProduct);
                } catch (caught) {
                    const message = caught instanceof Error ? caught.message : 'Product save failed.';
                    importErrors.push(`Product “${slug}”: ${message}`);
                    continue;
                }

                const existingVariants = new Map(
                    (products.find((product) => product.slug === slug)?.variants || []).map((variant) => [variant.sku, variant]),
                );
                for (const row of productRows) {
                    try {
                        const sku = row.sku.toUpperCase();
                        const existingVariant = existingVariants.get(sku);
                        const variantInput = {
                            sku,
                            barcode: row.barcode ? row.barcode.toUpperCase() : null,
                            name: row.variant_name,
                            pricePaise: importRupeesToPaise(row.price_rupees)!,
                            ...(row.compare_at_price_rupees
                                ? { compareAtPricePaise: importRupeesToPaise(row.compare_at_price_rupees)! }
                                : {}),
                            attributes: existingVariant?.attributes || {},
                            ...(row.color ? { color: row.color } : {}),
                            ...(row.color_hex ? { colorHex: row.color_hex.toUpperCase() } : {}),
                            isActive: row.is_active ? importBoolean(row.is_active)! : true,
                        };
                        const savedVariant = existingVariant
                            ? await api.updateVariant(existingVariant.id, variantInput)
                            : await api.createVariant(savedProduct.id, variantInput);
                        if (existingVariant) variantsUpdated += 1;
                        else variantsCreated += 1;

                        for (const [index, driveUrl] of driveLinksFromCsvCell(row.google_drive_image_links).entries()) {
                            await api.importGoogleDriveImage(savedProduct.id, {
                                driveUrl,
                                variantId: savedVariant.id,
                                altText: `${base.product_name} — ${row.color || row.variant_name}`,
                                sortOrder: index,
                            });
                        }
                    } catch (caught) {
                        const message = caught instanceof Error ? caught.message : 'Variant save failed.';
                        importErrors.push(`Row ${row.sourceRow} (${row.sku}): ${message}`);
                    }
                }

                const sharedLinks = new Set(productRows.flatMap((row) => driveLinksFromCsvCell(row.shared_google_drive_image_links)));
                for (const [index, driveUrl] of [...sharedLinks].entries()) {
                    try {
                        await api.importGoogleDriveImage(savedProduct.id, {
                            driveUrl,
                            altText: base.product_name,
                            sortOrder: index,
                        });
                    } catch (caught) {
                        const message = caught instanceof Error ? caught.message : 'Shared image import failed.';
                        importErrors.push(`Product “${slug}” shared image: ${message}`);
                    }
                }
            }

            setBulkImportErrors(importErrors);
            setSuccessMessage(
                `Bulk import finished: ${productsCreated} product(s) created, ${productsUpdated} updated, ${variantsCreated} variant(s) created, and ${variantsUpdated} updated.`,
            );
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not read the catalogue CSV.');
        } finally {
            setBulkImporting(false);
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
            description="Manage products, variants, media, publishing state, and catalogue categories."
            action={
                <div className="flex flex-wrap justify-end gap-3">
                    <button
                        onClick={() => downloadCsv('glockery-catalogue-template.csv', catalogueCsvTemplate())}
                        className="flex h-11 items-center gap-2 border border-gold-500/30 bg-carbon px-3 text-xs font-bold uppercase tracking-wider text-cream hover:border-gold-400"
                    >
                        <IconDownload size={15} /> Template
                    </button>
                    <button
                        onClick={() => downloadCsv('glockery-catalogue-export.csv', catalogueCsvExport(products))}
                        disabled={!products.length}
                        className="flex h-11 items-center gap-2 border border-gold-500/30 bg-carbon px-3 text-xs font-bold uppercase tracking-wider text-cream hover:border-gold-400 disabled:opacity-40"
                    >
                        <IconDownload size={15} /> Export
                    </button>
                    <label className="flex h-11 cursor-pointer items-center gap-2 border border-gold-500/30 bg-carbon px-3 text-xs font-bold uppercase tracking-wider text-cream hover:border-gold-400">
                        <IconPlus size={15} /> {bulkImporting ? 'Importing…' : 'Import CSV'}
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            disabled={bulkImporting}
                            className="sr-only"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = '';
                                if (file) void handleBulkImport(file);
                            }}
                        />
                    </label>
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
                            openProductEditor(null);
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
            {bulkImportErrors.length > 0 && (
                <div className="mb-6 border border-amber-500/35 bg-amber-950/20 p-4 text-xs text-amber-100" role="alert">
                    <div className="flex items-center justify-between gap-4">
                        <strong>Bulk import report · {bulkImportErrors.length} issue(s)</strong>
                        <button onClick={() => setBulkImportErrors([])} className="text-amber-200/70 hover:text-amber-100">
                            Close
                        </button>
                    </div>
                    <ul className="mt-3 max-h-44 list-disc space-y-1 overflow-y-auto pl-5">
                        {bulkImportErrors.map((message, index) => (
                            <li key={`${message}-${index}`}>{message}</li>
                        ))}
                    </ul>
                </div>
            )}

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
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
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
                                            <span
                                                className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                                                    product.status === 'PUBLISHED'
                                                        ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
                                                        : 'border-gold-500/30 bg-gold-950/30 text-gold-300'
                                                }`}
                                            >
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
                                                        openProductEditor(product);
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
                                        <span
                                            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                                                cat.isPublished ? 'border-emerald-500/30 text-emerald-300' : 'border-gold-500/30 text-gold-300'
                                            }`}
                                        >
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
                    <form
                        ref={productDialogRef}
                        tabIndex={-1}
                        onSubmit={handleProductSubmit}
                        className="mx-auto my-6 w-full max-w-5xl border border-gold-500/30 bg-carbon p-5 shadow-2xl outline-none sm:p-7"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="product-dialog-title"
                    >
                        <div className="flex justify-between border-b border-gold-500/20 pb-4">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.22em] text-gold-400 font-bold">Catalogue Manager</p>
                                <h2 id="product-dialog-title" className="mt-1 font-display text-3xl text-cream">
                                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenProductModal(false);
                                    setEditingProduct(null);
                                }}
                                className="text-xs text-cream/40 hover:text-cream"
                            >
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
                                <input
                                    name="slug"
                                    defaultValue={editingProduct?.slug || ''}
                                    className={inputStyle}
                                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                                    required
                                />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Category</span>
                                <select name="categoryId" defaultValue={editingProduct?.categoryId || ''} className={inputStyle} required>
                                    <option value="">Select Category…</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
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

                            <label>
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Material</span>
                                <input
                                    name="material"
                                    defaultValue={editingProduct?.material || ''}
                                    placeholder="e.g. Stainless steel"
                                    className={inputStyle}
                                />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Dimensions (L × W × H)</span>
                                <input name="dimensions" defaultValue={editingProduct?.dimensions || ''} placeholder="30 × 20 × 10 cm" className={inputStyle} />
                            </label>

                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Product Description (shown on storefront)</span>
                                <textarea
                                    name="description"
                                    defaultValue={editingProduct?.description || ''}
                                    rows={4}
                                    className="w-full border border-gold-500/25 bg-obsidian p-4 text-sm text-cream outline-none focus:border-gold-400 rounded-sm"
                                />
                            </label>

                            <section className="sm:col-span-2 border-y border-line py-5" aria-labelledby="product-options-heading">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 id="product-options-heading" className="font-display text-xl text-cream">
                                            Colours and options
                                        </h3>
                                        <p className="mt-1 text-xs leading-5 text-cream/55">
                                            Each option has its own SKU, price, swatch and image set. The colour name is shown to customers.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setVariantDrafts((current) => [...current, createVariantDraft()])}
                                        className="flex min-h-11 items-center gap-2 border border-gold-400/45 px-3 text-xs font-semibold text-gold-200 hover:border-gold-300 hover:text-gold-100"
                                    >
                                        <IconPlus size={14} /> Add colour
                                    </button>
                                </div>

                                <div className="mt-5 space-y-4">
                                    {variantDrafts.map((draft, index) => (
                                        <div key={draft.key} className="bg-obsidian/55 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <strong className="text-sm text-cream">
                                                    Option {index + 1}
                                                    {draft.color ? ` · ${draft.color}` : ''}
                                                </strong>
                                                {!draft.id && variantDrafts.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setVariantDrafts((current) => current.filter((item) => item.key !== draft.key))}
                                                        className="min-h-11 px-2 text-xs text-red-200 hover:text-red-100"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                <label>
                                                    <span className="mb-1.5 block text-xs text-cream/60">Colour name</span>
                                                    <input
                                                        value={draft.color}
                                                        onChange={(event) =>
                                                            updateVariantDraft(draft.key, {
                                                                color: event.target.value,
                                                            })
                                                        }
                                                        placeholder="e.g. Sage Green"
                                                        maxLength={80}
                                                        className={inputStyle}
                                                    />
                                                </label>
                                                <label>
                                                    <span className="mb-1.5 block text-xs text-cream/60">Option name</span>
                                                    <input
                                                        value={draft.name}
                                                        onChange={(event) =>
                                                            updateVariantDraft(draft.key, {
                                                                name: event.target.value,
                                                            })
                                                        }
                                                        placeholder="e.g. Sage Green · 6 piece"
                                                        maxLength={120}
                                                        className={inputStyle}
                                                        required
                                                    />
                                                </label>
                                                <label>
                                                    <span className="mb-1.5 block text-xs text-cream/60">SKU</span>
                                                    <input
                                                        value={draft.sku}
                                                        onChange={(event) =>
                                                            updateVariantDraft(draft.key, {
                                                                sku: event.target.value.toUpperCase(),
                                                            })
                                                        }
                                                        placeholder="GHC-SET-SAGE"
                                                        pattern={'[A-Z0-9][A-Z0-9._\\-]*'}
                                                        maxLength={80}
                                                        className={inputStyle}
                                                        required
                                                    />
                                                </label>
                                                <label>
                                                    <span className="mb-1.5 block text-xs text-cream/60">Barcode</span>
                                                    <input
                                                        value={draft.barcode}
                                                        onChange={(event) =>
                                                            updateVariantDraft(draft.key, {
                                                                barcode: event.target.value.toUpperCase(),
                                                            })
                                                        }
                                                        placeholder="e.g. 8901234567890"
                                                        pattern={'[A-Za-z0-9][A-Za-z0-9._\\-]*'}
                                                        maxLength={80}
                                                        className={inputStyle}
                                                    />
                                                </label>
                                                <label>
                                                    <span className="mb-1.5 block text-xs text-cream/60">Swatch</span>
                                                    <span className="flex h-12 items-center gap-3 border border-gold-500/25 bg-obsidian px-3">
                                                        <input
                                                            type="color"
                                                            value={draft.colorHex}
                                                            onChange={(event) =>
                                                                updateVariantDraft(draft.key, {
                                                                    colorHex: event.target.value.toUpperCase(),
                                                                })
                                                            }
                                                            className="size-8 cursor-pointer border-0 bg-transparent"
                                                            aria-label={`Swatch colour for option ${index + 1}`}
                                                        />
                                                        <span className="text-xs tabular-nums text-cream/55">{draft.colorHex}</span>
                                                    </span>
                                                </label>
                                                <label>
                                                    <span className="mb-1.5 block text-xs text-cream/60">Price (₹)</span>
                                                    <input
                                                        type="number"
                                                        value={draft.priceRupees}
                                                        onChange={(event) =>
                                                            updateVariantDraft(draft.key, {
                                                                priceRupees: event.target.value,
                                                            })
                                                        }
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="999.00"
                                                        className={inputStyle}
                                                        required
                                                    />
                                                </label>
                                                <label>
                                                    <span className="mb-1.5 block text-xs text-cream/60">Compare-at price (₹)</span>
                                                    <input
                                                        type="number"
                                                        value={draft.compareAtPriceRupees}
                                                        onChange={(event) =>
                                                            updateVariantDraft(draft.key, {
                                                                compareAtPriceRupees: event.target.value,
                                                            })
                                                        }
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="Optional"
                                                        className={inputStyle}
                                                    />
                                                </label>
                                                <label className="sm:col-span-2">
                                                    <span className="mb-1.5 block text-xs text-cream/60">Images for this option</span>
                                                    <input
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                                        multiple
                                                        onChange={(event) =>
                                                            updateVariantDraft(draft.key, {
                                                                images: Array.from(event.target.files || []),
                                                            })
                                                        }
                                                        className="block w-full text-xs text-cream/50 file:mr-3 file:h-11 file:border-0 file:bg-gold-400 file:px-4 file:text-xs file:font-bold file:text-obsidian"
                                                    />
                                                </label>
                                                <label className="sm:col-span-2">
                                                    <span className="mb-1.5 block text-xs text-cream/60">Google Drive image links</span>
                                                    <textarea
                                                        value={draft.driveImageUrls}
                                                        onChange={(event) =>
                                                            updateVariantDraft(draft.key, {
                                                                driveImageUrls: event.target.value,
                                                            })
                                                        }
                                                        rows={3}
                                                        placeholder={'Paste public Google Drive file links here\nOne image link per line'}
                                                        className={inputStyle}
                                                    />
                                                    <span className="mt-1 block text-[10px] text-cream/40">
                                                        In Drive, set each image to “Anyone with the link”. Folder links are not supported.
                                                    </span>
                                                </label>
                                            </div>
                                            <label className="mt-3 flex min-h-11 items-center gap-3 text-xs text-cream/65">
                                                <input
                                                    type="checkbox"
                                                    checked={draft.isActive}
                                                    onChange={(event) =>
                                                        updateVariantDraft(draft.key, {
                                                            isActive: event.target.checked,
                                                        })
                                                    }
                                                    className="size-4 accent-gold-400"
                                                />
                                                Available for customers
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {editingProduct && editingProduct.images.length > 0 && (
                                <section className="sm:col-span-2" aria-labelledby="existing-images-heading">
                                    <h3 id="existing-images-heading" className="text-sm font-semibold text-cream">
                                        Assign existing images
                                    </h3>
                                    <p className="mt-1 text-xs text-cream/55">
                                        Choose which colour owns each older image. Shared images appear after every colour’s own photos.
                                    </p>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        {editingProduct.images.map((image) => (
                                            <div key={image.id} className="flex items-center gap-3 bg-obsidian/55 p-2">
                                                <img src={image.thumbnailUrl} alt={image.altText} className="size-16 shrink-0 object-cover" />
                                                <label className="min-w-0 flex-1">
                                                    <span className="mb-1 block text-[11px] text-cream/55">Gallery assignment</span>
                                                    <select
                                                        value={imageAssignments[image.id] || ''}
                                                        onChange={(event) =>
                                                            setImageAssignments((current) => ({
                                                                ...current,
                                                                [image.id]: event.target.value || null,
                                                            }))
                                                        }
                                                        className="field h-10 w-full text-xs"
                                                    >
                                                        <option value="">Shared across all options</option>
                                                        {variantDrafts
                                                            .filter((draft) => draft.id)
                                                            .map((draft) => (
                                                                <option key={draft.id} value={draft.id}>
                                                                    {draft.color || draft.name}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Shared gallery images</span>
                                <input
                                    name="images"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    multiple
                                    className="block w-full text-xs text-cream/50 file:mr-3 file:h-11 file:border-0 file:bg-gold-400 file:px-4 file:text-xs file:font-bold file:text-obsidian file:rounded-sm cursor-pointer"
                                />
                                <span className="mt-1 block text-[10px] text-cream/40">
                                    Optional lifestyle or packaging photos shown after every selected colour’s own images.
                                </span>
                            </label>

                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Shared Google Drive image links</span>
                                <textarea
                                    name="driveImageUrls"
                                    rows={3}
                                    placeholder={'Paste public Google Drive file links here\nOne image link per line'}
                                    className={inputStyle}
                                />
                                <span className="mt-1 block text-[10px] text-cream/40">
                                    These images appear after each option’s own images. Set Drive access to “Anyone with the link”.
                                </span>
                            </label>

                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Product Video URL</span>
                                <input name="videoUrl" type="url" placeholder="https://cdn.example.com/product-video.mp4" className={inputStyle} />
                                <span className="mt-1 block text-[10px] text-cream/40">Use a direct HTTPS MP4, WebM, or MOV URL.</span>
                            </label>

                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Upload Product Video</span>
                                <input
                                    name="videoFile"
                                    type="file"
                                    accept="video/mp4,video/webm,video/quicktime"
                                    className="block w-full text-xs text-cream/50 file:mr-3 file:h-11 file:border-0 file:bg-gold-400 file:px-4 file:text-xs file:font-bold file:text-obsidian file:rounded-sm cursor-pointer"
                                />
                                <span className="mt-1 block text-[10px] text-cream/40">MP4, WebM, or MOV; up to 25 MB.</span>
                            </label>
                        </div>

                        <button
                            disabled={saving}
                            className="mt-6 h-12 w-full bg-gold-400 text-xs font-bold uppercase tracking-[0.2em] text-obsidian disabled:opacity-50 hover:bg-gold-300 rounded-sm shadow-md"
                        >
                            {saving ? 'Saving product and options…' : editingProduct ? 'Save product and options' : 'Create product and options'}
                        </button>
                    </form>
                </div>
            )}

            {/* Category Modal */}
            {openCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5 backdrop-blur-sm">
                    <form
                        ref={categoryDialogRef}
                        tabIndex={-1}
                        onSubmit={handleCategorySubmit}
                        className="w-full max-w-lg border border-gold-500/30 bg-carbon p-6 rounded-sm shadow-2xl outline-none"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="category-dialog-title"
                    >
                        <div className="flex justify-between border-b border-gold-500/20 pb-4">
                            <h2 id="category-dialog-title" className="font-display text-2xl text-cream">
                                {editingCategory ? 'Edit Category' : 'Create Category'}
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenCategoryModal(false);
                                    setEditingCategory(null);
                                }}
                                className="text-xs text-cream/40"
                            >
                                Close
                            </button>
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
                                <textarea
                                    name="description"
                                    defaultValue={editingCategory?.description || ''}
                                    rows={3}
                                    className="w-full border border-gold-500/25 bg-obsidian p-3 text-sm text-cream outline-none rounded-sm"
                                />
                            </label>
                            <label className="flex items-center gap-2 text-xs text-cream">
                                <input
                                    type="checkbox"
                                    name="isPublished"
                                    defaultChecked={editingCategory ? editingCategory.isPublished : true}
                                    className="accent-gold-400 size-4"
                                />
                                <span>Published on Storefront</span>
                            </label>
                        </div>
                        <button
                            disabled={saving}
                            className="mt-6 h-11 w-full bg-gold-400 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 rounded-sm"
                        >
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
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [lowStockOnly, setLowStockOnly] = useState(false);

    const [editingLevel, setEditingLevel] = useState<InventoryLevel | null>(null);
    const [openWarehouseModal, setOpenWarehouseModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const warehouseDialogRef = useDialog<HTMLFormElement>(openWarehouseModal, () => setOpenWarehouseModal(false));
    const stockDialogRef = useDialog<HTMLFormElement>(Boolean(editingLevel), () => setEditingLevel(null));

    const load = () =>
        Promise.all([api.inventory(), api.adminProducts(), api.warehouses()])
            .then(([rows, items, warehouseRows]) => {
                setLevels(rows);
                setProducts(items);
                setWarehouses(warehouseRows);
            })
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load inventory.'));

    useEffect(() => {
        void load();
    }, []);

    const variantsMap = useMemo(() => {
        const map = new Map<string, { label: string; sku: string; barcode: string; name: string }>();
        for (const p of products) {
            for (const v of p.variants) {
                map.set(v.id, {
                    label: `${p.name} · ${v.sku}`,
                    sku: v.sku,
                    barcode: v.barcode || '',
                    name: p.name,
                });
            }
        }
        return map;
    }, [products]);

    const warehousesMap = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);

    const handleCreateWarehouse = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        const form = new FormData(event.currentTarget);
        try {
            const warehouse = await api.createWarehouse({
                code: String(form.get('code')).trim().toUpperCase(),
                name: String(form.get('name')).trim(),
            });
            setOpenWarehouseModal(false);
            setSuccessMsg(`${warehouse.name} created. Every catalogue variant is ready to stock.`);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to create warehouse.');
        } finally {
            setSaving(false);
        }
    };

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
            const matchesSearch =
                !searchQuery ||
                (info &&
                    (info.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        info.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        info.name.toLowerCase().includes(searchQuery.toLowerCase())));
            const available = level.onHand - level.reserved;
            const matchesLowStock = !lowStockOnly || available <= level.lowStockThreshold;
            return matchesSearch && matchesLowStock;
        });
    }, [levels, variantsMap, searchQuery, lowStockOnly]);

    return (
        <AdminShell
            title="Inventory Control"
            description="Live warehouse stock levels, reservations, available SKUs, and low-stock alert thresholds. New catalogue variants are added automatically at zero stock."
            action={
                <button
                    onClick={() => setOpenWarehouseModal(true)}
                    className="flex h-11 items-center gap-2 bg-gold-400 px-4 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 rounded-sm"
                >
                    <IconPlus size={16} /> Add Warehouse
                </button>
            }
        >
            <NotificationToast message={error} type="error" onClose={() => setError('')} />
            <NotificationToast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />

            {/* Filter Bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-1 min-w-[260px] border border-gold-500/25 bg-carbon rounded-sm">
                    <IconSearch className="m-3 text-gold-400" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by SKU, barcode or product name…"
                        className="min-w-0 flex-1 bg-transparent text-sm text-cream outline-none"
                    />
                </div>
                <button
                    onClick={() => setLowStockOnly(!lowStockOnly)}
                    className={`flex items-center gap-2 rounded-sm border px-4 py-2.5 text-xs font-semibold transition-colors ${
                        lowStockOnly ? 'border-red-500/40 bg-red-950/40 text-red-200' : 'border-gold-500/25 bg-carbon text-cream/60 hover:border-gold-400'
                    }`}
                >
                    <IconAlert size={16} />
                    {lowStockOnly ? 'Showing Low Stock Alerts Only' : 'Filter Low Stock Alert SKUs'}
                </button>
            </div>

            {!warehouses.length && (
                <div className="mb-6 border border-amber-500/30 bg-amber-950/20 p-5 rounded-sm">
                    <h2 className="text-sm font-bold text-amber-300">Set up your first warehouse</h2>
                    <p className="mt-1 text-xs text-cream/65">
                        Inventory is tracked per warehouse. Creating one automatically adds every catalogue variant at zero stock, ready for you to set its
                        on-hand quantity.
                    </p>
                    <button
                        onClick={() => setOpenWarehouseModal(true)}
                        className="mt-4 flex h-10 items-center gap-2 border border-amber-400/40 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-400/10 rounded-sm"
                    >
                        <IconPlus size={14} /> Create First Warehouse
                    </button>
                </div>
            )}

            {/* Inventory Table */}
            <div className={`${box} overflow-x-auto`}>
                <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="border-b border-gold-500/20 text-[9px] uppercase tracking-[0.2em] text-gold-400 bg-obsidian/60">
                        <tr>
                            <th className="p-4">SKU / Barcode / Item</th>
                            <th className="p-4">Warehouse</th>
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
                                        {info?.barcode && (
                                            <span className="mt-1 block font-mono text-[10px] text-cream/45">
                                                Barcode: {info.barcode}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-xs text-cream/60">
                                        {warehousesMap.get(level.warehouseId)?.name || level.warehouseId}
                                        {warehousesMap.get(level.warehouseId) && (
                                            <span className="ml-2 text-[10px] text-gold-400">{warehousesMap.get(level.warehouseId)?.code}</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center font-display text-base text-cream">{level.onHand}</td>
                                    <td className="p-4 text-center text-cream/50">{level.reserved}</td>
                                    <td className={`p-4 text-center font-display text-lg font-bold ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {available}
                                    </td>
                                    <td className="p-4 text-center text-cream/40">{level.lowStockThreshold}</td>
                                    <td className="p-4 text-center">
                                        <span
                                            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                                                isLow
                                                    ? 'border-red-500/30 bg-red-950/30 text-red-300 animate-pulse'
                                                    : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
                                            }`}
                                        >
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

            {openWarehouseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5 backdrop-blur-sm">
                    <form
                        ref={warehouseDialogRef}
                        tabIndex={-1}
                        onSubmit={handleCreateWarehouse}
                        className="w-full max-w-md border border-gold-500/30 bg-carbon p-6 rounded-sm shadow-2xl outline-none"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="warehouse-dialog-title"
                    >
                        <div className="flex justify-between border-b border-gold-500/20 pb-4">
                            <div>
                                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gold-400">Inventory Setup</span>
                                <h3 id="warehouse-dialog-title" className="font-display text-2xl text-cream">
                                    Add Warehouse
                                </h3>
                            </div>
                            <button type="button" onClick={() => setOpenWarehouseModal(false)} className="text-xs text-cream/40 hover:text-cream">
                                Close
                            </button>
                        </div>
                        <p className="mt-4 text-xs leading-relaxed text-cream/60">All catalogue variants will be added to this warehouse with zero stock.</p>
                        <div className="mt-5 space-y-4">
                            <label className="block">
                                <span className="mb-1.5 block text-xs text-cream/70">Warehouse Name</span>
                                <input name="name" placeholder="Main Warehouse" className={inputStyle} required />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-xs text-cream/70">Warehouse Code</span>
                                <input
                                    name="code"
                                    placeholder="MAIN"
                                    pattern={'[A-Za-z0-9_\\-]+'}
                                    className={inputStyle}
                                    required
                                />
                            </label>
                        </div>
                        <button
                            disabled={saving}
                            className="mt-6 h-12 w-full bg-gold-400 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 disabled:opacity-50 rounded-sm"
                        >
                            {saving ? 'Creating Warehouse…' : 'Create Warehouse'}
                        </button>
                    </form>
                </div>
            )}

            {/* Adjust Stock Modal */}
            {editingLevel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5 backdrop-blur-sm">
                    <form
                        ref={stockDialogRef}
                        tabIndex={-1}
                        onSubmit={handleSaveStock}
                        className="w-full max-w-md border border-gold-500/30 bg-carbon p-6 rounded-sm shadow-2xl outline-none"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="stock-dialog-title"
                    >
                        <div className="flex justify-between border-b border-gold-500/20 pb-4">
                            <div>
                                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gold-400">Warehouse Stock</span>
                                <h3 id="stock-dialog-title" className="font-display text-2xl text-cream">
                                    Adjust SKU Level
                                </h3>
                            </div>
                            <button type="button" onClick={() => setEditingLevel(null)} className="text-xs text-cream/40">
                                Close
                            </button>
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
                                <input
                                    name="lowStockThreshold"
                                    type="number"
                                    min="0"
                                    defaultValue={editingLevel.lowStockThreshold}
                                    className={inputStyle}
                                    required
                                />
                            </label>
                        </div>
                        <button
                            disabled={saving}
                            className="mt-6 h-12 w-full bg-gold-400 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 rounded-sm"
                        >
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
    const couponDialogRef = useDialog<HTMLFormElement>(openModal, () => setOpenModal(false));

    const load = () =>
        api
            .coupons()
            .then(setCoupons)
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load coupons.'));

    useEffect(() => {
        void load();
    }, []);

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
                <button
                    onClick={() => setOpenModal(true)}
                    className="flex h-11 items-center gap-2 bg-gold-400 px-5 text-xs font-bold uppercase tracking-wider text-obsidian shadow-lg hover:bg-gold-300"
                >
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
                                <td className="p-4 font-semibold text-cream">{c.type === 'PERCENT' ? `${c.value}% OFF` : rupees(c.value)}</td>
                                <td className="p-4 text-cream/50 text-xs">{rupees(c.minimumSubtotalPaise)}</td>
                                <td className="p-4 text-cream/70 text-xs">{c.usageLimit ?? 'Unlimited'}</td>
                                <td className="p-4 text-cream/40 text-xs">
                                    {shortDate(c.startsAt)} → {shortDate(c.endsAt)}
                                </td>
                                <td className="p-4 text-center">
                                    <span
                                        className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                                            c.isActive ? 'border-emerald-500/30 text-emerald-300' : 'border-gold-500/30 text-cream/40'
                                        }`}
                                    >
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
                    <form
                        ref={couponDialogRef}
                        tabIndex={-1}
                        onSubmit={handleCreateCoupon}
                        className="w-full max-w-lg border border-gold-500/30 bg-carbon p-6 rounded-sm shadow-2xl outline-none"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="coupon-dialog-title"
                    >
                        <div className="flex justify-between border-b border-gold-500/20 pb-4">
                            <h3 id="coupon-dialog-title" className="font-display text-2xl text-cream">
                                Create Promo Coupon
                            </h3>
                            <button type="button" onClick={() => setOpenModal(false)} className="text-xs text-cream/40">
                                Close
                            </button>
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
                                <input
                                    name="endsAt"
                                    type="date"
                                    defaultValue={new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]}
                                    className={inputStyle}
                                    required
                                />
                            </label>
                        </div>
                        <button
                            disabled={saving}
                            className="mt-6 h-12 w-full bg-gold-400 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 rounded-sm"
                        >
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
        <AdminShell
            title="Security Audit Logs"
            description="Full immutable security audit trail documenting actor actions, entity mutations, and IP signatures."
        >
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

    useEffect(() => {
        void load();
    }, []);

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
                        <article key={String(label)} className={`${box} p-6 transition-colors hover:border-gold-500/40`}>
                            <div className="flex items-center justify-between">
                                <span className={healthy ? 'text-emerald-400' : 'text-amber-400'}>
                                    {healthy ? <IconCheckCircle color="#10B981" size={22} /> : <IconAlert size={22} />}
                                </span>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${healthy ? 'bg-emerald-950/30 text-emerald-300' : 'bg-amber-950/30 text-amber-300'}`}
                                >
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
        <AdminShell
            title="User & Role Administration"
            description="Manage security roles, assign administrative access privileges, and configure RBAC authorization."
        >
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
                    <button
                        disabled={saving}
                        className="mt-4 h-12 w-full bg-gold-400 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 rounded-sm"
                    >
                        {saving ? 'Assigning Role…' : 'Update User Authorization'}
                    </button>
                </form>

                <div className={`${box} p-6 space-y-4`}>
                    <h3 className="font-display text-2xl text-gold-300 border-b border-gold-500/15 pb-3">Role Permissions Reference</h3>
                    <div className="space-y-3 text-xs text-cream/70">
                        <div>
                            <strong className="text-gold-400">ADMIN:</strong> Unrestricted operational capabilities, financial telemetry, audit logs, and
                            security governance.
                        </div>
                        <div>
                            <strong className="text-gold-400">CATALOGUE_MANAGER:</strong> Product creation/editing, variant price adjustments, media derivative
                            processing, category taxonomy.
                        </div>
                        <div>
                            <strong className="text-gold-400">WAREHOUSE_MANAGER:</strong> Multi-warehouse stock level adjustments, low-stock threshold
                            monitoring, SKU receipts.
                        </div>
                        <div>
                            <strong className="text-gold-400">SUPPORT_AGENT:</strong> Order inspection, status transitions, guest order lookups, customer
                            invoice generation.
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
