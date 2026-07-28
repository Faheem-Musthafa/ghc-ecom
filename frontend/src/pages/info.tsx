import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import {
    IconArrowRight,
    IconBadgeCheck,
    IconCheckCircle,
    IconChevronDown,
    IconMessageCircle,
    IconPackage,
    IconShieldCheck,
    IconTruck,
} from '../components/Icons';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';

export type InfoPageKind = 'about' | 'shipping' | 'faq' | 'contact' | 'privacy' | 'terms';

interface SectionItem {
    title: string;
    body: string;
}

const pageContent: Record<
    InfoPageKind,
    {
        eyebrow: string;
        title: string;
        metaTitle: string;
        metaDesc: string;
        intro: string;
        sections: SectionItem[];
    }
> = {
    about: {
        eyebrow: 'House of Glockery',
        title: 'Objects with presence. Designed for ritual.',
        metaTitle: 'About Glockery Home Centre | Tableware & Serveware',
        metaDesc: 'Discover Glockery Home Centre and our approach to selecting tableware, serveware, and home accents for modern Indian homes.',
        intro: 'Glockery Home Centre creates tableware and living accents chosen for their weight, texture, and quiet drama. Made for gatherings that outlast the evening.',
        sections: [
            {
                title: 'A Considered Collection',
                body: 'Glockery brings together serveware, tableware, and home accents chosen for their materiality and everyday usefulness. We look for pieces that feel special without waiting for a special occasion.',
            },
            {
                title: 'Modern Indian Homes',
                body: 'Our palette is warm, tactile, and quietly dramatic: black lacquer, brushed gold, natural wood, and forms that sit comfortably between hosting and daily living.',
            },
            {
                title: 'Artisanal Craftsmanship',
                body: 'Every silhouette is selected for contrast, weight, and everyday function. Material and origin details are listed on each product page so you can choose with confidence.',
            },
            {
                title: 'Made to be Cherished',
                body: 'The best objects gather stories. Use your pieces often, care for them gently, and let the marks of a well-lived table become part of their timeless character.',
            },
        ],
    },
    shipping: {
        eyebrow: 'Care & delivery',
        title: 'From our studio to your dining table.',
        metaTitle: 'Insured Shipping & 30-Day Returns | Glockery Home Centre',
        metaDesc: 'Read about Glockery Home Centre shipping timelines, insured door-step delivery across India, and our hassle-free 30-day return policy.',
        intro: 'Every piece is double-checked, wrapped in protective multi-layer packaging, and shipped with full transit insurance across India.',
        sections: [
            {
                title: 'Dispatch & Packing',
                body: 'Orders are meticulously packed within 1–2 business days. You will receive an automated tracking SMS and email as soon as your parcel leaves our fulfillment studio.',
            },
            {
                title: 'Delivery Windows',
                body: 'Standard delivery takes 3–5 business days post dispatch. Express air delivery reaches major metros within 1–2 business days.',
            },
            {
                title: '30-Day Hassle-Free Returns',
                body: 'Request a return within 30 days of delivery through your Account portal. Items must be unused and in original gift packaging for full refund processing.',
            },
            {
                title: 'Transit Guarantee',
                body: 'Arrived damaged? Email care@glockery.in within 48 hours with clear photos of the item and packaging. Our team will review the issue and explain the replacement or refund options.',
            },
        ],
    },
    faq: {
        eyebrow: 'Help desk',
        title: 'Frequently Asked Questions',
        metaTitle: 'Frequently Asked Questions & Care Guide | Glockery Home Centre',
        metaDesc: 'Find instant answers to questions regarding order changes, tableware care, gold accents maintenance, tax invoices, and gifting services.',
        intro: 'A few useful notes about order modifications, piece maintenance, corporate gifting, and tax invoices.',
        sections: [
            {
                title: 'Can I change or cancel an order after placing it?',
                body: 'Write to care@glockery.in as soon as possible. We can modify delivery addresses or cancel an order free of charge before it enters warehouse fulfillment.',
            },
            {
                title: 'How do I care for my gold-finished tableware?',
                body: 'Hand wash with mild soap and a soft micro-fiber sponge. Dry promptly to prevent water spots. Keep gold-finished details away from harsh abrasives and automated dishwashers.',
            },
            {
                title: 'Do you offer customized corporate gifting & packaging?',
                body: 'Yes. Add your gifting request to order notes or speak directly with our concierge team for custom monogramming and presentation boxes.',
            },
            {
                title: 'Where can I download my GST tax invoice?',
                body: 'Signed-in accounts can download tax invoices anytime under Account → Orders. Guest customers can access invoices via our Order Lookup tool.',
            },
        ],
    },
    contact: {
        eyebrow: 'Customer care',
        title: 'Speak with our care team',
        metaTitle: 'Contact Customer Care | Glockery Home Centre',
        metaDesc: 'Get in touch with Glockery Home Centre for product guidance, gifting support, or order help.',
        intro: 'Our care team is available for product guidance, gifting questions, order help, and anything requiring a human answer.',
        sections: [
            {
                title: 'Email support',
                body: 'care@glockery.in — write to us for order status, custom inquiries, corporate orders, and returns.',
            },
            {
                title: 'Direct Phone & WhatsApp',
                body: '+91 92072 32303 — Monday to Saturday, 10:00–18:00 IST.',
            },
            {
                title: 'Faster Resolution Tip',
                body: 'Please include your order number (e.g. GHC-10024) and registered email address for priority assistance within 1 business hour.',
            },
        ],
    },
    privacy: {
        eyebrow: 'Data Integrity',
        title: 'Your privacy and trust stay paramount.',
        metaTitle: 'Privacy Policy | Glockery Home Centre',
        metaDesc: 'Glockery Home Centre privacy policy outlines how customer data is protected and secured using ISO 27001 standards.',
        intro: 'A clear overview of how Glockery securely handles personal information needed to process your orders.',
        sections: [
            {
                title: 'Information We Collect',
                body: 'We collect customer names, delivery addresses, email addresses, and phone numbers strictly for order fulfillment, account authentication, and shipping notifications.',
            },
            {
                title: 'Payment & Credential Security',
                body: 'We do not store your credit card, debit card, or UPI banking credentials. All payments are encrypted and verified through Razorpay under PCI-DSS Level 1 compliance.',
            },
            {
                title: 'Data Sharing Policy',
                body: 'We never sell or rent customer personal data. Information is shared only with logistics carriers (for shipping) and payment providers (for transaction verification).',
            },
        ],
    },
    terms: {
        eyebrow: 'Store Terms',
        title: 'Standard Terms & Conditions',
        metaTitle: 'Terms & Conditions | Glockery Home Centre',
        metaDesc: 'Review terms of service, payment policies, pricing transparency, and order terms for Glockery Home Centre.',
        intro: 'The terms that keep shopping at Glockery transparent, fair, and reliable.',
        sections: [
            {
                title: 'Order Acceptance & Availability',
                body: 'An order is confirmed upon verification of payment. If an item becomes out of stock prior to dispatch, we notify you immediately and process a full refund.',
            },
            {
                title: 'Pricing & Taxes',
                body: 'All product prices are displayed in Indian Rupees (INR) and include GST taxes where specified. Delivery charges are calculated transparently at checkout.',
            },
            {
                title: 'Account Security',
                body: 'Customers are responsible for maintaining account confidentiality. Glockery reserves the right to pause accounts associated with fraudulent activity.',
            },
        ],
    },
};

export const InfoPage = ({ kind = 'about' }: { kind?: InfoPageKind }) => {
    const page = pageContent[kind];
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [contactForm, setContactForm] = useState({ name: '', email: '', message: '', orderRef: '' });
    const [contactSent, setContactSent] = useState(false);

    // Dynamic Structured Data Schema (JSON-LD) for SEO / AEO
    let structuredData: Record<string, unknown> | undefined;

    if (kind === 'about') {
        structuredData = {
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            name: page.title,
            description: page.metaDesc,
            mainEntity: {
                '@type': 'Organization',
                name: 'Glockery Home Centre',
                url: 'https://glockery.in',
                logo: 'https://glockery.in/logo.png',
                email: 'care@glockery.in',
                telephone: '+91 92072 32303',
            },
        };
    } else if (kind === 'faq') {
        structuredData = {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: page.sections.map((item) => ({
                '@type': 'Question',
                name: item.title,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: item.body,
                },
            })),
        };
    } else if (kind === 'contact') {
        structuredData = {
            '@context': 'https://schema.org',
            '@type': 'ContactPage',
            name: 'Glockery Customer Care',
            description: page.metaDesc,
            mainEntity: {
                '@type': 'Organization',
                name: 'Glockery Home Centre',
                telephone: '+91 92072 32303',
                email: 'care@glockery.in',
            },
        };
    }

    const handleContactSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const subject = contactForm.orderRef ? `Order help: ${contactForm.orderRef}` : 'Glockery website enquiry';
        const body = `${contactForm.message}\n\nName: ${contactForm.name}\nEmail: ${contactForm.email}${contactForm.orderRef ? `\nOrder: ${contactForm.orderRef}` : ''}`;
        window.location.href = `mailto:care@glockery.in?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setContactSent(true);
        setTimeout(() => setContactSent(false), 6000);
    };

    const tabs: Array<{ id: InfoPageKind; label: string; href: string }> = [
        { id: 'about', label: 'About', href: '/about' },
        { id: 'shipping', label: 'Shipping & returns', href: '/shipping-returns' },
        { id: 'faq', label: 'FAQ', href: '/faq' },
        { id: 'contact', label: 'Contact', href: '/contact' },
        { id: 'privacy', label: 'Privacy', href: '/privacy' },
        { id: 'terms', label: 'Terms', href: '/terms' },
    ];

    return (
        <div className="min-h-screen bg-obsidian text-cream font-body flex flex-col justify-between">
            <SEOHead
                title={page.metaTitle}
                description={page.metaDesc}
                structuredData={structuredData}
            />
            <Header />

            <main id="main-content" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-10 sm:px-8 lg:px-12 lg:py-16">
                {/* Secondary Info Header Switcher Tabs */}
                <div className="mb-10 flex items-center gap-2 overflow-x-auto border-b border-gold-500/20 pb-4 scrollbar-none">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.id}
                            to={tab.href}
                            className={`shrink-0 border-b px-1 py-2.5 text-xs font-semibold uppercase tracking-wider ${kind === tab.id ? 'border-gold-400 text-gold-200' : 'border-transparent text-cream/50 hover:text-cream'}`}
                        >
                            {tab.label}
                        </Link>
                    ))}
                </div>

                <header className="mb-12 border-y border-line py-9 sm:py-12">
                    <div className="max-w-3xl">
                        <span className="eyebrow">{page.eyebrow}</span>
                        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-cream sm:text-6xl">
                            {page.title}
                        </h1>
                        <p className="mt-4 text-sm sm:text-base leading-relaxed text-cream/70">
                            {page.intro}
                        </p>
                    </div>
                </header>

                {/* Main Content Area */}
                {kind === 'faq' ? (
                    /* Interactive Accordion FAQ Section with Rich AEO Structure */
                    <div className="space-y-4 max-w-4xl mx-auto">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="font-display text-3xl font-semibold text-cream">Common questions</h2>
                            <span className="text-xs text-cream/50">Select a question to read the answer</span>
                        </div>

                        {page.sections.map((item, idx) => {
                            const isOpen = openFaq === idx;
                            return (
                                <article
                                    key={idx}
                                    className="rounded-sm border border-gold-500/20 bg-carbon overflow-hidden transition"
                                >
                                    <button
                                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                                        className="flex w-full items-center justify-between p-6 text-left hover:bg-gold-400/5 transition"
                                    >
                                        <h3 className="font-display text-lg font-bold text-cream pr-4 flex items-center gap-3">
                                            <span className="text-gold-400 text-sm">Q{idx + 1}.</span> {item.title}
                                        </h3>
                                        <IconChevronDown
                                            size={18}
                                            className={`shrink-0 text-gold-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>

                                    {isOpen && (
                                        <div className="border-t border-gold-500/15 bg-obsidian/70 p-6 text-sm leading-relaxed text-cream/75">
                                            {item.body}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                ) : kind === 'contact' ? (
                    /* Split Contact Form & Concierge Information */
                    <div className="grid gap-8 lg:grid-cols-12">
                        <div className="lg:col-span-7 rounded-sm border border-gold-500/20 bg-carbon p-8 shadow-md">
                            <h2 className="mb-2 font-display text-3xl font-semibold text-cream">Send a message</h2>
                            <p className="mb-6 text-xs text-cream/60">Our care team typically replies within one business day.</p>

                            {contactSent && (
                                <div className="mb-6 flex items-center gap-2 rounded-sm border border-emerald-500/30 bg-emerald-950/30 p-4 text-xs text-emerald-300 font-semibold">
                                    <IconCheckCircle size={18} color="#10B981" /> Your email draft is ready. Review it in your mail app and press send.
                                </div>
                            )}

                            <form onSubmit={handleContactSubmit} className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <label className="block">
                                        <span className="mb-1.5 block text-xs font-semibold text-cream/70">Your Name</span>
                                        <input
                                            type="text"
                                            value={contactForm.name}
                                            onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                                            required
                                            placeholder="Aarav Sharma"
                                            className="h-11 w-full rounded-sm border border-gold-500/25 bg-obsidian px-4 text-xs text-cream outline-none focus:border-gold-400"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-1.5 block text-xs font-semibold text-cream/70">Email Address</span>
                                        <input
                                            type="email"
                                            value={contactForm.email}
                                            onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                                            required
                                            placeholder="aarav@example.com"
                                            className="h-11 w-full rounded-sm border border-gold-500/25 bg-obsidian px-4 text-xs text-cream outline-none focus:border-gold-400"
                                        />
                                    </label>
                                </div>

                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold text-cream/70">Order Reference (Optional)</span>
                                    <input
                                        type="text"
                                        value={contactForm.orderRef}
                                        onChange={(e) => setContactForm({ ...contactForm, orderRef: e.target.value })}
                                        placeholder="e.g. GHC-10042"
                                        className="h-11 w-full rounded-sm border border-gold-500/25 bg-obsidian px-4 text-xs text-cream outline-none focus:border-gold-400"
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold text-cream/70">How can we assist you?</span>
                                    <textarea
                                        rows={4}
                                        value={contactForm.message}
                                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                                        required
                                        placeholder="Tell us about product inquiry, order status, or custom gifting..."
                                        className="w-full rounded-sm border border-gold-500/25 bg-obsidian p-4 text-xs text-cream outline-none focus:border-gold-400"
                                    />
                                </label>

                                <button
                                    type="submit"
                                    className="h-12 w-full bg-gold-400 text-xs font-bold uppercase tracking-[0.2em] text-obsidian hover:bg-gold-300 rounded-sm shadow-md transition"
                                >
                                    Send Message
                                </button>
                            </form>
                        </div>

                        {/* Contact Information Sidebar */}
                        <div className="lg:col-span-5 space-y-4">
                            {page.sections.map((sec, idx) => (
                                <article key={idx} className="rounded-sm border border-gold-500/20 bg-carbon p-6">
                                    <h3 className="font-display text-lg font-bold text-gold-300">{sec.title}</h3>
                                    <p className="mt-2 text-xs leading-relaxed text-cream/70">{sec.body}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Standard Cards Grid View */
                    <div className="grid gap-6 md:grid-cols-2">
                        {page.sections.map((section) => (
                            <article
                                key={section.title}
                                className="rounded-sm border border-gold-500/20 bg-carbon p-8 hover:border-gold-400/40 transition shadow-md flex flex-col justify-between"
                            >
                                <div>
                                    <h2 className="font-display text-2xl font-bold text-gold-300">{section.title}</h2>
                                    <p className="mt-4 text-xs leading-relaxed text-cream/70">{section.body}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {/* EEAT Trust Badges Strip */}
                <div className="mt-16 grid grid-cols-2 gap-4 border-t border-gold-500/20 pt-10 sm:grid-cols-4">
                    <div className="flex items-center gap-3 rounded-sm border border-gold-500/15 bg-carbon p-4">
                        <IconBadgeCheck size={24} className="text-gold-400 shrink-0" />
                        <div>
                                    <strong className="block text-xs font-bold text-cream">Clear material details</strong>
                                    <span className="text-[10px] text-cream/50">Listed on every product</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-sm border border-gold-500/15 bg-carbon p-4">
                        <IconTruck size={24} className="text-gold-400 shrink-0" />
                        <div>
                            <strong className="block text-xs font-bold text-cream">Insured Shipping</strong>
                            <span className="text-[10px] text-cream/50">All-India Delivery</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-sm border border-gold-500/15 bg-carbon p-4">
                        <IconShieldCheck size={24} className="text-gold-400 shrink-0" />
                        <div>
                            <strong className="block text-xs font-bold text-cream">30-Day Guarantee</strong>
                            <span className="text-[10px] text-cream/50">Hassle-Free Returns</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-sm border border-gold-500/15 bg-carbon p-4">
                        <IconMessageCircle size={24} className="text-gold-400 shrink-0" />
                        <div>
                            <strong className="block text-xs font-bold text-cream">Human care team</strong>
                            <span className="text-[10px] text-cream/50">Mon–Sat 10:00–18:00</span>
                        </div>
                    </div>
                </div>

                {/* Quick Navigation Footer */}
                <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-gold-500/15 pt-6 text-xs uppercase tracking-wider">
                    <Link to="/" className="inline-flex items-center gap-1.5 text-gold-300 hover:text-gold-200 font-semibold">
                        Return to Storefront <IconArrowRight size={14} />
                    </Link>
                    {kind !== 'contact' && (
                        <Link to="/contact" className="text-cream/50 hover:text-gold-300 transition">
                            Need help? Contact customer care
                        </Link>
                    )}
                </div>
            </main>

            <StoreFooter />
        </div>
    );
};

export default InfoPage;
