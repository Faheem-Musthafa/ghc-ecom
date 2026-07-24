import React from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/Header';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';
import { IconCheckCircle, IconClock, IconPackage, IconTruck } from '../components/Icons';

export const ShipmentTrackingPage = () => {
    const { trackingNumber } = useParams<{ trackingNumber?: string }>();
    const trackingRef = trackingNumber || 'GLK-TRK-98123';

    const steps = [
        { label: 'Order Confirmed', date: 'Jul 22, 2026', done: true },
        { label: 'Warehouse Dispatched', date: 'Jul 23, 2026', done: true },
        { label: 'In Transit with Express Courier', date: 'Jul 23, 2026', current: true },
        { label: 'Out for Delivery', date: 'Estimated Tomorrow', done: false },
        { label: 'Delivered', date: 'Pending', done: false },
    ];

    return (
        <div className="min-h-screen bg-obsidian text-cream flex flex-col justify-between">
            <SEOHead title={`Tracking ${trackingRef} | Glockery`} />
            <Header />
            <main className="flex-1 px-6 py-12 lg:px-10 lg:py-16 max-w-3xl mx-auto w-full">
                <div className="border border-gold-500/25 bg-carbon p-8 rounded-sm shadow-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gold-500/20 pb-6">
                        <div>
                            <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gold-400">
                                Live Courier Tracking
                            </span>
                            <h1 className="mt-1 font-display text-3xl text-cream">Package Journey</h1>
                            <p className="mt-1 font-mono text-xs text-gold-300">Tracking Code: {trackingRef}</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-4 py-1.5 text-xs text-emerald-300 font-medium">
                            <IconTruck size={16} /> In Transit
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="mt-8 space-y-6">
                        {steps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-4">
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`flex size-8 items-center justify-center rounded-full border text-xs font-bold ${
                                            step.done
                                                ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-400'
                                                : step.current
                                                ? 'border-gold-400 bg-gold-400/20 text-gold-300 animate-pulse'
                                                : 'border-gold-500/20 bg-obsidian text-cream/30'
                                        }`}
                                    >
                                        {step.done ? <IconCheckCircle size={14} color="#10B981" /> : idx + 1}
                                    </div>
                                    {idx < steps.length - 1 && (
                                        <div
                                            className={`h-8 w-0.5 ${
                                                step.done ? 'bg-emerald-500/40' : 'bg-gold-500/15'
                                            }`}
                                        />
                                    )}
                                </div>
                                <div className="pt-1">
                                    <h4 className={`text-sm font-semibold ${step.current ? 'text-gold-300' : step.done ? 'text-cream' : 'text-cream/40'}`}>
                                        {step.label}
                                    </h4>
                                    <p className="text-[11px] text-cream/40">{step.date}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            <StoreFooter />
        </div>
    );
};
export default ShipmentTrackingPage;
