'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface ParlayLeg {
    gameId: string;
    teamName: string;
    betType: 'ML' | 'Spread';
    line: string;        // e.g. "+4.5" or "-110"
    odds: number;        // American odds, e.g. -110, +150
    matchup: string;     // e.g. "Liberty Flames @ Jacksonville St Gamecocks"
    insights?: string[]; // Contextual game insights
}

interface ParlayContextType {
    legs: ParlayLeg[];
    addLeg: (leg: ParlayLeg) => void;
    removeLeg: (gameId: string) => void;
    clearParlay: () => void;
    isInParlay: (gameId: string) => boolean;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    parlayOdds: number;
    parlayPayout: (wager: number) => number;
}

const ParlayContext = createContext<ParlayContextType | null>(null);

/**
 * Convert American odds to decimal odds.
 * -110 → 1.909, +150 → 2.50
 */
function americanToDecimal(american: number): number {
    if (american > 0) {
        return (american / 100) + 1;
    } else {
        return (100 / Math.abs(american)) + 1;
    }
}

/**
 * Convert decimal odds back to American odds.
 */
function decimalToAmerican(decimal: number): number {
    if (decimal >= 2) {
        return Math.round((decimal - 1) * 100);
    } else {
        return Math.round(-100 / (decimal - 1));
    }
}

export function ParlayProvider({ children }: { children: ReactNode }) {
    const [legs, setLegs] = useState<ParlayLeg[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const addLeg = useCallback((leg: ParlayLeg) => {
        setLegs(prev => {
            // Replace if same game, otherwise add
            const filtered = prev.filter(l => l.gameId !== leg.gameId);
            return [...filtered, leg];
        });
        setIsOpen(true);
    }, []);

    const removeLeg = useCallback((gameId: string) => {
        setLegs(prev => prev.filter(l => l.gameId !== gameId));
    }, []);

    const clearParlay = useCallback(() => {
        setLegs([]);
    }, []);

    const isInParlay = useCallback((gameId: string) => {
        return legs.some(l => l.gameId === gameId);
    }, [legs]);

    // Calculate combined parlay odds (multiply decimal odds)
    const combinedDecimal = legs.reduce((acc, leg) => acc * americanToDecimal(leg.odds), 1);
    const parlayOdds = legs.length > 0 ? decimalToAmerican(combinedDecimal) : 0;

    const parlayPayout = useCallback((wager: number) => {
        return Math.round((wager * combinedDecimal) * 100) / 100;
    }, [combinedDecimal]);

    return (
        <ParlayContext.Provider value={{ legs, addLeg, removeLeg, clearParlay, isInParlay, isOpen, setIsOpen, parlayOdds, parlayPayout }}>
            {children}
        </ParlayContext.Provider>
    );
}

export function useParlay() {
    const ctx = useContext(ParlayContext);
    if (!ctx) throw new Error('useParlay must be used within ParlayProvider');
    return ctx;
}
