/**
 * useDailyRotation — rotates through a set of themed hero/story/detail image
 * combinations every 24 hours based on the current day-of-year.
 *
 * Each "theme" contains three images:
 *   hero   — full-bleed background for the hero section
 *   story  — left-column image for the "Material drama" section
 *   detail — background texture for the closing CTA section
 *
 * The rotation is deterministic: every visitor sees the same theme on the same
 * calendar day, and it automatically advances at midnight local time.
 */

// Product photography for the daily editorial rotation.
import heroCutleryGold from '../img/hero-cutlery-gold.webp';
import heroJugSet from '../img/hero-jug-set.webp';
import heroCupSaucer from '../img/hero-cup-saucer.webp';
import heroKettleDark from '../img/hero-kettle-dark.webp';
import heroCanisterDark from '../img/hero-canister-dark.webp';
import heroNutsTray from '../img/hero-nuts-tray.webp';

export interface DailyTheme {
    hero: string;
    heroAlt: string;
    story: string;
    storyAlt: string;
    detail: string;
    detailAlt: string;
    tagline: string;
    subtitle: string;
}

const imageSrc = (image: string | { src: string }): string =>
    typeof image === 'string' ? image : image.src;

const themes: DailyTheme[] = [
    {
        hero: imageSrc(heroCutleryGold),
        heroAlt: 'Gold cutlery set in velvet case on dark obsidian marble',
        story: imageSrc(heroJugSet),
        storyAlt: 'Ceramic tea set with gold rim accents',
        detail: imageSrc(heroCupSaucer),
        detailAlt: 'Black marble cups with gold veining on walnut board',
        tagline: 'Set the table.',
        subtitle: 'Own the room.',
    },
    {
        hero: imageSrc(heroKettleDark),
        heroAlt: 'Borosilicate glass kettle with walnut handle in candlelight',
        story: imageSrc(heroCanisterDark),
        storyAlt: 'Ceramic canisters with bamboo lids on dark marble',
        detail: imageSrc(heroNutsTray),
        detailAlt: 'Leaf-shaped serving tray surrounded by golden candlelight',
        tagline: 'Craft the moment.',
        subtitle: 'Elevate every detail.',
    },
    {
        hero: imageSrc(heroJugSet),
        heroAlt: 'Ceramic tea set with gold rim accents',
        story: imageSrc(heroCutleryGold),
        storyAlt: 'Gold cutlery set in velvet case on dark obsidian marble',
        detail: imageSrc(heroKettleDark),
        detailAlt: 'Borosilicate glass kettle with walnut handle in candlelight',
        tagline: 'Pour with intention.',
        subtitle: 'Gather with grace.',
    },
    {
        hero: imageSrc(heroCupSaucer),
        heroAlt: 'Black marble cups with gold veining on walnut board',
        story: imageSrc(heroNutsTray),
        storyAlt: 'Leaf-shaped serving tray surrounded by golden candlelight',
        detail: imageSrc(heroCutleryGold),
        detailAlt: 'Gold cutlery set in velvet case on dark obsidian marble',
        tagline: 'Morning ritual.',
        subtitle: 'Evening ceremony.',
    },
    {
        hero: imageSrc(heroCanisterDark),
        heroAlt: 'Ceramic canisters with bamboo lids on dark marble',
        story: imageSrc(heroKettleDark),
        storyAlt: 'Borosilicate glass kettle with walnut handle in candlelight',
        detail: imageSrc(heroJugSet),
        detailAlt: 'Ceramic tea set with gold rim accents',
        tagline: 'Store the essential.',
        subtitle: 'Serve the remarkable.',
    },
    {
        hero: imageSrc(heroNutsTray),
        heroAlt: 'Leaf-shaped serving tray surrounded by golden candlelight',
        story: imageSrc(heroCupSaucer),
        storyAlt: 'Black marble cups with gold veining on walnut board',
        detail: imageSrc(heroCanisterDark),
        detailAlt: 'Ceramic canisters with bamboo lids on dark marble',
        tagline: 'Host beautifully.',
        subtitle: 'Leave nothing ordinary.',
    },
];

/** Returns the day-of-year (0–365). */
const dayOfYear = (d: Date): number => {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const diff = today - start;
    return Math.floor(diff / 86_400_000);
};

/** Pick the theme for today using a deterministic day-of-year rotation. */
export const useDailyTheme = (): DailyTheme => {
    const index = dayOfYear(new Date()) % themes.length;
    return themes[index];
};

export default useDailyTheme;
