import { getSharpSignals } from '@/actions/getSharpSignals';
import { GameCard } from '@/components/dashboard/GameCard';
import { AutoRefresh } from '@/components/dashboard/AutoRefresh';
import { AutoParlayBuilder } from '@/components/parlay/AutoParlayBuilder';
import { SidebarTrigger } from '@/components/ui/sidebar';

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolvedParams = await searchParams;
    const isTop25 = resolvedParams.top25 === 'true';
    const isHomeFavs = resolvedParams.homeFavs === 'true';
    const isStrong = resolvedParams.strong === 'true';

    const signals = await getSharpSignals({
        top25Only: isTop25,
        homeFavoritesOnly: isHomeFavs,
        strongBetsOnly: isStrong,
    });

    return (
        <div className="flex flex-col h-full w-full">
            <header className="flex items-center h-14 px-4 lg:px-6 border-b border-border/40 bg-background/50 backdrop-blur-md sticky top-0 z-10 w-full shrink-0">
                <SidebarTrigger className="mr-2" />
                <h1 className="font-semibold tracking-tight text-sm">Dashboard Overview</h1>

                <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground mr-4">
                    <span>Total Signals: <strong className="text-foreground">{signals.length}</strong></span>
                    <AutoRefresh />
                </div>
            </header>

            <main className="flex-1 p-4 lg:p-6 lg:px-8 space-y-6 overflow-auto">
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold tracking-tight">Sharp Movements</h2>
                    <p className="text-muted-foreground text-sm max-w-2xl">
                        Real-time tracking of NCAAB games experiencing reverse line movement. A &quot;Sharp&quot; signal indicates
                        the betting line is moving against heavy public sentiment, often suggesting professional action.
                    </p>
                </div>

                <AutoParlayBuilder signals={signals} />

                {signals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center border border-border/40 rounded-xl bg-muted/10 border-dashed">
                        <h3 className="text-lg font-medium text-muted-foreground">No signals found</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            No games currently match your active filters. Try adjusting the system settings.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
                        {signals.map((game) => (
                            <GameCard key={game.id} game={game} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
