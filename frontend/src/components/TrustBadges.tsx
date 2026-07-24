import React from 'react';
import { IconAward, IconShieldCheck, IconTruck } from './Icons';

const TrustBadges = () => (
    <section className="border-y border-gold-500/20 bg-carbon">
        <div className="mx-auto grid max-w-[1440px] divide-y divide-gold-500/15 px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:px-12">
            {[
                [<IconAward />, 'Made to command attention', 'Distinctive material and finish'],
                [<IconTruck />, 'Protected delivery', 'Breakage-safe packaging across India'],
                [<IconShieldCheck />, 'Secure by design', 'Server-verified Razorpay payments'],
            ].map(([icon, title, copy]) => (
                <article key={String(title)} className="flex items-center gap-5 py-7 sm:px-7">
                    <span className="text-gold-400">{icon}</span>
                    <div><h3 className="text-sm text-cream">{title}</h3><p className="mt-1 text-xs text-cream/40">{copy}</p></div>
                </article>
            ))}
        </div>
    </section>
);

export default TrustBadges;
