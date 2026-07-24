import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import StoreFooter from '../components/StoreFooter';
import SEOHead from '../components/SEOHead';

type InfoPageKind = 'about' | 'shipping' | 'faq' | 'contact' | 'privacy' | 'terms';

const content: Record<InfoPageKind, { eyebrow: string; title: string; intro: string }> = {
    about: { eyebrow: 'The house of Glockery', title: 'Objects with presence.', intro: 'Distinctive tableware for homes that make room for ritual, texture, and a little theatre.' },
    shipping: { eyebrow: 'Care & delivery', title: 'From our studio to your table.', intro: 'Every piece is checked, wrapped, and sent with the attention it deserves.' },
    faq: { eyebrow: 'Concierge desk', title: 'Answers, before you ask.', intro: 'A few useful notes about orders, care, delivery, and returns.' },
    contact: { eyebrow: 'Private concierge', title: 'Let’s make room for it.', intro: 'Our team is here for product guidance, gifting, order help, and anything that needs a human answer.' },
    privacy: { eyebrow: 'Your privacy', title: 'Your details stay yours.', intro: 'A plain-language overview of how Glockery uses the information needed to serve you.' },
    terms: { eyebrow: 'Store terms', title: 'Good things, clearly stated.', intro: 'The terms that keep shopping at Glockery simple and fair.' },
};

const sections: Record<InfoPageKind, Array<{ title: string; body: string }>> = {
    about: [
        { title: 'A considered collection', body: 'Glockery brings together serveware, tableware, and home accents chosen for their materiality and everyday usefulness. We look for pieces that feel special without waiting for a special occasion.' },
        { title: 'Modern Indian homes', body: 'Our palette is warm, tactile, and quietly dramatic: black lacquer, brushed gold, natural wood, and forms that sit comfortably between hosting and living.' },
        { title: 'Made to be used', body: 'The best objects gather stories. Use your pieces often, care for them gently, and let the marks of a well-lived table become part of their character.' },
    ],
    shipping: [
        { title: 'Dispatch', body: 'Orders are usually packed within 1–2 business days. You will receive an email when your parcel leaves us, with tracking details where available.' },
        { title: 'Delivery windows', body: 'Standard delivery is generally 3–5 business days after dispatch. Express delivery is generally 1–2 business days after dispatch. Remote-area timelines may vary.' },
        { title: 'Returns & refunds', body: 'Request a return within 30 days of delivery. Items must be unused and in their original protective packaging. Once approved and received, eligible refunds are issued to the original payment method.' },
        { title: 'Arrived damaged?', body: 'Please contact care@glockery.in within 48 hours with your order number and clear photographs of the packaging and item. We will take it from there.' },
    ],
    faq: [
        { title: 'Can I change or cancel an order?', body: 'Write to care@glockery.in as soon as possible. We can change or cancel an order only before it enters fulfilment.' },
        { title: 'How do I care for my pieces?', body: 'Unless a product page says otherwise, hand wash with a mild soap, dry promptly, and avoid abrasive cleaners. Keep gold-finished details away from dishwashers and harsh chemicals.' },
        { title: 'Do you offer gifting?', body: 'Yes. Add your gifting request to the order notes or contact the concierge before placing the order for help with a considered presentation.' },
        { title: 'Where is my invoice?', body: 'Signed-in customers can download invoices from Account → Orders. Guest customers can use Order Lookup with their order reference and email.' },
    ],
    contact: [
        { title: 'Email', body: 'care@glockery.in — order support, product questions, returns, and gifting.' },
        { title: 'Phone', body: '+91 92072 32303 — Monday to Saturday, 10:00–18:00 IST.' },
        { title: 'For a faster answer', body: 'Include your order number, the email used at checkout, and a short description of what you need. We aim to reply within one business day.' },
    ],
    privacy: [
        { title: 'What we collect', body: 'We collect the details needed to create your account, deliver orders, process payments, provide support, and keep the store secure.' },
        { title: 'What we do not do', body: 'We do not store your Razorpay card or UPI credentials, and we do not sell your personal information. Payment details are handled by the payment provider.' },
        { title: 'Your choices', body: 'You can ask us to update or delete your account information, subject to records we must retain for tax, fraud prevention, or legal compliance.' },
    ],
    terms: [
        { title: 'Orders & availability', body: 'An order is accepted once payment is verified. If an item becomes unavailable before fulfilment, we will contact you and refund the affected amount.' },
        { title: 'Prices', body: 'Prices are shown in INR and include applicable taxes where stated. Delivery charges and promotional discounts are calculated at checkout.' },
        { title: 'Responsible use', body: 'Please keep account credentials private and provide accurate delivery details. We may pause or cancel activity that appears fraudulent or abusive.' },
    ],
};

export const InfoPage = ({ kind }: { kind: InfoPageKind }) => {
    const page = content[kind];
    return (
        <div className="min-h-screen bg-obsidian text-cream">
            <SEOHead title={`${page.title} | Glockery`} />
            <Header />
            <main id="main-content" className="mx-auto max-w-5xl px-6 py-16 sm:px-10 lg:px-12 lg:py-24">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-400">{page.eyebrow}</p>
                <h1 className="mt-5 max-w-3xl font-display text-5xl leading-tight text-cream sm:text-7xl">{page.title}</h1>
                <p className="mt-6 max-w-2xl text-base leading-8 text-cream/55">{page.intro}</p>
                <div className="mt-16 grid gap-px overflow-hidden border border-gold-500/20 bg-gold-500/20 md:grid-cols-2">
                    {sections[kind].map((section) => (
                        <article key={section.title} className="bg-carbon p-7 sm:p-9">
                            <h2 className="font-display text-2xl text-gold-300">{section.title}</h2>
                            <p className="mt-4 text-sm leading-7 text-cream/55">{section.body}</p>
                        </article>
                    ))}
                </div>
                <div className="mt-14 flex flex-wrap gap-5 text-xs uppercase tracking-[0.18em]">
                    <Link to="/" className="text-gold-300 hover:text-gold-200">Return to collection →</Link>
                    {kind !== 'contact' && <Link to="/contact" className="text-cream/45 hover:text-gold-300">Speak with concierge →</Link>}
                </div>
            </main>
            <StoreFooter />
        </div>
    );
};

export default InfoPage;
