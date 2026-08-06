import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
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
        eyebrow: 'Vengara, Malappuram',
        title: 'Crockery and kitchenware for every home.',
        metaTitle: 'About Glockery Home Centre Vengara',
        metaDesc: 'Visit Glockery Home Centre near ICICI Bank in Vengara, Malappuram for crockery, kitchenware and home essentials.',
        intro: 'Glockery Home Centre is a crockery and kitchenware shop in Vengara, Malappuram. Shop in store or contact us for product and order support.',
        sections: [
            {
                title: 'Visit our Vengara store',
                body: 'Find us at Home Centre, near ICICI Bank, Vengara, Malappuram, Kerala 676304.',
            },
            {
                title: 'What you will find',
                body: 'Our collections include dinner sets, tea sets and cups, serving dishes, canister sets, trays, oil and vinegar sets, cutlery and other kitchen essentials.',
            },
            {
                title: 'Order support',
                body: 'Contact us on WhatsApp to confirm current stock, product details, and any help you need before placing an order.',
            },
            {
                title: 'Call or WhatsApp',
                body: 'Call 8138 003 232 or WhatsApp 6282 000 289 for product enquiries and orders.',
            },
        ],
    },
    shipping: {
        eyebrow: 'Order information',
        title: 'Order and return help from Glockery.',
        metaTitle: 'Order & Return Information | Glockery Home Centre Vengara',
        metaDesc: 'Read order and return-help information for Glockery Home Centre, Vengara.',
        intro: 'Use this page for help with an order, a product enquiry, or a return request.',
        sections: [
            {
                title: 'Before you order',
                body: 'Send us the product name or photo on WhatsApp. We will help confirm current stock and product details.',
            },
            {
                title: 'Order updates',
                body: 'For help with an existing order, contact 8138 003 232 or WhatsApp 6282 000 289 with your order number.',
            },
            {
                title: 'Shop in person',
                body: 'You can browse the collections at Glockery Home Centre, near ICICI Bank in Vengara, Malappuram.',
            },
            {
                title: 'Returns or damaged items',
                body: 'Please confirm the current return terms before ordering. If an item arrives damaged, contact us promptly with the order details and clear photos of the item and packaging.',
            },
        ],
    },
    faq: {
        eyebrow: 'Quick answers',
        title: 'Frequently asked questions',
        metaTitle: 'Frequently Asked Questions | Glockery Home Centre Vengara',
        metaDesc: 'Find Glockery Home Centre Vengara location, contact and order information.',
        intro: 'Useful information about visiting the shop, browsing products and placing an order.',
        sections: [
            {
                title: 'Where is Glockery Home Centre?',
                body: 'The shop is at Home Centre, near ICICI Bank, Vengara, Malappuram, Kerala 676304.',
            },
            {
                title: 'What products do you sell?',
                body: 'The range includes dinner sets, tea sets, cups, serving dishes, canisters, trays, oil and vinegar sets, cutlery and other crockery and kitchenware.',
            },
            {
                title: 'How do I get help with an order?',
                body: 'Contact us with your order number on WhatsApp or by phone. We can help with payment, product, and return queries.',
            },
            {
                title: 'How can I contact the shop?',
                body: 'Call 8138 003 232 or WhatsApp 6282 000 289. You can also follow @glockery_home_centre on Instagram for product updates.',
            },
        ],
    },
    contact: {
        eyebrow: 'Call, WhatsApp or visit',
        title: 'Contact Glockery Home Centre',
        metaTitle: 'Contact Glockery Home Centre Vengara',
        metaDesc: 'Call, WhatsApp or visit Glockery Home Centre near ICICI Bank in Vengara, Malappuram.',
        intro: 'Ask about products, stock or an existing order. Send us a WhatsApp message or visit the Vengara store.',
        sections: [
            {
                title: 'Call',
                body: '8138 003 232',
            },
            {
                title: 'WhatsApp',
                body: '6282 000 289',
            },
            {
                title: 'Visit the shop',
                body: 'Home Centre, near ICICI Bank, Vengara, Malappuram, Kerala 676304.',
            },
        ],
    },
    privacy: {
        eyebrow: 'Website information',
        title: 'Privacy policy',
        metaTitle: 'Privacy Policy | Glockery Home Centre',
        metaDesc: 'How Glockery Home Centre uses information supplied through customer accounts and online orders.',
        intro: 'This website uses the information you provide to manage your account and process orders.',
        sections: [
            {
                title: 'Information We Collect',
                body: 'The website collects details such as your name, contact address, email address and phone number when needed for accounts and orders.',
            },
            {
                title: 'Payments',
                body: 'Online payments are completed through Razorpay. Glockery does not ask you to enter card or UPI credentials directly into this website.',
            },
            {
                title: 'Service providers',
                body: 'Order information may be shared with the services needed to complete payment. Contact the shop if you have a question about your information.',
            },
        ],
    },
    terms: {
        eyebrow: 'Online orders',
        title: 'Terms and conditions',
        metaTitle: 'Terms & Conditions | Glockery Home Centre',
        metaDesc: 'Review terms of service, payment policies, pricing transparency, and order terms for Glockery Home Centre.',
        intro: 'Important information about product availability, pricing and online orders.',
        sections: [
            {
                title: 'Order Acceptance & Availability',
                body: 'An online order is accepted after payment is verified and the product is confirmed as available. If an ordered product is unavailable, the shop will contact you about the available resolution.',
            },
            {
                title: 'Pricing & Taxes',
                body: 'Prices are displayed in Indian rupees. Any discount applied by the online checkout is shown before payment.',
            },
            {
                title: 'Questions before ordering',
                body: 'Product colours and details can vary between screens and batches. Contact Glockery on WhatsApp if you need to confirm a product detail before ordering.',
            },
        ],
    },
};

export const InfoPage = ({ kind = 'about' }: { kind?: InfoPageKind }) => {
    const page = pageContent[kind];
    const [contactForm, setContactForm] = useState({ name: '', phone: '', message: '', orderRef: '' });
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
                '@type': 'HomeGoodsStore',
                name: 'Glockery Home Centre',
                telephone: '+91 6282000289',
                address: {
                    '@type': 'PostalAddress',
                    streetAddress: 'Home Centre, Near ICICI Bank',
                    addressLocality: 'Vengara',
                    addressRegion: 'Kerala',
                    postalCode: '676304',
                    addressCountry: 'IN',
                },
                sameAs: ['https://www.instagram.com/glockery_home_centre/'],
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
            name: 'Contact Glockery Home Centre',
            description: page.metaDesc,
            mainEntity: {
                '@type': 'HomeGoodsStore',
                name: 'Glockery Home Centre',
                telephone: ['+91 8138003232', '+91 6282000289'],
                address: {
                    '@type': 'PostalAddress',
                    streetAddress: 'Home Centre, Near ICICI Bank',
                    addressLocality: 'Vengara',
                    addressRegion: 'Kerala',
                    postalCode: '676304',
                    addressCountry: 'IN',
                },
            },
        };
    }

    const handleContactSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const subject = contactForm.orderRef ? `Order help: ${contactForm.orderRef}` : 'Product enquiry';
        const body = `${subject}\n\n${contactForm.message}\n\nName: ${contactForm.name}\nPhone: ${contactForm.phone}${contactForm.orderRef ? `\nOrder: ${contactForm.orderRef}` : ''}`;
        window.location.href = `https://wa.me/916282000289?text=${encodeURIComponent(body)}`;
        setContactSent(true);
        setTimeout(() => setContactSent(false), 6000);
    };

    const tabs: Array<{ id: InfoPageKind; label: string; href: string }> = [
        { id: 'about', label: 'About', href: '/about' },
        { id: 'shipping', label: 'Orders & returns', href: '/shipping-returns' },
        { id: 'faq', label: 'FAQ', href: '/faq' },
        { id: 'contact', label: 'Contact', href: '/contact' },
        { id: 'privacy', label: 'Privacy', href: '/privacy' },
        { id: 'terms', label: 'Terms', href: '/terms' },
    ];

    return (
        <div className="flex min-h-screen flex-col bg-obsidian font-body text-cream">
            <SEOHead title={page.metaTitle} description={page.metaDesc} structuredData={structuredData} />
            <Header />

            <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 px-5 py-10 sm:px-8 lg:py-16">
                <nav className="flex gap-6 overflow-x-auto border-b border-line" aria-label="Information pages">
                    {tabs.map((tab) => (
                        <Link key={tab.id} to={tab.href} className={`min-h-11 shrink-0 border-b py-3 text-sm ${kind === tab.id ? 'border-gold-400 text-cream' : 'border-transparent text-cream/60 hover:text-cream'}`}>
                            {tab.label}
                        </Link>
                    ))}
                </nav>

                <header className="py-12 sm:py-16">
                    <p className="text-sm text-cream/60">{page.eyebrow}</p>
                    <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-[-0.02em] sm:text-6xl">{page.title}</h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-cream/70">{page.intro}</p>
                </header>

                {kind === 'faq' ? (
                    <section className="divide-y divide-line border-y border-line">
                        {page.sections.map((item, index) => (
                            <details key={item.title} className="group" open={index === 0}>
                                <summary className="flex min-h-16 cursor-pointer items-center justify-between py-4 text-base font-semibold text-cream marker:hidden">
                                    {item.title}<span className="ml-4 text-xl font-normal text-cream/50 group-open:rotate-45">+</span>
                                </summary>
                                <p className="max-w-2xl pb-6 text-sm leading-7 text-cream/70">{item.body}</p>
                            </details>
                        ))}
                    </section>
                ) : kind === 'contact' ? (
                    <div className="grid gap-12 lg:grid-cols-[1fr_0.7fr]">
                        <form onSubmit={handleContactSubmit} className="space-y-5">
                            <h2 className="font-display text-3xl font-semibold">Message us on WhatsApp</h2>
                            {contactSent && <p className="border border-line p-3 text-sm" role="status">Opening WhatsApp with your message.</p>}
                            <label className="block"><span className="mb-2 block text-sm">Name</span><input type="text" value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} required className="field w-full text-sm" /></label>
                            <label className="block"><span className="mb-2 block text-sm">Phone number</span><input type="tel" value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} autoComplete="tel" required className="field w-full text-sm" /></label>
                            <label className="block"><span className="mb-2 block text-sm">Order number <span className="text-cream/60">(optional)</span></span><input type="text" value={contactForm.orderRef} onChange={(event) => setContactForm({ ...contactForm, orderRef: event.target.value })} className="field w-full text-sm" /></label>
                            <label className="block"><span className="mb-2 block text-sm">Message</span><textarea rows={5} value={contactForm.message} onChange={(event) => setContactForm({ ...contactForm, message: event.target.value })} required className="field w-full text-sm" /></label>
                            <button type="submit" className="button-primary">Continue to WhatsApp</button>
                        </form>
                        <div className="divide-y divide-line border-y border-line">
                            {page.sections.map((section) => (
                                <section key={section.title} className="py-5">
                                    <h2 className="font-semibold text-cream">{section.title}</h2>
                                    <p className="mt-2 text-sm leading-6 text-cream/70">{section.body}</p>
                                </section>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-line border-y border-line">
                        {page.sections.map((section) => (
                            <section key={section.title} className="py-7">
                                <h2 className="font-display text-2xl font-semibold text-cream">{section.title}</h2>
                                <p className="mt-3 max-w-2xl text-sm leading-7 text-cream/70">{section.body}</p>
                            </section>
                        ))}
                    </div>
                )}

                {kind !== 'contact' && <Link to="/contact" className="mt-10 inline-flex min-h-11 items-center text-sm font-semibold text-gold-300">Need help? Contact us</Link>}
            </main>

            <StoreFooter />
        </div>
    );
};

export default InfoPage;
