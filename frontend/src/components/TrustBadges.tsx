import React from 'react';
import { IconAward, IconShieldCheck, IconTruck } from './Icons';

const TrustBadges = () => (
    <section className="border-y border-line bg-obsidian" aria-label="Shopping assurances">
        <div className="mx-auto grid max-w-[1440px] divide-y divide-line px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8 lg:px-12">
            {[
                [<IconAward size={20} className="shrink-0 text-gold-400" />, 'Crockery & kitchenware', 'Dinner sets, tea sets, canisters, serving dishes and more'],
                [<IconTruck size={20} className="shrink-0 text-gold-400" />, 'Free delivery', 'Available for orders across India'],
                [<IconShieldCheck size={20} className="shrink-0 text-gold-400" />, 'Secure checkout', 'Server-verified payments powered by Razorpay'],
            ].map(([icon, title, copy]) => (
                <article key={String(title)} className="flex min-h-32 items-start gap-4 py-7 sm:px-7">
                    <span className="grid size-10 shrink-0 place-items-center border border-line">{icon}</span>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-cream">{title}</h3>
                        <p className="mt-2 text-xs leading-5 text-cream/45">{copy}</p>
                    </div>
                </article>
            ))}
        </div>
    </section>
);

export default TrustBadges;
