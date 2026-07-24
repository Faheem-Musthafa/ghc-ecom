import React from 'react';
import { Link } from 'react-router-dom';

const StoreFooter = () => (
    <footer className="border-t border-gold-500/20 bg-obsidian">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1.5fr_1fr_1fr] lg:px-12 lg:py-24">
            <div>
                <Link to="/" className="font-display text-3xl tracking-[0.2em] text-gold-300">GLOCKERY</Link>
                <p className="mt-5 max-w-md text-sm leading-7 text-cream/45">Distinctive serveware and tableware for modern Indian homes. Black lacquer, warm gold, and pieces that hold the room.</p>
            </div>
            <div><p className="text-[10px] uppercase tracking-[0.28em] text-gold-400">Explore</p><div className="mt-5 flex flex-col gap-3 text-sm text-cream/55"><Link className="hover:text-gold-300" to="/">Collection</Link><Link className="hover:text-gold-300" to="/wishlist">Wishlist</Link><Link className="hover:text-gold-300" to="/account/orders">Orders</Link><Link className="hover:text-gold-300" to="/auth">Account</Link><Link className="hover:text-gold-300" to="/about">About Glockery</Link></div></div>
            <div><p className="text-[10px] uppercase tracking-[0.28em] text-gold-400">Concierge</p><div className="mt-5 flex flex-col gap-3 text-sm text-cream/55"><Link className="hover:text-gold-300" to="/faq">FAQ</Link><Link className="hover:text-gold-300" to="/shipping-returns">Delivery & returns</Link><Link className="hover:text-gold-300" to="/contact">Contact us</Link><a className="hover:text-gold-300" href="mailto:care@glockery.in">care@glockery.in</a><span>Mon–Sat · 10:00–18:00 IST</span></div></div>
        </div>
        <div className="flex flex-wrap justify-center gap-5 border-t border-gold-500/10 px-6 py-5 text-center text-[10px] uppercase tracking-[0.18em] text-cream/30"><span>© 2026 Glockery Home Centre · Payments secured by Razorpay</span><Link to="/privacy" className="hover:text-gold-300">Privacy</Link><Link to="/terms" className="hover:text-gold-300">Terms</Link></div>
    </footer>
);

export default StoreFooter;
