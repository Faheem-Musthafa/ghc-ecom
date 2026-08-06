import React, { useEffect, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from './Icons';

const reels = [
    { id: 'DbV_ImFhi6Z', title: 'Oil and vinegar sets from Glockery Home Centre' },
    { id: 'DMSUR3NynaE', title: 'Serving dishes at Glockery Home Centre' },
    { id: 'DbK1TnxoOUz', title: 'Soup bowl collection at Glockery Home Centre' },
    { id: 'DbJEvWFuhEL', title: 'Tea cup collection at Glockery Home Centre' },
    { id: 'DUCrSBiEp4a', title: 'Restocked trays at Glockery Home Centre' },
];

const ReelEmbed = ({ reel }: { reel: typeof reels[number] }) => {
    const cardRef = useRef<HTMLElement>(null);
    const [shouldLoad, setShouldLoad] = useState(false);

    useEffect(() => {
        const card = cardRef.current;
        if (!card || typeof IntersectionObserver === 'undefined') {
            setShouldLoad(true);
            return;
        }
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            setShouldLoad(true);
            observer.disconnect();
        }, { rootMargin: '240px' });
        observer.observe(card);
        return () => observer.disconnect();
    }, []);

    return (
        <article ref={cardRef} className="w-[82vw] max-w-[320px] shrink-0 snap-start bg-black">
            <div className="relative aspect-[4/5] overflow-hidden bg-black">
                {shouldLoad && (
                    <iframe
                        src={`https://www.instagram.com/reel/${reel.id}/embed/`}
                        title={reel.title}
                        loading="lazy"
                        scrolling="no"
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                        allowFullScreen
                        className="absolute -left-3 -top-[50px] h-[660px] w-[calc(100%+24px)] border-0 sm:-top-[52px]"
                    />
                )}
            </div>
        </article>
    );
};

const InstagramReels = () => {
    const trackRef = useRef<HTMLDivElement>(null);

    const move = (direction: -1 | 1) => {
        const track = trackRef.current;
        if (!track) return;
        track.scrollBy({ left: direction * Math.min(track.clientWidth * 0.85, 700), behavior: 'smooth' });
    };

    return (
        <section id="instagram" className="border-y border-line bg-carbon py-14 lg:py-20" aria-labelledby="reels-heading">
            <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
                <header className="mb-8 flex items-end justify-between gap-6">
                    <h2 id="reels-heading" className="font-display text-4xl font-semibold tracking-[-0.02em] text-cream sm:text-5xl">See what’s new in store</h2>
                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        <button onClick={() => move(-1)} className="grid size-11 place-items-center border border-line text-cream/70 hover:border-gold-400 hover:text-cream" aria-label="Show previous Instagram reels">
                            <IconChevronLeft size={18} />
                        </button>
                        <button onClick={() => move(1)} className="grid size-11 place-items-center border border-line text-cream/70 hover:border-gold-400 hover:text-cream" aria-label="Show more Instagram reels">
                            <IconChevronRight size={18} />
                        </button>
                    </div>
                </header>

                <div ref={trackRef} className="reel-track flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 sm:gap-5">
                    {reels.map((reel) => <ReelEmbed key={reel.id} reel={reel} />)}
                </div>
            </div>
        </section>
    );
};

export default InstagramReels;
