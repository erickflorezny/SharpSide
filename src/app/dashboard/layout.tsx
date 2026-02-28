import { SidebarProvider } from '@/components/ui/sidebar';
import { SystemFilter } from '@/components/dashboard/SystemFilter';
import { ParlayProvider } from '@/components/parlay/ParlayContext';
import { ParlaySlip } from '@/components/parlay/ParlaySlip';
import { Suspense } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <ParlayProvider>
            <SidebarProvider>
                <div className="flex min-h-screen w-full bg-[#0a0a0b] text-zinc-100 selection:bg-primary/30">
                    <Suspense fallback={<div className="w-64 border-r border-border/50 bg-background/50 p-4">Loading system definitions...</div>}>
                        <SystemFilter />
                    </Suspense>
                    <main className="flex-1 overflow-auto bg-gradient-to-b from-[#0a0a0b] to-[#040405]">
                        {children}
                    </main>
                </div>
                <ParlaySlip />
            </SidebarProvider>
        </ParlayProvider>
    );
}
