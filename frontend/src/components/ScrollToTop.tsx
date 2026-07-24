import React, { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop: React.FC = () => {
    const { pathname, search, hash } = useLocation();

    useLayoutEffect(() => {
        const scrollingElement = document.scrollingElement || document.documentElement;
        if (hash) {
            const target = document.getElementById(hash.slice(1));
            if (target) {
                window.requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
                return;
            }
        }
        scrollingElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
    }, [pathname, search, hash]);

    return null;
};

export default ScrollToTop;
