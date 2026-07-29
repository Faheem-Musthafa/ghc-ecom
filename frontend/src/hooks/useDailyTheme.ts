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
import heroCutleryGold from '../img/hero-cutlery-gold.png';
import heroJugSet from '../img/hero-jug-set.png';
import heroCupSaucer from '../img/hero-cup-saucer.png';
import heroKettleDark from '../img/hero-kettle-dark.png';
import heroCanisterDark from '../img/hero-canister-dark.png';
import heroNutsTray from '../img/hero-nuts-tray.png';

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

const themes: DailyTheme[] = [
    {
        hero: heroCutleryGold,
        heroAlt: 'Gold cutlery set in velvet case on dark obsidian marble',
        story: heroJugSet,
        storyAlt: 'Ceramic tea set with gold rim accents',
        detail: heroCupSaucer,
        detailAlt: 'Black marble cups with gold veining on walnut board',
        tagline: 'Set the table.',
        subtitle: 'Own the room.',
    },
    {
        hero: heroKettleDark,
        heroAlt: 'Borosilicate glass kettle with walnut handle in candlelight',
        story: heroCanisterDark,
        storyAlt: 'Ceramic canisters with bamboo lids on dark marble',
        detail: heroNutsTray,
        detailAlt: 'Leaf-shaped serving tray surrounded by golden candlelight',
        tagline: 'Craft the moment.',
        subtitle: 'Elevate every detail.',
    },
    {
        hero: heroJugSet,
        heroAlt: 'Ceramic tea set with gold rim accents',
        story: heroCutleryGold,
        storyAlt: 'Gold cutlery set in velvet case on dark obsidian marble',
        detail: heroKettleDark,
        detailAlt: 'Borosilicate glass kettle with walnut handle in candlelight',
        tagline: 'Pour with intention.',
        subtitle: 'Gather with grace.',
    },
    {
        hero: heroCupSaucer,
        heroAlt: 'Black marble cups with gold veining on walnut board',
        story: heroNutsTray,
        storyAlt: 'Leaf-shaped serving tray surrounded by golden candlelight',
        detail: heroCutleryGold,
        detailAlt: 'Gold cutlery set in velvet case on dark obsidian marble',
        tagline: 'Morning ritual.',
        subtitle: 'Evening ceremony.',
    },
    {
        hero: heroCanisterDark,
        heroAlt: 'Ceramic canisters with bamboo lids on dark marble',
        story: heroKettleDark,
        storyAlt: 'Borosilicate glass kettle with walnut handle in candlelight',
        detail: heroJugSet,
        detailAlt: 'Ceramic tea set with gold rim accents',
        tagline: 'Store the essential.',
        subtitle: 'Serve the remarkable.',
    },
    {
        hero: heroNutsTray,
        heroAlt: 'Leaf-shaped serving tray surrounded by golden candlelight',
        story: heroCupSaucer,
        storyAlt: 'Black marble cups with gold veining on walnut board',
        detail: heroCanisterDark,
        detailAlt: 'Ceramic canisters with bamboo lids on dark marble',
        tagline: 'Host beautifully.',
        subtitle: 'Leave nothing ordinary.',
    },
];

/** Returns the day-of-year (0–365). */
const dayOfYear = (d: Date): number => {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    return Math.floor(diff / 86_400_000);
};

/** Pick the theme for today using a deterministic day-of-year rotation. */
export const useDailyTheme = (): DailyTheme => {
    const index = dayOfYear(new Date()) % themes.length;
    return themes[index];
};

export default useDailyTheme;
