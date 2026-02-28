'use client';

import { useParlay, ParlayLeg } from '@/components/parlay/ParlayContext';
import { Plus, Check } from 'lucide-react';

interface AddToParlayButtonProps {
    leg: ParlayLeg;
}

export function AddToParlayButton({ leg }: AddToParlayButtonProps) {
    const { addLeg, isInParlay, removeLeg } = useParlay();
    const added = isInParlay(leg.gameId);

    return (
        <button
            onClick={() => added ? removeLeg(leg.gameId) : addLeg(leg)}
            className={`shrink-0 rounded-full p-1.5 transition-all ${added
                    ? 'bg-emerald-500 text-black hover:bg-rose-500 hover:text-white'
                    : 'bg-zinc-800 text-muted-foreground hover:bg-emerald-500/20 hover:text-emerald-400'
                }`}
            title={added ? 'Remove from parlay' : 'Add to parlay'}
        >
            {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
    );
}
