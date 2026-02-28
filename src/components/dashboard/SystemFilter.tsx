'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader } from '@/components/ui/sidebar';
import { Target, Trophy, Flame, BookOpen, Zap } from 'lucide-react';

export function SystemFilter() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const DASHBOARD_PATH = '/dashboard';

    const isOnDashboard = pathname === DASHBOARD_PATH;
    const isTop25 = searchParams.get('top25') === 'true';
    const isHomeFavs = searchParams.get('homeFavs') === 'true';
    const isStrong = searchParams.get('strong') === 'true';

    const toggleFilter = (key: string, currentValue: boolean) => {
        const params = new URLSearchParams(searchParams);
        if (currentValue) {
            params.delete(key);
        } else {
            params.set(key, 'true');
        }
        const qs = params.toString();
        router.push(qs ? `${DASHBOARD_PATH}?${qs}` : DASHBOARD_PATH);
    };

    return (
        <Sidebar variant="sidebar" className="border-r border-border/50 bg-background/50 backdrop-blur-xl">
            <SidebarHeader className="border-b border-border/50 p-4">
                <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
                    <Target className="h-5 w-5 text-primary" />
                    <span>SharpSide</span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-4 mt-4">System Filters</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className="px-2 mt-2 gap-1">
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={isOnDashboard && !isTop25 && !isHomeFavs && !isStrong}
                                    onClick={() => router.push(DASHBOARD_PATH)}
                                    className="w-full justify-start text-sm font-medium"
                                >
                                    <Flame className="h-4 w-4 mr-2" />
                                    All Sharp Actions
                                </SidebarMenuButton>
                                <p className="text-[10px] text-muted-foreground/60 px-8 pb-1 leading-tight">Every game with reverse line movement</p>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={isOnDashboard && isStrong}
                                    onClick={() => toggleFilter('strong', isStrong)}
                                    className="w-full justify-start text-sm font-medium text-amber-400 hover:text-amber-300"
                                >
                                    <Zap className="h-4 w-4 mr-2 fill-current" />
                                    Strong Bets
                                </SidebarMenuButton>
                                <p className="text-[10px] text-muted-foreground/60 px-8 pb-1 leading-tight text-amber-500/60">High-confidence signals based on historical patterns</p>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={isOnDashboard && isTop25}
                                    onClick={() => toggleFilter('top25', isTop25)}
                                    className="w-full justify-start text-sm font-medium"
                                >
                                    <Trophy className="h-4 w-4 mr-2" />
                                    Top 25 Matchups
                                </SidebarMenuButton>
                                <p className="text-[10px] text-muted-foreground/60 px-8 pb-1 leading-tight">Only games involving AP Top 25 teams</p>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={isOnDashboard && isHomeFavs}
                                    onClick={() => toggleFilter('homeFavs', isHomeFavs)}
                                    className="w-full justify-start text-sm font-medium"
                                >
                                    <Target className="h-4 w-4 mr-2" />
                                    Home Favorites
                                </SidebarMenuButton>
                                <p className="text-[10px] text-muted-foreground/60 px-8 pb-1 leading-tight">Fade home favorites — sharps typically back the visiting underdog</p>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup className="mt-8">
                    <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-4">Resources</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className="px-2 mt-2 gap-1">
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    isActive={pathname === '/dashboard/about'}
                                    onClick={() => router.push('/dashboard/about')}
                                    className="w-full justify-start text-sm font-medium text-emerald-400 hover:text-emerald-300"
                                >
                                    <BookOpen className="h-4 w-4 mr-2" />
                                    How it Works
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}
