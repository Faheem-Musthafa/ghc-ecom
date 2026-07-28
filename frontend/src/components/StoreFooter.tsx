import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowRight, IconCheckCircle, IconShield } from './Icons';

const StoreFooter = () => {
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);

    const subscribe = (event: React.FormEvent) => {
        event.preventDefault();
        if (!email.trim()) return;
        setSubscribed(true);
        setEmail('');
    };

    return (
        <footer className="border-t border-line bg-carbon text-cream">
            <div className="mx-auto grid max-w-[1440px] border-x border-line lg:grid-cols-[0.9fr_1.1fr]">
                <section className="border-b border-line p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
                    <p className="eyebrow">Notes from the table</p>
                    <h2 className="mt-3 max-w-lg font-display text-4xl font-semibold leading-tight sm:text-5xl">New pieces, care notes, and considered hosting ideas.</h2>
                    <p className="mt-5 max-w-lg text-sm leading-7 text-cream/55">A useful email, sent occasionally. No countdowns, noise, or manufactured urgency.</p>
                </section>

                <section className="flex items-center p-7 sm:p-10 lg:p-14">
                    {subscribed ? (
                        <div className="flex items-start gap-3 text-sm text-cream" role="status" aria-live="polite">
                            <IconCheckCircle size={20} color="#c9a35b" className="mt-0.5 shrink-0" />
                            <div><strong className="block">You&apos;re on the list.</strong><span className="text-cream/50">Look out for a confirmation email.</span></div>
                        </div>
                    ) : (
                        <form onSubmit={subscribe} className="w-full">
                            <label htmlFor="footer-email" className="mb-2 block text-xs font-semibold text-cream/75">Email address</label>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <input id="footer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required className="field min-w-0 flex-1 text-sm" />
                                <button type="submit" className="button-primary gap-3 sm:min-w-40">Subscribe <IconArrowRight size={16} /></button>
                            </div>
                            <p className="mt-3 text-[10px] leading-relaxed text-cream/35">By subscribing, you agree to our privacy policy. Unsubscribe at any time.</p>
                        </form>
                    )}
                </section>
            </div>

            <div className="mx-auto grid max-w-[1440px] gap-10 border-x border-t border-line px-7 py-14 sm:grid-cols-2 sm:px-10 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.9fr] lg:px-14 lg:py-16">
                <div className="max-w-sm">
                    <Link to="/" className="inline-flex items-center gap-3" aria-label="Glockery Home Centre">
                        <span className="grid size-10 place-items-center border border-gold-400 font-display text-2xl font-semibold text-gold-300">G</span>
                        <span>
                            <span className="block text-lg font-bold tracking-[0.22em]">GLOCKERY</span>
                            <small className="block text-[8px] uppercase tracking-[0.34em] text-cream/40">Home Centre</small>
                        </span>
                    </Link>
                    <p className="mt-6 text-sm leading-7 text-cream/50">Distinctive tableware and home objects selected for proportion, material, and everyday use.</p>
                    <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-cream/45"><IconShield size={15} className="text-gold-400" /> Secure payments via Razorpay</div>
                </div>

                <nav aria-label="Shop links">
                    <p className="eyebrow mb-5">Shop</p>
                    <ul className="space-y-3 text-sm text-cream/55">
                        <li><Link className="hover:text-gold-200" to="/search">All products</Link></li>
                        <li><Link className="hover:text-gold-200" to="/category/serveware">Serveware</Link></li>
                        <li><Link className="hover:text-gold-200" to="/category/cutlery">Cutlery</Link></li>
                        <li><Link className="hover:text-gold-200" to="/category/dinnerware">Dinnerware</Link></li>
                        <li><Link className="hover:text-gold-200" to="/wishlist">Saved pieces</Link></li>
                    </ul>
                </nav>

                <nav aria-label="Customer care links">
                    <p className="eyebrow mb-5">Customer care</p>
                    <ul className="space-y-3 text-sm text-cream/55">
                        <li><Link className="hover:text-gold-200" to="/order-lookup">Find an order</Link></li>
                        <li><Link className="hover:text-gold-200" to="/shipping-returns">Shipping &amp; returns</Link></li>
                        <li><Link className="hover:text-gold-200" to="/faq">Frequently asked</Link></li>
                        <li><Link className="hover:text-gold-200" to="/contact">Contact us</Link></li>
                        <li><Link className="hover:text-gold-200" to="/account">My account</Link></li>
                    </ul>
                </nav>

                <div>
                    <p className="eyebrow mb-5">The house</p>
                    <ul className="space-y-3 text-sm text-cream/55">
                        <li><Link className="hover:text-gold-200" to="/about">Our story</Link></li>
                        <li><Link className="hover:text-gold-200" to="/privacy">Privacy</Link></li>
                        <li><Link className="hover:text-gold-200" to="/terms">Terms</Link></li>
                    </ul>
                    <address className="mt-7 not-italic text-sm leading-7 text-cream/45">
                        care@glockery.in<br />
                        +91 92072 32303<br />
                        Mon–Sat, 10:00–18:00 IST
                    </address>
                </div>
            </div>

            <div className="border-t border-line bg-obsidian px-6 py-5">
                <div className="mx-auto flex max-w-[1340px] flex-col justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-cream/35 sm:flex-row">
                    <span>© {new Date().getFullYear()} Glockery Home Centre</span>
                    <span>Designed for homes that are lived in</span>
                </div>
            </div>
        </footer>
    );
};

export default StoreFooter;
