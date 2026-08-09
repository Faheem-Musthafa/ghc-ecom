'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Redirect, useLocation } from '../lib/router';
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
import { auditActionLabel, auditChangeRows, auditEntityLabel, auditFactRows } from '../lib/audit-log';
import {
    catalogueCsvExport,
    catalogueCsvTemplate,
    driveLinksFromCsvCell,
    importBoolean,
    importRupeesToPaise,
    parseCatalogueCsv,
    validateCatalogueCsvRows,
} from '../lib/catalogue-csv';
import { inventoryCsvExport, inventoryCsvTemplate, parseInventoryCsv, validateInventoryCsvRows } from '../lib/inventory-csv';
import { fallbackImage, rupees, shortDate, slugify, titleCase } from '../lib/commerce';
import { openTrustedUrl } from '../lib/navigation';
import { basisPointsToPercent, localDateBoundaryIso, percentToBasisPoints } from '../lib/promotions';
import { readSpreadsheetText } from '../lib/spreadsheet-import';
import { AppRole, AuditLog, Category, Coupon, CreatedStaffUser, InventoryLevel, OperationsSnapshot, Order, Product, ProductVariant, StaffUser, Warehouse } from '../types';

const box = 'admin-panel';
const inputStyle = 'admin-field h-12 w-full text-sm';
const metricValue = (value: number | undefined): string => value === undefined || value < 0 ? 'Unavailable' : String(value);

const orderItemAttributes = (attributes?: Record<string, unknown>): Array<[string, string]> => {
    if (!attributes) return [];
    return Object.entries(attributes).flatMap(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return [[key, String(value)]];
        }
        return [];
    });
};

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
        <div className={`mb-6 flex items-center justify-between border p-4 text-sm ${bg} rounded-sm shadow-md animate-fadeIn`} role={type === 'error' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'}>
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
    const paidStatuses = new Set(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']);
    const points = Array.from({ length: 7 }, (_, offset) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - offset));
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const rev = orders
            .filter((order) => {
                const createdAt = new Date(order.createdAt);
                return paidStatuses.has(order.status) && createdAt >= date && createdAt < nextDate;
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
        const from = new Date();
        from.setDate(from.getDate() - 7);
        Promise.all([api.adminOrders(new URLSearchParams({ limit: '100', from: from.toISOString() }).toString()), api.operations()])
            .then(([orderRows, snapshot]) => {
                setOrders(orderRows);
                setOps(snapshot);
            })
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load admin overview.'));
    }, []);

    const totalRevenue = orders
        .filter((order) => ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status))
        .reduce((sum, order) => sum + order.totalPaise, 0);

    return (
        <AdminShell title="Overview" description="Track today’s orders, stock risks and system health from one place.">
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
                        value: metricValue(ops?.lowStockSkus),
                        badge: ops?.lowStockSkus ? 'Action Needed' : 'Healthy',
                        isAlert: Boolean(ops?.lowStockSkus),
                    },
                    {
                        label: 'Payment Mismatches',
                        value: metricValue(ops?.paymentMismatches),
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
    onInspect,
}: {
    orders: Order[];
    onInspect?: (order: Order) => void;
}) => (
    <div className={`${box} overflow-x-auto`}>
        <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-gold-500/20 text-[10px] font-bold uppercase tracking-[0.2em] text-gold-400 bg-obsidian/50">
                <tr>
                    <th className="p-4">Order #</th>
                    <th className="p-4">Placed Date</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Items</th>
                    <th className="p-4 text-right">Total</th>
                    <th className="p-4 text-center">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gold-500/10">
                {orders.map((order) => {
                    const payment = order.payments?.[0];
                    const statusColor =
                        order.status === 'CONFIRMED'
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20'
                            : order.status === 'CANCELLED' || order.status === 'PAYMENT_FAILED'
                              ? 'text-red-300 border-red-500/30 bg-red-950/20'
                              : 'text-amber-300 border-amber-500/30 bg-amber-950/20';

                    return (
                        <tr key={order.id} className="transition-colors hover:bg-gold-400/[.03]">
                            <td className="p-4 font-display text-lg text-cream">{order.orderNumber}</td>
                            <td className="p-4 text-xs text-cream/50">{shortDate(order.createdAt)}</td>
                            <td className="p-4 text-xs">
                                <p className="font-medium text-cream">{order.addressSnapshot?.recipientName || 'Customer'}</p>
                                <p className="mt-0.5 text-cream/45">{order.addressSnapshot?.email || 'No email'}</p>
                            </td>
                            <td className="p-4">
                                <span className={`inline-block rounded-full border px-3 py-1 text-[10px] font-bold tracking-wider ${statusColor}`}>
                                    {titleCase(order.status)}
                                </span>
                            </td>
                            <td className="p-4 text-xs">
                                {payment ? (
                                    <>
                                        <p className="font-medium text-cream">{titleCase(payment.status)}</p>
                                        <p className="mt-0.5 text-cream/45">{payment.method ? titleCase(payment.method) : 'Razorpay'}</p>
                                    </>
                                ) : (
                                    <span className="text-cream/45">Awaiting payment</span>
                                )}
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
    const { session } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const orderDialogRef = useDialog<HTMLDivElement>(Boolean(inspectingOrder), () => setInspectingOrder(null));

    const load = async (search = '', status = 'ALL', offset = 0, append = false, signal?: AbortSignal) => {
        setLoadingOrders(true);
        try {
            const result = await api.adminOrders(
                new URLSearchParams({
                    limit: '100',
                    offset: String(offset),
                    ...(search ? { search } : {}),
                    ...(status !== 'ALL' ? { status } : {}),
                }).toString(),
                signal,
            );
            if (signal?.aborted) return;
            setOrders((current) => {
                if (!append) return result;
                const existingIds = new Set(current.map((order) => order.id));
                return [...current, ...result.filter((order) => !existingIds.has(order.id))];
            });
            setHasMore(result.length === 100);
        } catch (caught) {
            if (!signal?.aborted) {
                setError(caught instanceof Error ? caught.message : 'Unable to load orders.');
            }
        } finally {
            if (!signal?.aborted) setLoadingOrders(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        void load('', 'ALL', 0, false, controller.signal);
        return () => controller.abort();
    }, []);

    const downloadInvoice = async (orderId: string) => {
        try {
            const result = await api.adminInvoice(orderId);
            if (result?.url && !openTrustedUrl(result.url)) throw new Error('Invoice URL was rejected');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Invoice unavailable.');
        }
    };

    const replaceOrder = (next: Order) => {
        setInspectingOrder(next);
        setOrders((current) => current.map((order) => order.id === next.id ? next : order));
    };

    const transition = async (status: string) => {
        if (!inspectingOrder) return;
        try { replaceOrder(await api.transitionOrder(inspectingOrder.id, status)); }
        catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update order status.'); }
    };

    const createShipment = async () => {
        if (!inspectingOrder) return;
        const carrier = window.prompt('Carrier name (optional):') || undefined;
        try {
            const shipment = await api.createShipment(inspectingOrder.id, carrier);
            replaceOrder({ ...inspectingOrder, shipments: [...(inspectingOrder.shipments || []), shipment] });
        } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create shipment.'); }
    };

    const addTracking = async (shipmentId: string) => {
        if (!inspectingOrder) return;
        const status = window.prompt('Shipment status: LABEL_CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED')?.trim().toUpperCase();
        if (!status) return;
        try {
            const shipment = await api.addTrackingEvent(shipmentId, {
                providerEventId: `manual-${Date.now()}`,
                status,
                occurredAt: new Date().toISOString(),
                message: 'Updated by staff',
            });
            replaceOrder({ ...inspectingOrder, shipments: (inspectingOrder.shipments || []).map((item) => item.id === shipment.id ? { ...item, ...shipment } : item) });
            await load(query, statusFilter);
        } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to add tracking event.'); }
    };

    const reviewReturn = async (returnId: string, status: string) => {
        try {
            await api.reviewReturn(returnId, status, window.prompt('Review note (optional):') || undefined);
            setInspectingOrder(null);
            await load(query, statusFilter);
        } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to review return.'); }
    };

    const refundReturn = async (returnId: string) => {
        if (!inspectingOrder) return;
        const payment = inspectingOrder.payments?.find((item) => item.status === 'CAPTURED' || item.status === 'REFUNDED');
        if (!payment) { setError('No captured payment is available for refund.'); return; }
        const raw = window.prompt('Refund amount in rupees:');
        const amountPaise = raw ? Math.round(Number(raw) * 100) : 0;
        if (!Number.isFinite(amountPaise) || amountPaise < 1) return;
        try {
            await api.createRefund({ paymentId: payment.id, returnRequestId: returnId, amountPaise, idempotencyKey: `return-${returnId}-${Date.now()}`, reason: 'Approved customer return' });
            setInspectingOrder(null);
            await load(query, statusFilter);
        } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create refund.'); }
    };

    return (
        <AdminShell title="Orders" description="Search paid customer orders and view their complete product, customer, and payment records.">
            <NotificationToast message={error} type="error" onClose={() => setError('')} />
            <NotificationToast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />

            {/* Filter Tabs & Search Bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void load(query, statusFilter);
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
                    {['ALL', 'PAYMENT_PENDING', 'PAYMENT_FAILED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
                        <button
                            key={st}
                            onClick={() => {
                                setStatusFilter(st);
                                void load(query, st);
                            }}
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
                {session?.roles.some((role) => ['ADMIN', 'SUPPORT_AGENT'].includes(role)) && (
                    <button onClick={() => void api.reconcileRefunds().then(() => setSuccessMsg('Pending refunds reconciled.')).catch((caught) => setError(caught instanceof Error ? caught.message : 'Refund reconciliation failed.'))} className="border border-gold-500/30 px-4 py-2 text-xs font-bold uppercase text-gold-300">Reconcile refunds</button>
                )}
            </div>

            <OrdersTable orders={orders} onInspect={setInspectingOrder} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-cream/55">
                <span>{loadingOrders ? 'Loading orders…' : `Showing ${orders.length}${hasMore ? '+' : ''} orders`}</span>
                {hasMore && (
                    <button
                        type="button"
                        disabled={loadingOrders}
                        onClick={() => void load(query, statusFilter, orders.length, true)}
                        className="rounded-sm border border-gold-500/30 px-4 py-2 font-semibold text-gold-300 hover:border-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Load 100 more
                    </button>
                )}
            </div>

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
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gold-400">Customer & Contact Details</h4>
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
                                        {inspectingOrder.addressSnapshot?.line2 ? `${inspectingOrder.addressSnapshot.line2}, ` : ''}
                                        {inspectingOrder.addressSnapshot?.city}, {inspectingOrder.addressSnapshot?.state}{' '}
                                        {inspectingOrder.addressSnapshot?.postalCode}, {inspectingOrder.addressSnapshot?.country || 'IN'}
                                    </p>
                                </div>
                            </div>

                            <div className="border border-gold-500/15 bg-obsidian/60 p-4 rounded-sm">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gold-400">Order & Payment Summary</h4>
                                <div className="mt-3 space-y-1.5 text-xs text-cream/70">
                                    <p>
                                        <strong className="text-cream">Current Status:</strong>{' '}
                                        <span className="text-gold-300 font-semibold">{titleCase(inspectingOrder.status)}</span>
                                    </p>
                                    <p>
                                        <strong className="text-cream">Placed On:</strong> {new Date(inspectingOrder.createdAt).toLocaleString('en-IN')}
                                    </p>
                                    <p>
                                        <strong className="text-cream">Items subtotal:</strong> {rupees(inspectingOrder.subtotalPaise)}
                                    </p>
                                    {inspectingOrder.discountPaise > 0 && (
                                        <p>
                                            <strong className="text-cream">Discount:</strong> -{rupees(inspectingOrder.discountPaise)}
                                        </p>
                                    )}
                                    <p>
                                        <strong className="text-cream">Tax:</strong> {rupees(inspectingOrder.taxPaise)}
                                    </p>
                                    <p>
                                        <strong className="text-cream">Total paid:</strong>{' '}
                                        <span className="font-display text-base text-gold-300">{rupees(inspectingOrder.totalPaise)}</span>
                                    </p>
                                    <p>
                                        <strong className="text-cream">Razorpay order:</strong> {inspectingOrder.razorpayOrderId || 'Not created'}
                                    </p>
                                    {inspectingOrder.payments?.map((payment) => (
                                        <div key={payment.id} className="border-t border-gold-500/10 pt-2">
                                            <p><strong className="text-cream">Payment:</strong> {titleCase(payment.status)} · {rupees(payment.amountPaise)}</p>
                                            <p><strong className="text-cream">Method:</strong> {payment.method ? titleCase(payment.method) : 'Not reported'}</p>
                                            <p><strong className="text-cream">Payment ID:</strong> {payment.razorpayPaymentId || 'Awaiting Razorpay confirmation'}</p>
                                            {payment.capturedAt && <p><strong className="text-cream">Captured:</strong> {new Date(payment.capturedAt).toLocaleString('en-IN')}</p>}
                                            {payment.refunds.length > 0 && <p><strong className="text-cream">Refunds:</strong> {payment.refunds.map((refund) => `${titleCase(refund.status)} ${rupees(refund.amountPaise)}`).join(', ')}</p>}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <button
                                        onClick={() => void downloadInvoice(inspectingOrder.id)}
                                        className="flex items-center gap-2 rounded-sm border border-gold-500/30 bg-carbon px-3 py-2 text-xs text-gold-300 hover:border-gold-400"
                                    >
                                        <IconDownload size={14} /> Download Tax Invoice
                                    </button>
                                    {inspectingOrder.status === 'CONFIRMED' && <button onClick={() => void transition('PROCESSING')} className="rounded-sm bg-gold-400 px-3 py-2 text-xs font-bold text-obsidian">Start processing</button>}
                                    {inspectingOrder.status === 'PROCESSING' && <button onClick={() => void createShipment()} className="rounded-sm bg-gold-400 px-3 py-2 text-xs font-bold text-obsidian">Create shipment</button>}
                                </div>
                            </div>
                        </div>

                        {(inspectingOrder.shipments || []).length > 0 && (
                            <section className="mt-6 border border-gold-500/15 bg-obsidian/40 p-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gold-400">Shipments</h4>
                                {(inspectingOrder.shipments || []).map((shipment) => (
                                    <div key={shipment.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-cream/70">
                                        <span>{shipment.carrier || shipment.provider} · {shipment.trackingNumber || 'Tracking pending'} · {titleCase(shipment.status)}</span>
                                        {shipment.status !== 'DELIVERED' && <button onClick={() => void addTracking(shipment.id)} className="border border-gold-500/30 px-3 py-2 text-gold-300">Add tracking update</button>}
                                    </div>
                                ))}
                            </section>
                        )}

                        {(inspectingOrder.returns || []).length > 0 && (
                            <section className="mt-6 border border-gold-500/15 bg-obsidian/40 p-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gold-400">Returns</h4>
                                {(inspectingOrder.returns || []).map((item) => (
                                    <div key={item.id} className="mt-3 border-t border-gold-500/10 pt-3 text-xs text-cream/70">
                                        <p>{titleCase(item.status)} · {item.reason}</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {item.status === 'REQUESTED' && <><button onClick={() => void reviewReturn(item.id, 'APPROVED')} className="border border-emerald-500/30 px-3 py-2 text-emerald-300">Approve</button><button onClick={() => void reviewReturn(item.id, 'REJECTED')} className="border border-red-500/30 px-3 py-2 text-red-300">Reject</button></>}
                                            {item.status === 'APPROVED' && <button onClick={() => void reviewReturn(item.id, 'RECEIVED')} className="border border-gold-500/30 px-3 py-2 text-gold-300">Mark received</button>}
                                            {item.status === 'RECEIVED' && session?.roles.some((role) => ['ADMIN', 'SUPPORT_AGENT'].includes(role)) && <button onClick={() => void refundReturn(item.id)} className="bg-gold-400 px-3 py-2 font-bold text-obsidian">Create refund</button>}
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}

                        {/* Items Snapshot Table */}
                        <div className="mt-6">
                            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-gold-400">Ordered Line Items</h4>
                            <div className="border border-gold-500/20 bg-obsidian/40 rounded-sm overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="border-b border-gold-500/15 bg-carbon text-[9px] uppercase tracking-wider text-cream/40">
                                        <tr>
                                            <th className="p-3">Product details</th>
                                            <th className="p-3">SKU / Barcode</th>
                                            <th className="p-3">Selected options</th>
                                            <th className="p-3 text-right">Price</th>
                                            <th className="p-3 text-center">Qty</th>
                                            <th className="p-3 text-right">Line Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gold-500/10">
                                        {(inspectingOrder.itemsSnapshot || []).map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="p-3">
                                                    <div className="flex min-w-[240px] gap-3">
                                                        <img
                                                            src={item.imageUrl || fallbackImage}
                                                            alt=""
                                                            className="size-12 shrink-0 rounded-sm border border-gold-500/20 bg-carbon object-cover"
                                                            onError={(event) => { event.currentTarget.src = fallbackImage; }}
                                                        />
                                                        <div>
                                                            <p className="font-semibold text-cream">{item.productName}</p>
                                                            {item.categoryName && <p className="mt-0.5 text-[10px] uppercase tracking-wider text-gold-400/75">{item.categoryName}</p>}
                                                            <p className="mt-0.5 text-cream/60">Colour: {item.color || item.sku}</p>
                                                            {item.productDescription && <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-cream/45">{item.productDescription}</p>}
                                                            {item.productMaterial && <p className="mt-1 text-[10px] text-cream/45">Material: {item.productMaterial}</p>}
                                                            {item.productSlug && (
                                                                <a href={`/product/${item.productSlug}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-gold-300 hover:text-gold-100">
                                                                    View product ↗
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-cream/60">
                                                    <p>{item.sku || 'No SKU'}</p>
                                                    <p className="mt-1 text-[10px] text-cream/40">Barcode: {item.barcode || '—'}</p>
                                                </td>
                                                <td className="p-3 text-cream/60">
                                                    {orderItemAttributes(item.attributes).length > 0 ? (
                                                        <div className="flex max-w-40 flex-wrap gap-1">
                                                            {orderItemAttributes(item.attributes).map(([key, value]) => (
                                                                <span key={key} className="rounded border border-gold-500/20 bg-carbon px-1.5 py-0.5 text-[10px] text-cream/70">
                                                                    {titleCase(key)}: {value}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-cream/40">No options</span>
                                                    )}
                                                </td>
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

const categoryNameKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();

const createVariantDraft = (variant?: ProductVariant): VariantDraft => ({
    key: variant?.id || `new-variant-${++variantDraftCounter}`,
    id: variant?.id,
    sku: variant?.sku || '',
    barcode: variant?.barcode || '',
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

    const load = (signal?: AbortSignal) =>
        Promise.all([api.adminProducts(signal), api.adminCategories(signal)])
            .then(([items, cats]) => {
                if (signal?.aborted) return;
                setProducts(items);
                setCategories(cats);
            })
            .catch((caught) => {
                if (!signal?.aborted) setError(caught instanceof Error ? caught.message : 'Unable to load catalogue.');
            });

    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
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
            const barcodeOwners = new Map<string, number>();
            for (const [index, variant] of variantDrafts.entries()) {
                const barcode = variant.barcode.trim().toUpperCase();
                if (!barcode) continue;
                const previousIndex = barcodeOwners.get(barcode);
                if (previousIndex !== undefined) {
                    throw new Error(`Barcode “${barcode}” is used by options ${previousIndex + 1} and ${index + 1}. Each barcode must be unique.`);
                }
                barcodeOwners.set(barcode, index);
            }

            if (editingProduct) {
                const product = await api.updateProduct(editingProduct.id, {
                    name: String(form.get('name')),
                    slug: editingProduct.slug,
                    categoryId: String(form.get('categoryId')),
                    description: String(form.get('description')),
                    shortDescription: String(form.get('description')),
                    material: String(form.get('material')),
                    status: String(form.get('status')),
                });
                productId = product.id;
                productName = product.name;
            } else {
                const product = await api.createProduct({
                    categoryId: String(form.get('categoryId')),
                    name: String(form.get('name')),
                    slug: slugify(String(form.get('name'))),
                    shortDescription: String(form.get('description')),
                    description: String(form.get('description')),
                    material: String(form.get('material')),
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
                    pricePaise: rupeesInputToPaise(draft.priceRupees),
                    compareAtPricePaise: draft.compareAtPriceRupees
                        ? rupeesInputToPaise(draft.compareAtPriceRupees)
                        : null,
                    attributes: draft.attributes,
                    ...(color ? { color, colorHex: draft.colorHex } : {}),
                    isActive: draft.isActive,
                };
                const savedVariant = draft.id ? await api.updateVariant(draft.id, input) : await api.createVariant(productId, input);

                for (const [index, file] of draft.images.entries()) {
                    const imageForm = new FormData();
                    imageForm.set('file', file);
                    imageForm.set('variantId', savedVariant.id);
                    imageForm.set('altText', `${productName} — ${color || draft.sku}`);
                    imageForm.set('sortOrder', String(index));
                    await api.uploadProductImage(productId, imageForm);
                }

                for (const [index, driveUrl] of driveImageLinks(draft.driveImageUrls).entries()) {
                    await api.importGoogleDriveImage(productId, {
                        driveUrl,
                        variantId: savedVariant.id,
                        altText: `${productName} — ${color || draft.sku}`,
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

    const handleDeleteCategory = async (categoryId: string, name: string) => {
        if (!window.confirm(`Delete category “${name}”? It must not contain products.`)) return;
        try {
            await api.deleteCategory(categoryId);
            setSuccessMessage(`Category “${name}” deleted.`);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Category deletion failed.');
        }
    };

    const handleDeleteVideo = async (productId: string, videoId: string) => {
        if (!window.confirm('Remove this product video?')) return;
        setSaving(true);
        setError('');
        try {
            await api.deleteProductVideo(productId, videoId);
            setEditingProduct((current) => current ? { ...current, videos: current.videos.filter((video) => video.id !== videoId) } : null);
            setSuccessMessage('Product video removed. You can now upload an MP4 replacement.');
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not remove the product video.');
        } finally {
            setSaving(false);
        }
    };

    const handleBulkImport = async (file: File) => {
        setBulkImporting(true);
        setBulkImportErrors([]);
        setError('');
        setSuccessMessage('');
        try {
            const rows = parseCatalogueCsv(await readSpreadsheetText(file));
            const validationErrors = validateCatalogueCsvRows(rows);
            if (validationErrors.length > 0) {
                setBulkImportErrors(validationErrors);
                setError(`Import stopped: ${validationErrors.length} validation error(s). No products were changed.`);
                return;
            }

            const groups = new Map<string, typeof rows>();
            for (const row of rows) groups.set(row.product_slug, [...(groups.get(row.product_slug) || []), row]);
            const categoryByName = new Map(categories.map((category) => [categoryNameKey(category.name), category]));
            const importedCategoryNames = new Map<string, string>();
            for (const row of rows) {
                const normalizedName = row.category_name.trim().replace(/\s+/g, ' ');
                importedCategoryNames.set(categoryNameKey(normalizedName), normalizedName);
            }
            const missingCategoryNames = [...importedCategoryNames]
                .filter(([key]) => !categoryByName.has(key))
                .map(([, name]) => name);
            const categoryNotice = missingCategoryNames.length
                ? ` ${missingCategoryNames.length} new categor${missingCategoryNames.length === 1 ? 'y' : 'ies'} will be created.`
                : '';
            if (!window.confirm(`Import ${rows.length} variant row(s) across ${groups.size} product(s)? Matching products and SKUs will be updated.${categoryNotice}`)) return;

            const productBySlug = new Map(products.map((product) => [product.slug, product]));
            const importErrors: string[] = [];
            let categoriesCreated = 0;
            let productsCreated = 0;
            let productsUpdated = 0;
            let variantsCreated = 0;
            let variantsUpdated = 0;
            const undoActions: Array<() => Promise<unknown>> = [];

            for (const categoryName of missingCategoryNames) {
                try {
                    const category = await api.createCategory({ name: categoryName, isPublished: true });
                    categoryByName.set(categoryNameKey(category.name), category);
                    undoActions.push(() => api.deleteCategory(category.id));
                    categoriesCreated += 1;
                } catch (caught) {
                    const message = caught instanceof Error ? caught.message : 'Category creation failed.';
                    importErrors.push(`Category “${categoryName}”: ${message}`);
                }
            }

            for (const [slug, productRows] of groups) {
                const base = productRows[0];
                const category = categoryByName.get(categoryNameKey(base.category_name));
                if (!category) continue;
                let savedProduct: Product;
                try {
                    const productInput = {
                        categoryId: category.id,
                        name: base.product_name,
                        slug,
                        shortDescription: base.description,
                        description: base.description,
                        material: base.material,
                        status: base.status.toUpperCase(),
                    };
                    const existingProduct = productBySlug.get(slug);
                    if (existingProduct) {
                        savedProduct = await api.updateProduct(existingProduct.id, productInput);
                        undoActions.push(() => api.updateProduct(existingProduct.id, {
                            categoryId: existingProduct.categoryId,
                            name: existingProduct.name,
                            slug: existingProduct.slug,
                            shortDescription: existingProduct.shortDescription,
                            description: existingProduct.description,
                            material: existingProduct.material,
                            status: existingProduct.status,
                        }));
                        productsUpdated += 1;
                    } else {
                        savedProduct = await api.createProduct(productInput);
                        undoActions.push(() => api.deleteProduct(savedProduct.id));
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
                            pricePaise: importRupeesToPaise(row.price_rupees)!,
                            compareAtPricePaise: row.compare_at_price_rupees
                                ? importRupeesToPaise(row.compare_at_price_rupees)!
                                : null,
                            attributes: existingVariant?.attributes || {},
                            ...(row.color ? { color: row.color } : {}),
                            ...(row.color_hex ? { colorHex: row.color_hex.toUpperCase() } : {}),
                            isActive: row.is_active ? importBoolean(row.is_active)! : true,
                        };
                        const savedVariant = existingVariant
                            ? await api.updateVariant(existingVariant.id, variantInput)
                            : await api.createVariant(savedProduct.id, variantInput);
                        if (existingVariant) {
                            undoActions.push(() => api.updateVariant(existingVariant.id, {
                                sku: existingVariant.sku,
                                barcode: existingVariant.barcode || null,
                                pricePaise: existingVariant.pricePaise,
                                compareAtPricePaise: existingVariant.compareAtPricePaise ?? null,
                                attributes: existingVariant.attributes,
                                isActive: existingVariant.isActive,
                            }));
                            variantsUpdated += 1;
                        } else {
                            undoActions.push(() => api.deleteVariant(savedVariant.id));
                            variantsCreated += 1;
                        }

                        for (const [index, driveUrl] of driveLinksFromCsvCell(row.option_google_drive_image_links).entries()) {
                            const importedImage = await api.importGoogleDriveImage(savedProduct.id, {
                                driveUrl,
                                variantId: savedVariant.id,
                                altText: `${base.product_name} — ${row.color || row.sku}`,
                                sortOrder: index,
                            });
                            undoActions.push(() => api.deleteProductImage(savedProduct.id, importedImage.id));
                        }
                    } catch (caught) {
                        const message = caught instanceof Error ? caught.message : 'Variant save failed.';
                        importErrors.push(`Row ${row.sourceRow} (${row.sku}): ${message}`);
                    }
                }

                const sharedLinks = new Set(productRows.flatMap((row) => driveLinksFromCsvCell(row.shared_google_drive_image_links)));
                for (const [index, driveUrl] of [...sharedLinks].entries()) {
                    try {
                        const importedImage = await api.importGoogleDriveImage(savedProduct.id, {
                            driveUrl,
                            altText: base.product_name,
                            sortOrder: index,
                        });
                        undoActions.push(() => api.deleteProductImage(savedProduct.id, importedImage.id));
                    } catch (caught) {
                        const message = caught instanceof Error ? caught.message : 'Shared image import failed.';
                        importErrors.push(`Product “${slug}” shared image: ${message}`);
                    }
                }
            }

            if (importErrors.length > 0) {
                const rollbackErrors: string[] = [];
                for (const undo of undoActions.reverse()) {
                    try { await undo(); }
                    catch (caught) { rollbackErrors.push(caught instanceof Error ? caught.message : 'Rollback action failed.'); }
                }
                setBulkImportErrors([...importErrors, ...rollbackErrors.map((message) => `Rollback: ${message}`)]);
                setError(rollbackErrors.length
                    ? `Import failed and rollback needs attention (${rollbackErrors.length} rollback error(s)).`
                    : 'Import failed. All changes from this file were rolled back.');
                await load();
                return;
            }

            setBulkImportErrors(importErrors);
            setSuccessMessage(
                `Bulk import finished: ${categoriesCreated} categor${categoriesCreated === 1 ? 'y' : 'ies'} created, ${productsCreated} product(s) created, ${productsUpdated} updated, ${variantsCreated} variant(s) created, and ${variantsUpdated} updated.`,
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
                    description: String(form.get('description')),
                    isPublished: form.get('isPublished') === 'on',
                });
                setSuccessMessage('Category updated.');
            } else {
                await api.createCategory({
                    name: String(form.get('name')),
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
            title="Catalogue"
            description="Manage products, variants, media, publishing status and categories."
            action={
                <div className="flex flex-wrap justify-end gap-3">
                    <button
                        onClick={() => downloadCsv('glockery-catalogue-template.csv', catalogueCsvTemplate())}
                        className="flex h-11 items-center gap-2 border border-gold-500/30 bg-carbon px-3 text-xs font-bold uppercase tracking-wider text-cream hover:border-gold-400"
                    >
                        <IconDownload size={15} /> Import Template
                    </button>
                    <button
                        onClick={() => downloadCsv('glockery-catalogue-export.csv', catalogueCsvExport(products))}
                        disabled={!products.length}
                        className="flex h-11 items-center gap-2 border border-gold-500/30 bg-carbon px-3 text-xs font-bold uppercase tracking-wider text-cream hover:border-gold-400 disabled:opacity-40"
                    >
                        <IconDownload size={15} /> Export Catalogue
                    </button>
                    <label className="flex h-11 cursor-pointer items-center gap-2 border border-gold-500/30 bg-carbon px-3 text-xs font-bold uppercase tracking-wider text-cream hover:border-gold-400">
                        <IconPlus size={15} /> {bulkImporting ? 'Importing…' : 'Import File'}
                        <input
                            type="file"
                            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
                    <table className="w-full min-w-[560px] text-left text-sm">
                        <thead className="border-b border-gold-500/20 text-[9px] uppercase tracking-[0.2em] text-gold-400 bg-obsidian/60">
                            <tr>
                                <th className="p-4">Category Name</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gold-500/10">
                            {categories.map((cat) => (
                                <tr key={cat.id}>
                                    <td className="p-4 font-display text-lg text-cream">{cat.name}</td>
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
                                        <div className="flex justify-center gap-2"><button
                                            onClick={() => {
                                                setEditingCategory(cat);
                                                setOpenCategoryModal(true);
                                            }}
                                            className="p-2 text-cream/60 hover:text-gold-300 border border-gold-500/20 rounded-sm bg-obsidian"
                                        >
                                            <IconEdit size={16} />
                                        </button><button onClick={() => void handleDeleteCategory(cat.id, cat.name)} className="p-2 text-red-400/70 hover:text-red-300 border border-red-500/20 rounded-sm bg-obsidian" title="Delete category"><IconTrash size={16} /></button></div>
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
                                <h2 id="product-dialog-title" className="font-display text-3xl text-cream">
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
                                                {variantDrafts.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void (async () => {
                                                            if (draft.id && !window.confirm(`Delete option “${draft.color || draft.sku}”?`)) return;
                                                            try {
                                                                if (draft.id) await api.deleteVariant(draft.id);
                                                                setVariantDrafts((current) => current.filter((item) => item.key !== draft.key));
                                                            } catch (caught) {
                                                                setError(caught instanceof Error ? caught.message : 'Variant deletion failed.');
                                                            }
                                                        })()}
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
                                                    <span className="mb-1.5 block text-xs text-cream/60">Barcode (unique)</span>
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
                                                    <span className="mt-1 block text-[10px] text-cream/40">Optional, but cannot be reused by another option.</span>
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
                                                                    {draft.color || draft.sku}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => void (async () => {
                                                        if (!window.confirm('Delete this product image?')) return;
                                                        try {
                                                            await api.deleteProductImage(editingProduct.id, image.id);
                                                            setEditingProduct({ ...editingProduct, images: editingProduct.images.filter((item) => item.id !== image.id) });
                                                        } catch (caught) {
                                                            setError(caught instanceof Error ? caught.message : 'Image deletion failed.');
                                                        }
                                                    })()}
                                                    className="p-2 text-red-300"
                                                    aria-label="Delete image"
                                                >
                                                    <IconTrash size={15} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {editingProduct && editingProduct.videos.length > 0 && (
                                <section className="sm:col-span-2" aria-labelledby="existing-videos-heading">
                                    <h3 id="existing-videos-heading" className="text-sm font-semibold text-cream">Existing videos</h3>
                                    <p className="mt-1 text-xs text-cream/55">Uploaded videos are converted and stored as browser-ready MP4 files. Replace older external or unsupported videos here.</p>
                                    <div className="mt-3 space-y-2">
                                        {editingProduct.videos.map((video) => (
                                            <div key={video.id} className="flex flex-wrap items-center justify-between gap-3 bg-obsidian/55 p-3 text-xs">
                                                <a href={video.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-gold-300 hover:text-gold-100">{video.altText || 'Product video'}</a>
                                                <button type="button" disabled={saving} onClick={() => void handleDeleteVideo(editingProduct.id, video.id)} className="border border-red-500/35 px-3 py-2 font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-50">Remove video</button>
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
                                <span className="mb-1.5 block text-xs text-cream/60 font-medium">Upload Product Video</span>
                                <input
                                    name="videoFile"
                                    type="file"
                                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg,video/ogg"
                                    className="block w-full text-xs text-cream/50 file:mr-3 file:h-11 file:border-0 file:bg-gold-400 file:px-4 file:text-xs file:font-bold file:text-obsidian file:rounded-sm cursor-pointer"
                                />
                                <span className="mt-1 block text-[10px] text-cream/40">MP4, WebM, MOV, AVI, MPEG, or OGG; up to 25 MB. Every upload is converted to an H.264/AAC MP4 before Supabase storage.</span>
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
    const [bulkImporting, setBulkImporting] = useState(false);
    const [bulkImportErrors, setBulkImportErrors] = useState<string[]>([]);
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
        const map = new Map<
            string,
            {
                label: string;
                sku: string;
                barcode: string;
                name: string;
                color?: string;
                colorHex?: string;
                imageUrl: string;
            }
        >();
        for (const p of products) {
            for (const v of p.variants) {
                const image = p.images.find((item) => item.variantId === v.id) || p.images[0];
                const color = variantAttribute(v, 'color');
                const colorHex = variantAttribute(v, 'colorHex');
                map.set(v.id, {
                    label: color ? `${p.name} · ${color} · ${v.sku}` : `${p.name} · ${v.sku}`,
                    sku: v.sku,
                    barcode: v.barcode || '',
                    name: p.name,
                    color: color || undefined,
                    colorHex: /^#[0-9A-F]{6}$/i.test(colorHex) ? colorHex.toUpperCase() : undefined,
                    imageUrl: image?.thumbnailUrl || fallbackImage,
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

    const handleInventoryImport = async (file: File) => {
        setBulkImporting(true);
        setBulkImportErrors([]);
        setError('');
        setSuccessMsg('');
        try {
            const rows = parseInventoryCsv(await readSpreadsheetText(file));
            const errors = validateInventoryCsvRows(rows);
            const warehouseByCode = new Map(warehouses.map((warehouse) => [warehouse.code.toUpperCase(), warehouse]));
            const variantBySku = new Map([...variantsMap.entries()].map(([id, variant]) => [variant.sku.toUpperCase(), id]));
            const levelByWarehouseAndVariant = new Map(levels.map((level) => [`${level.warehouseId}::${level.variantId}`, level]));

            for (const row of rows) {
                const warehouse = warehouseByCode.get(row.warehouse_code.toUpperCase());
                const variantId = variantBySku.get(row.sku.toUpperCase());
                if (!warehouse) errors.push(`Row ${row.sourceRow}: warehouse_code “${row.warehouse_code}” does not exist.`);
                if (!variantId) errors.push(`Row ${row.sourceRow}: sku “${row.sku}” does not exist.`);
                if (warehouse && variantId && Number(row.on_hand) < (levelByWarehouseAndVariant.get(`${warehouse.id}::${variantId}`)?.reserved || 0)) {
                    errors.push(`Row ${row.sourceRow}: on_hand cannot be lower than currently reserved stock.`);
                }
            }
            if (errors.length) {
                setBulkImportErrors(errors);
                setError(`Import stopped: ${errors.length} validation error(s). No inventory was changed.`);
                return;
            }
            if (!window.confirm(`Set stock for ${rows.length} inventory row(s)? This replaces each listed on-hand quantity.`)) return;

            const importErrors: string[] = [];
            let updated = 0;
            for (const row of rows) {
                const warehouse = warehouseByCode.get(row.warehouse_code.toUpperCase())!;
                const variantId = variantBySku.get(row.sku.toUpperCase())!;
                try {
                    await api.setInventory(warehouse.id, {
                        variantId,
                        onHand: Number(row.on_hand),
                        lowStockThreshold: Number(row.low_stock_threshold),
                    });
                    updated += 1;
                } catch (caught) {
                    importErrors.push(`Row ${row.sourceRow} (${row.warehouse_code} / ${row.sku}): ${caught instanceof Error ? caught.message : 'Stock update failed.'}`);
                }
            }
            setBulkImportErrors(importErrors);
            setSuccessMsg(`Inventory import finished: ${updated} row(s) updated${importErrors.length ? `, ${importErrors.length} failed` : ''}.`);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not read the inventory CSV.');
        } finally {
            setBulkImporting(false);
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
                        info.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        info.color?.toLowerCase().includes(searchQuery.toLowerCase())));
            const available = level.onHand - level.reserved;
            const matchesLowStock = !lowStockOnly || available <= level.lowStockThreshold;
            return matchesSearch && matchesLowStock;
        });
    }, [levels, variantsMap, searchQuery, lowStockOnly]);

    return (
        <AdminShell
            title="Inventory"
            description="Review warehouse availability, reservations and low-stock thresholds. New variants appear here automatically with zero stock."
            action={
                <div className="flex flex-wrap justify-end gap-3">
                    <button
                        onClick={() => downloadCsv('glockery-inventory-template.csv', inventoryCsvTemplate())}
                        className="flex h-11 items-center gap-2 border border-gold-500/30 bg-carbon px-3 text-xs font-bold uppercase tracking-wider text-cream hover:border-gold-400"
                    >
                        <IconDownload size={15} /> Template
                    </button>
                    <button
                        onClick={() => downloadCsv('glockery-inventory-export.csv', inventoryCsvExport(levels.flatMap((level) => {
                            const warehouse = warehousesMap.get(level.warehouseId);
                            const variant = variantsMap.get(level.variantId);
                            return warehouse && variant ? [{ warehouseCode: warehouse.code, sku: variant.sku, onHand: level.onHand, lowStockThreshold: level.lowStockThreshold }] : [];
                        })))}
                        disabled={!levels.length}
                        className="flex h-11 items-center gap-2 border border-gold-500/30 bg-carbon px-3 text-xs font-bold uppercase tracking-wider text-cream hover:border-gold-400 disabled:opacity-40"
                    >
                        <IconDownload size={15} /> Export
                    </button>
                    <label className="flex h-11 cursor-pointer items-center gap-2 border border-gold-500/30 bg-carbon px-3 text-xs font-bold uppercase tracking-wider text-cream hover:border-gold-400">
                        <IconPlus size={15} /> {bulkImporting ? 'Importing…' : 'Import CSV'}
                        <input
                            type="file"
                            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            disabled={bulkImporting}
                            className="sr-only"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = '';
                                if (file) void handleInventoryImport(file);
                            }}
                        />
                    </label>
                    <button
                        onClick={() => setOpenWarehouseModal(true)}
                        className="flex h-11 items-center gap-2 bg-gold-400 px-4 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 rounded-sm"
                    >
                        <IconPlus size={16} /> Add Warehouse
                    </button>
                </div>
            }
        >
            <NotificationToast message={error} type="error" onClose={() => setError('')} />
            <NotificationToast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />
            {bulkImportErrors.length > 0 && (
                <div className="mb-6 border border-amber-500/35 bg-amber-950/20 p-4 text-xs text-amber-100" role="alert">
                    <div className="flex items-center justify-between gap-4">
                        <strong>Inventory import report · {bulkImportErrors.length} issue(s)</strong>
                        <button onClick={() => setBulkImportErrors([])} className="text-amber-200/70 hover:text-amber-100">Close</button>
                    </div>
                    <ul className="mt-3 max-h-44 list-disc space-y-1 overflow-y-auto pl-5">
                        {bulkImportErrors.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
                    </ul>
                </div>
            )}

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
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={info?.imageUrl || fallbackImage}
                                                alt=""
                                                loading="lazy"
                                                className="size-12 shrink-0 rounded-sm border border-gold-500/20 bg-obsidian object-cover"
                                                onError={(event) => { event.currentTarget.src = fallbackImage; }}
                                            />
                                            <div>
                                                {info ? (
                                                    <>
                                                        <span className="block text-cream">{info.name}</span>
                                                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                                            {info.color && (
                                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-cream/75">
                                                                    {info.colorHex && (
                                                                        <span
                                                                            role="img"
                                                                            aria-label={`${info.color} colour swatch`}
                                                                            className="size-3.5 shrink-0 rounded-full border border-cream/30 shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                                                                            style={{ backgroundColor: info.colorHex }}
                                                                        />
                                                                    )}
                                                                    {info.color}
                                                                </span>
                                                            )}
                                                            <span className="font-mono text-[10px] font-semibold tracking-wide text-gold-300">
                                                                {info.sku}
                                                            </span>
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span>{level.variantId}</span>
                                                )}
                                                {info?.barcode && (
                                                    <span className="mt-1 block font-mono text-[10px] text-cream/45">
                                                        Barcode: {info.barcode}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
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
                value: form.get('type') === 'PERCENT'
                    ? percentToBasisPoints(Number(form.get('value')))
                    : Number(form.get('value')),
                minimumSubtotalPaise: Number(form.get('minimumSubtotalPaise')) || 0,
                maximumDiscountPaise: form.get('maximumDiscountPaise') ? Number(form.get('maximumDiscountPaise')) : undefined,
                usageLimit: form.get('usageLimit') ? Number(form.get('usageLimit')) : undefined,
                perUserLimit: form.get('perUserLimit') ? Number(form.get('perUserLimit')) : undefined,
                startsAt: localDateBoundaryIso(String(form.get('startsAt'))),
                endsAt: localDateBoundaryIso(String(form.get('endsAt')), true),
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

    const toggleCoupon = async (coupon: Coupon) => {
        try {
            await api.updateCoupon(coupon.id, { isActive: !coupon.isActive });
            setSuccessMsg(`Coupon ${coupon.code} ${coupon.isActive ? 'deactivated' : 'activated'}.`);
            await load();
        } catch (caught) { setError(caught instanceof Error ? caught.message : 'Coupon update failed.'); }
    };

    const editCouponValue = async (coupon: Coupon) => {
        const current = coupon.type === 'PERCENT' ? basisPointsToPercent(coupon.value) : coupon.value;
        const raw = window.prompt(coupon.type === 'PERCENT' ? 'Discount percentage:' : 'Fixed discount in paise:', String(current));
        if (raw === null) return;
        const entered = Number(raw);
        if (!Number.isFinite(entered) || entered <= 0) { setError('Enter a positive discount value.'); return; }
        try {
            await api.updateCoupon(coupon.id, { value: coupon.type === 'PERCENT' ? percentToBasisPoints(entered) : entered });
            setSuccessMsg(`Coupon ${coupon.code} updated.`);
            await load();
        } catch (caught) { setError(caught instanceof Error ? caught.message : 'Coupon update failed.'); }
    };

    return (
        <AdminShell
            title="Promotions"
            description="Create and manage coupon discounts, minimum spends and expiry dates."
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
                            <th className="p-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gold-500/10">
                        {coupons.map((c) => (
                            <tr key={c.id} className="transition-colors hover:bg-gold-400/[.03]">
                                <td className="p-4 font-mono font-bold text-gold-300 text-base">{c.code}</td>
                                <td className="p-4 font-semibold text-cream">{c.type === 'PERCENT' ? `${basisPointsToPercent(c.value)}% OFF` : rupees(c.value)}</td>
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
                                <td className="p-4 text-center"><div className="flex justify-center gap-2"><button onClick={() => void editCouponValue(c)} className="border border-gold-500/30 px-3 py-2 text-xs text-gold-300">Edit</button><button onClick={() => void toggleCoupon(c)} className="border border-gold-500/30 px-3 py-2 text-xs text-gold-300">{c.isActive ? 'Deactivate' : 'Activate'}</button></div></td>
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
                                <span className="mb-1 block text-xs text-cream/70">Maximum Discount in Paise</span>
                                <input name="maximumDiscountPaise" type="number" min="1" placeholder="Optional" className={inputStyle} />
                            </label>
                            <label>
                                <span className="mb-1 block text-xs text-cream/70">Uses Per Customer</span>
                                <input name="perUserLimit" type="number" min="1" placeholder="Optional" className={inputStyle} />
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
            title="Activity log"
            description="Review staff actions, affected records and access details across the admin workspace."
        >
            <NotificationToast message={error} type="error" onClose={() => setError('')} />

            <div className={`${box} overflow-x-auto`}>
                <table className="w-full min-w-[1100px] text-left text-xs">
                    <thead className="border-b border-gold-500/20 text-[9px] uppercase tracking-[0.2em] text-gold-400 bg-obsidian/60">
                        <tr>
                            <th className="p-4">When</th>
                            <th className="p-4">Staff</th>
                            <th className="p-4">Action and record</th>
                            <th className="p-4">What changed</th>
                            <th className="p-4">Source</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gold-500/10">
                        {logs.map((log) => {
                            const changes = auditChangeRows(log);
                            const facts = auditFactRows(log);
                            return (
                                <tr key={log.id} className="align-top transition-colors hover:bg-gold-400/[.03]">
                                    <td className="p-4 text-cream/55">
                                        <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString('en-IN')}</time>
                                    </td>
                                    <td className="p-4">
                                        <p className="font-medium text-cream">{log.actorLabel || (log.actorId ? 'Unknown staff member' : 'System')}</p>
                                        {log.actorId && <p className="mt-1 font-mono text-[10px] text-cream/35">{log.actorId}</p>}
                                    </td>
                                    <td className="p-4">
                                        <p className="font-semibold text-gold-300">{auditActionLabel(log)}</p>
                                        <p className="mt-1 text-cream/75">{auditEntityLabel(log)}</p>
                                        <p className="mt-1 font-mono text-[10px] text-cream/35">
                                            {log.entityType}{log.entityId ? ` · ${log.entityId}` : ''}
                                        </p>
                                    </td>
                                    <td className="p-4">
                                        {changes.length > 0 || facts.length > 0 ? (
                                            <div className="space-y-2.5">
                                                {changes.map((change) => (
                                                    <div key={change.field} className="grid grid-cols-[minmax(110px,0.45fr)_1fr] gap-3">
                                                        <span className="text-cream/50">{change.field}</span>
                                                        <span className="text-cream/80">
                                                            <span className="text-cream/45 line-through decoration-cream/25">{change.before}</span>
                                                            <span className="px-2 text-gold-400" aria-hidden="true">→</span>
                                                            <span>{change.after}</span>
                                                        </span>
                                                    </div>
                                                ))}
                                                {facts.map((fact) => (
                                                    <p key={fact.field} className="text-cream/75">
                                                        <span className="text-cream/45">{fact.field}:</span> {fact.value}
                                                    </p>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-cream/35">No field details recorded</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-cream/55">
                                        <p>{log.ipAddress || 'Internal'}</p>
                                        {log.userAgent && <p className="mt-1 max-w-56 truncate text-[10px] text-cream/35" title={log.userAgent}>{log.userAgent}</p>}
                                    </td>
                                </tr>
                            );
                        })}
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
            title="System health"
            description="Monitor the database, API errors, webhooks and background processing."
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
// 8. USER MANAGEMENT & ROLE ASSIGNMENT
// ----------------------------------------------------
type StaffRole = StaffUser['roles'][number];

const staffRoleOptions: Array<{
    value: StaffRole;
    label: string;
    summary: string;
    access: string;
}> = [
    {
        value: 'ADMIN',
        label: 'Administrator',
        summary: 'Full operational and security control.',
        access: 'All areas, team access, activity log and system health',
    },
    {
        value: 'CATALOGUE_MANAGER',
        label: 'Catalogue manager',
        summary: 'Owns products, categories and offers.',
        access: 'Catalogue, product media, categories and promotions',
    },
    {
        value: 'WAREHOUSE_MANAGER',
        label: 'Warehouse manager',
        summary: 'Keeps fulfilment and stock accurate.',
        access: 'Orders, inventory, warehouses and stock adjustments',
    },
    {
        value: 'SUPPORT_AGENT',
        label: 'Support agent',
        summary: 'Resolves customer order issues.',
        access: 'Orders, returns, refunds and invoice lookup',
    },
];

const roleLabel = (role: StaffRole) => staffRoleOptions.find((option) => option.value === role)?.label || role;

const StaffRoleEditor = ({
    user,
    currentUserId,
    onSaved,
    onCancel,
    onError,
}: {
    user: StaffUser;
    currentUserId?: string;
    onSaved: (success: boolean) => Promise<void>;
    onCancel: () => void;
    onError: (message: string) => void;
}) => {
    const [selectedRoles, setSelectedRoles] = useState<StaffRole[]>(user.roles);
    const [saving, setSaving] = useState(false);
    const isSelf = user.id === currentUserId;
    const changed = staffRoleOptions.some(({ value }) => selectedRoles.includes(value) !== user.roles.includes(value));

    useEffect(() => {
        setSelectedRoles(user.roles);
    }, [user.roles.join('|')]);

    const toggleRole = (role: StaffRole) => {
        setSelectedRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
    };

    const save = async () => {
        setSaving(true);
        onError('');
        const rolesToAdd = selectedRoles.filter((role) => !user.roles.includes(role));
        const rolesToRemove = user.roles.filter((role) => !selectedRoles.includes(role));
        try {
            // Grant replacement access before revoking anything so a failed request cannot lock a member out unexpectedly.
            for (const role of rolesToAdd) await api.assignRole(user.id, role);
            for (const role of rolesToRemove) await api.removeRole(user.id, role);
            await onSaved(true);
        } catch (caught) {
            onError(caught instanceof Error ? caught.message : 'Access changes could not be saved.');
            await onSaved(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="border-t border-[#e8e5dc] bg-[#fbfaf7] px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <fieldset className="min-w-0 flex-1">
                    <legend className="text-sm font-semibold text-[#252925]">Access for {user.fullName || user.email}</legend>
                    <p className="mt-1 text-xs leading-5 text-[#747971]">A team member can hold more than one role. Changes take effect on their next authorized request.</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {staffRoleOptions.map((option) => {
                            const checked = selectedRoles.includes(option.value);
                            const locked = isSelf && option.value === 'ADMIN';
                            return (
                                <label
                                    key={option.value}
                                    className={`flex min-h-20 items-start gap-3 rounded-xl border p-3 transition-colors ${checked ? 'border-[#d49a42] bg-[#fff8e9]' : 'border-[#dedbd2] bg-white hover:border-[#c9c5bb]'} ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={locked || saving}
                                        onChange={() => toggleRole(option.value)}
                                        className="mt-0.5 size-4 accent-[#b87820]"
                                    />
                                    <span>
                                        <span className="block text-xs font-semibold text-[#343934]">{option.label}</span>
                                        <span className="mt-1 block text-[11px] leading-4 text-[#777c75]">{locked ? 'Your own admin access is protected.' : option.summary}</span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                    {!selectedRoles.length && <p className="mt-3 text-xs font-medium text-[#a44c36]">Saving with no roles will remove this account from the staff workspace.</p>}
                </fieldset>
                <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={onCancel} disabled={saving} className="button-secondary">Cancel</button>
                    <button type="button" onClick={() => void save()} disabled={!changed || saving} className="button-primary disabled:cursor-not-allowed disabled:opacity-45">
                        {saving ? 'Saving…' : 'Save access'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const UsersAdmin = () => {
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<StaffRole>('SUPPORT_AGENT');
    const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
    const [createdUser, setCreatedUser] = useState<CreatedStaffUser | null>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<'ALL' | StaffRole>('ALL');
    const [passwordCopied, setPasswordCopied] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const { session } = useAuth();

    const load = async () => {
        try {
            const users = await api.staffUsers();
            setStaffUsers(users);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to load staff accounts.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const handleCreateStaffUser = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccessMsg('');
        setCreatedUser(null);

        try {
            const created = await api.createStaffUser({
                email: email.trim(),
                role,
                ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
            });
            setCreatedUser(created);
            setSuccessMsg(`${created.user.email} can now sign in with the generated temporary password.`);
            setEmail('');
            setFullName('');
            setRole('SUPPORT_AGENT');
            setPasswordCopied(false);
            setInviteOpen(false);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Staff account creation failed.');
        } finally {
            setSaving(false);
        }
    };

    const normalizedSearch = search.trim().toLowerCase();
    const visibleUsers = staffUsers.filter((user) => {
        const matchesSearch = !normalizedSearch || `${user.fullName || ''} ${user.email}`.toLowerCase().includes(normalizedSearch);
        const matchesRole = roleFilter === 'ALL' || user.roles.includes(roleFilter);
        return matchesSearch && matchesRole;
    });
    const administratorCount = staffUsers.filter((user) => user.roles.includes('ADMIN')).length;

    const copyTemporaryPassword = async () => {
        if (!createdUser) return;
        try {
            if (!navigator.clipboard) throw new Error('Clipboard access is unavailable');
            await navigator.clipboard.writeText(createdUser.temporaryPassword);
            setPasswordCopied(true);
        } catch {
            setError('The password could not be copied. Select it and copy it manually.');
        }
    };

    return (
        <AdminShell
            title="Team & roles"
            description="Invite staff and keep access aligned with each person’s responsibilities."
            action={(
                <button type="button" onClick={() => setInviteOpen((open) => !open)} className={inviteOpen ? 'button-secondary gap-2' : 'button-primary gap-2'}>
                    {inviteOpen ? <IconClose size={16} /> : <IconPlus size={16} />}
                    {inviteOpen ? 'Close invite' : 'Invite team member'}
                </button>
            )}
        >
            <NotificationToast message={error} type="error" onClose={() => setError('')} />
            <NotificationToast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />

            <div className="mb-7 grid grid-cols-3 border-y border-[#dedbd2] bg-white">
                <div className="border-r border-[#e5e2da] px-3 py-4 sm:px-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8a8e88] sm:text-[10px] sm:tracking-[0.13em]">Team members</p>
                    <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#252925]">{loading ? '—' : staffUsers.length}</p>
                </div>
                <div className="border-r border-[#e5e2da] px-3 py-4 sm:px-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8a8e88] sm:text-[10px] sm:tracking-[0.13em]">Administrators</p>
                    <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#252925]">{loading ? '—' : administratorCount}</p>
                </div>
                <div className="px-3 py-4 sm:px-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8a8e88] sm:text-[10px] sm:tracking-[0.13em]">Access model</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[#343934] sm:text-sm">4 role-based levels</p>
                </div>
            </div>

            {inviteOpen && (
                <form onSubmit={handleCreateStaffUser} className={`${box} mb-7 overflow-hidden`} aria-labelledby="invite-team-title">
                    <div className="border-b border-[#e5e2da] px-5 py-5 sm:px-6">
                        <h2 id="invite-team-title" className="text-lg font-bold text-[#252925]">Invite a team member</h2>
                        <p className="mt-1 text-xs leading-5 text-[#747971]">We create the account now and show its temporary password once.</p>
                    </div>
                    <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-[1fr_1fr_1.2fr_auto] xl:items-end">
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-[#555b54]">Full name <span className="font-normal text-[#8b8f89]">(optional)</span></span>
                            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Sana Khan" className={inputStyle} />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-[#555b54]">Work email</span>
                            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sana@example.com" className={inputStyle} required />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-[#555b54]">Initial role</span>
                            <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={inputStyle}>
                                {staffRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </label>
                        <button disabled={saving} className="button-primary h-12 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">
                            {saving ? 'Creating…' : 'Create account'}
                        </button>
                    </div>
                </form>
            )}

            {createdUser && (
                <section className="mb-7 rounded-2xl border border-emerald-500/35 bg-emerald-950/20 p-5 sm:p-6" aria-labelledby="temporary-password-title">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-300">Account ready</p>
                            <h2 id="temporary-password-title" className="mt-1 text-lg font-bold text-[#252925]">Copy the temporary password now</h2>
                            <p className="mt-1 text-xs text-cream/70">Send it securely to {createdUser.user.email}. It disappears when you leave this page.</p>
                        </div>
                        <button type="button" onClick={() => setCreatedUser(null)} className="grid size-10 place-items-center rounded-lg text-[#697069] hover:bg-white/60 hover:text-[#252925]" aria-label="Dismiss temporary password"><IconClose size={17} /></button>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <code className="max-w-full overflow-x-auto rounded-lg border border-emerald-500/30 bg-white px-4 py-3 font-mono text-sm tracking-wide text-emerald-200 sm:text-base">{createdUser.temporaryPassword}</code>
                        <button
                            type="button"
                            onClick={() => void copyTemporaryPassword()}
                            className="button-secondary"
                        >
                            {passwordCopied ? 'Copied' : 'Copy password'}
                        </button>
                    </div>
                </section>
            )}

            <section className="mb-7" aria-labelledby="role-guide-title">
                <div className="mb-4">
                    <h2 id="role-guide-title" className="text-base font-bold text-[#252925]">Role guide</h2>
                    <p className="mt-1 text-xs text-[#747971]">Use the narrowest access that covers the person’s day-to-day work.</p>
                </div>
                <div className="admin-role-scroll flex snap-x snap-mandatory overflow-x-auto rounded-2xl border border-[#dedbd2] bg-white md:grid md:grid-cols-2 md:overflow-hidden xl:grid-cols-4">
                    {staffRoleOptions.map((option, index) => (
                        <div
                            key={option.value}
                            className={`w-[78vw] max-w-[290px] shrink-0 snap-start border-r border-[#e8e5dc] p-5 last:border-r-0 md:w-auto md:max-w-none ${index === 1 ? 'md:border-r-0 xl:border-r' : ''} ${index === 2 ? 'md:border-t md:border-r xl:border-t-0' : ''} ${index === 3 ? 'md:border-t md:border-r-0 xl:border-t-0' : ''}`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="grid size-7 place-items-center rounded-lg bg-[#fff3da] text-[#9b671d]"><IconShield size={14} /></span>
                                <h3 className="text-sm font-semibold text-[#303530]">{option.label}</h3>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-[#747971]">{option.access}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className={`${box} overflow-hidden`} aria-labelledby="staff-accounts-title">
                <div className="flex flex-col gap-4 border-b border-[#e5e2da] p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 id="staff-accounts-title" className="text-base font-bold text-[#252925]">Team directory</h2>
                        <p className="mt-1 text-xs text-[#747971]">Only accounts with staff access are shown.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <label className="relative block">
                            <span className="sr-only">Search team members</span>
                            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8f89]" />
                            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className="admin-field h-11 w-full !pl-9 text-xs sm:w-56" />
                        </label>
                        <label>
                            <span className="sr-only">Filter by role</span>
                            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'ALL' | StaffRole)} className="admin-field h-11 w-full text-xs sm:w-48">
                                <option value="ALL">All roles</option>
                                {staffRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </label>
                        <button type="button" onClick={() => void load()} className="button-secondary h-11 gap-2" aria-label="Refresh team directory"><IconRefresh size={15} /> Refresh</button>
                    </div>
                </div>

                <div className="hidden grid-cols-[minmax(220px,1.2fr)_minmax(200px,1fr)_minmax(260px,1.4fr)_120px_112px] gap-4 border-b border-[#e8e5dc] bg-[#f8f7f3] px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#858a83] lg:grid">
                    <span>Team member</span><span>Email</span><span>Access</span><span>Joined</span><span className="text-right">Action</span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center gap-3 px-6 py-14 text-sm text-[#747971]" role="status"><span className="size-2 animate-pulse rounded-full bg-[#d3912e]" /> Loading team…</div>
                ) : visibleUsers.length ? (
                    <ul className="divide-y divide-[#ece9e2]">
                        {visibleUsers.map((user) => {
                            const isEditing = editingUserId === user.id;
                            const initials = (user.fullName || user.email).split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
                            return (
                                <li key={user.id}>
                                    <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(220px,1.2fr)_minmax(200px,1fr)_minmax(260px,1.4fr)_120px_112px] lg:items-center">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold ${user.roles.includes('ADMIN') ? 'bg-[#fff0ce] text-[#8d5a15]' : 'bg-[#eceee9] text-[#596059]'}`}>{initials}</span>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-[#303530]">{user.fullName || 'Unnamed staff member'}</p>
                                                {user.id === session?.user?.id && <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9b671d]">You</p>}
                                            </div>
                                        </div>
                                        <p className="break-all text-xs text-[#626861]"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#969a94] lg:hidden">Email</span>{user.email}</p>
                                        <div>
                                            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#969a94] lg:hidden">Access</span>
                                            <div className="flex flex-wrap gap-1.5">{user.roles.map((item) => <span key={item} className="rounded-md border border-[#dfd8c9] bg-[#fffaf0] px-2 py-1 text-[10px] font-semibold text-[#82581b]">{roleLabel(item)}</span>)}</div>
                                        </div>
                                        <p className="text-xs text-[#737871]"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#969a94] lg:hidden">Joined</span>{shortDate(user.createdAt)}</p>
                                        <button type="button" onClick={() => setEditingUserId(isEditing ? null : user.id)} className={`h-10 justify-center text-xs ${isEditing ? 'button-primary' : 'button-secondary'}`} aria-expanded={isEditing}>
                                            {isEditing ? 'Editing' : 'Edit access'}
                                        </button>
                                    </div>
                                    {isEditing && (
                                        <StaffRoleEditor
                                            user={user}
                                            currentUserId={session?.user?.id}
                                            onCancel={() => setEditingUserId(null)}
                                            onError={setError}
                                            onSaved={async (success) => {
                                                await load();
                                                if (success) {
                                                    setEditingUserId(null);
                                                    setSuccessMsg(`Access updated for ${user.fullName || user.email}.`);
                                                }
                                            }}
                                        />
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="px-6 py-14 text-center">
                        <p className="text-sm font-semibold text-[#434943]">{staffUsers.length ? 'No matching team members' : 'No staff accounts yet'}</p>
                        <p className="mt-1 text-xs text-[#7a7f78]">{staffUsers.length ? 'Try a different search or role filter.' : 'Invite the first person to start building your team.'}</p>
                    </div>
                )}
            </section>
        </AdminShell>
    );
};

// ----------------------------------------------------
// MAIN ROUTER CONTAINER
// ----------------------------------------------------
const AdminPage = () => {
    const { signedIn, isInitializing, session } = useAuth();
    const path = useLocation().pathname;

    if (isInitializing) {
        return (
            <div className="grid min-h-screen place-items-center bg-[#f5f3ed] text-[#343934]" role="status">
                <div className="flex items-center gap-3 text-sm font-semibold">
                    <span className="size-2 animate-pulse rounded-full bg-[#d3912e]" /> Preparing your workspace…
                </div>
            </div>
        );
    }
    if (!signedIn) return <Redirect to={`/admin/login?next=${encodeURIComponent(path)}`} />;
    const roles = session?.roles || [];
    const allowed = (...required: AppRole[]) => required.some((role) => roles.includes(role));
    if (!allowed('ADMIN', 'CATALOGUE_MANAGER', 'WAREHOUSE_MANAGER', 'SUPPORT_AGENT')) return <Redirect to="/account" />;
    const defaultPath = allowed('ADMIN') ? '/admin' : allowed('CATALOGUE_MANAGER') ? '/admin/catalogue' : '/admin/orders';

    if (path === '/admin' && !allowed('ADMIN')) return <Redirect to={defaultPath} />;
    if (path.startsWith('/admin/orders') && !allowed('ADMIN', 'SUPPORT_AGENT', 'WAREHOUSE_MANAGER')) return <Redirect to={defaultPath} />;
    if ((path.startsWith('/admin/catalogue') || path.startsWith('/admin/promotions')) && !allowed('ADMIN', 'CATALOGUE_MANAGER')) return <Redirect to={defaultPath} />;
    if (path.startsWith('/admin/inventory') && !allowed('ADMIN', 'WAREHOUSE_MANAGER')) return <Redirect to={defaultPath} />;
    if ((path.startsWith('/admin/users') || path.startsWith('/admin/audit-logs') || path.startsWith('/admin/operations')) && !allowed('ADMIN')) return <Redirect to={defaultPath} />;

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
