import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Users, BookOpen, AlertTriangle } from "lucide-react";

export default function AboutPage() {
    return (
        <div className="flex-1 w-full flex flex-col items-center justify-start p-4 md:p-8 lg:p-12 overflow-y-auto">
            <div className="w-full max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <BookOpen className="h-8 w-8 text-primary" />
                        How SharpSide Works
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Understanding Reverse Line Movement and &quot;Sharp&quot; Betting Action
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-zinc-900/40 border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-rose-400" />
                                The &quot;Public&quot; Side
                            </CardTitle>
                            <CardDescription>How the average bettor wagers</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm leading-relaxed text-muted-foreground space-y-4">
                            <p>
                                The &quot;Public&quot; refers to the vast majority of recreational sports bettors. The public typically bets on favorites, historically successful teams, and home teams.
                            </p>
                            <p>
                                When the public heavily bets on a single team, sportsbooks normally adjust the line (the point spread) to encourage betting on the <em>other</em> team to balance their risk. For example, if the public hammers a -7 favorite, the sportsbook might move the line to -8 or -9.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-emerald-900/10 border-emerald-500/20 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl pointer-events-none"></div>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-emerald-400">
                                <TrendingDown className="h-5 w-5" />
                                The &quot;Sharp&quot; Side
                            </CardTitle>
                            <CardDescription>Professional betting syndicates</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm leading-relaxed text-muted-foreground space-y-4">
                            <p>
                                &quot;Sharps&quot; are professional bettors, syndicates, and algorithmic traders who wager massive amounts of money. While the public represents the majority of <em>tickets</em> (number of bets), sharps represent the majority of the <em>money</em>.
                            </p>
                            <p>
                                Because sportsbooks care about balancing <strong>money</strong>, not tickets, a large bet from a sharp syndicate will cause the sportsbook to adjust the line, regardless of what the public is doing.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-border/50 bg-background shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-xl">What is Reverse Line Movement (RLM)?</CardTitle>
                        <CardDescription>
                            The core signal powering the SharpSide dashboard.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                        <p>
                            <strong>Reverse Line Movement (RLM)</strong> occurs when the majority of betting tickets are on one team, but the betting line moves in the <em>opposite</em> direction.
                        </p>

                        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-3">
                            <div className="flex items-center gap-2 text-foreground font-medium mb-1">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                Example Scenario
                            </div>
                            <ol className="list-decimal list-inside space-y-2 ml-2">
                                <li><strong>Opening Line:</strong> Team A opens as a <Badge variant="outline" className="ml-1">-7.0</Badge> favorite.</li>
                                <li><strong>Public Action:</strong> 80% of the public sees Team A is great and bets on them to cover the -7.0 spread.</li>
                                <li><strong>Expected Result:</strong> The sportsbook moves the line to -8.0 to deter more bets on Team A.</li>
                                <li><strong>The Sharp Signal:</strong> Instead, the sportsbook moves the line to <Badge className="bg-emerald-500/20 text-emerald-400 ml-1">-6.0</Badge>.</li>
                            </ol>
                            <p className="pt-2 text-emerald-400/90 font-medium border-t border-zinc-800 mt-4">
                                Why did the line drop to -6.0 when everyone is betting on Team A?
                            </p>
                            <p className="text-muted-foreground">
                                Because a Sharp betting syndicate just dropped $100,000 on Team B (+7.0). The sportsbook respects the Sharp money highly, so they adjust the line to -6.0 to attract money back onto Team A to balance their liability.
                            </p>
                        </div>

                        <p>
                            <strong>SharpSide automates this detection.</strong> By capturing the opening line directly from The Odds API and measuring real-time fluctuations against perceived generic public trends, SharpSide highlights games where the line has moved significantly ({">"} 1.0 point) against standard public logic.
                        </p>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
