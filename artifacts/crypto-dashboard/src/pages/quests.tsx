import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Trophy, Target, Star, Lock, CheckCircle2, Medal } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Quest = {
  id: string;
  name: string;
  description: string;
  target: number;
  unit: string;
  reward: number;
  current: number;
  completed: boolean;
  date: string;
  badgeId: string | null;
};

type BadgeDef = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earned: boolean;
  earnedAt: string | null;
};

type ContestEntry = {
  userId: string;
  displayName: string;
  isMe: boolean;
  rank: number;
  growthPct: number;
  currentValue: number;
  startValue: number;
  prizeAwarded: boolean;
  prizeAmount: number;
};

function QuestCard({ quest }: { quest: Quest }) {
  const pct = Math.min(100, quest.unit === "%"
    ? (quest.current / quest.target) * 100
    : (quest.current / quest.target) * 100);

  const progressLabel =
    quest.unit === "%" ? `${quest.current.toFixed(2)}% / ${quest.target}%`
    : quest.unit === "trades" ? `${Math.floor(quest.current)} / ${quest.target} trades`
    : `${Math.floor(quest.current)} / ${quest.target} assets`;

  return (
    <Card className={cn(
      "border transition-all duration-200",
      quest.completed
        ? "border-emerald-500/40 bg-emerald-500/5"
        : "border-border bg-card hover:border-border/80",
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {quest.completed
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                : <Target className="h-4 w-4 text-primary shrink-0" />}
              <span className="font-semibold text-sm text-foreground">{quest.name}</span>
              {quest.badgeId && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                  + badge
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{quest.description}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className={cn(
              "text-sm font-bold font-mono",
              quest.completed ? "text-emerald-500" : "text-amber-400",
            )}>
              +${quest.reward}
            </div>
            <div className="text-[10px] text-muted-foreground">virtual</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Progress value={pct} className={cn("h-2", quest.completed && "[&>div]:bg-emerald-500")} />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-mono">{progressLabel}</span>
            {quest.completed && (
              <span className="text-[11px] text-emerald-500 font-semibold">Claimed ✓</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BadgeCard({ badge }: { badge: BadgeDef }) {
  return (
    <Card className={cn(
      "border transition-all duration-200 text-center",
      badge.earned
        ? "border-primary/40 bg-primary/5"
        : "border-border/50 bg-card/50 opacity-60",
    )}>
      <CardContent className="p-4 flex flex-col items-center gap-2">
        <div className={cn(
          "text-4xl transition-all duration-200",
          !badge.earned && "grayscale opacity-50",
        )}>
          {badge.emoji}
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">{badge.name}</span>
            {!badge.earned && <Lock className="h-3 w-3 text-muted-foreground" />}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">{badge.description}</p>
        </div>
        {badge.earned && badge.earnedAt && (
          <span className="text-[10px] text-primary/70 font-mono mt-1">
            {new Date(badge.earnedAt).toLocaleDateString()}
          </span>
        )}
        {!badge.earned && (
          <span className="text-[10px] text-muted-foreground/60 font-mono mt-1">Locked</span>
        )}
      </CardContent>
    </Card>
  );
}

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const PRIZES = [500, 200, 100];

function ContestRow({ entry }: { entry: ContestEntry }) {
  const medal = RANK_MEDALS[entry.rank] ?? `#${entry.rank}`;
  const prize = PRIZES[entry.rank - 1];
  const growthPositive = entry.growthPct >= 0;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
      entry.isMe ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/30",
    )}>
      <div className="w-8 text-center text-lg shrink-0">{medal}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {entry.isMe ? <span className="text-primary">You</span> : entry.displayName}
          </span>
          {entry.isMe && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">you</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground font-mono mt-0.5">
          {formatCurrency(entry.currentValue)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn(
          "text-sm font-bold font-mono",
          growthPositive ? "text-emerald-400" : "text-red-400",
        )}>
          {growthPositive ? "+" : ""}{entry.growthPct.toFixed(2)}%
        </div>
        {prize && (
          <div className="text-[10px] text-amber-400/80 font-mono mt-0.5">Prize: ${prize}</div>
        )}
      </div>
    </div>
  );
}

export default function Quests() {
  const { data: questData, isLoading: questsLoading } = useQuery({
    queryKey: ["gamification", "quests"],
    queryFn: async () => {
      const res = await fetch("/api/gamification/quests", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quests");
      return res.json() as Promise<{ quests: Quest[]; portfolioValue: number }>;
    },
    refetchInterval: 30_000,
  });

  const { data: badgeData, isLoading: badgesLoading } = useQuery({
    queryKey: ["gamification", "badges"],
    queryFn: async () => {
      const res = await fetch("/api/gamification/badges", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch badges");
      return res.json() as Promise<{ badges: BadgeDef[] }>;
    },
    refetchInterval: 30_000,
  });

  const { data: contestData, isLoading: contestLoading } = useQuery({
    queryKey: ["gamification", "contest"],
    queryFn: async () => {
      const res = await fetch("/api/gamification/contest", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch contest");
      return res.json() as Promise<{ leaderboard: ContestEntry[]; weekStart: string; prizes: number[] }>;
    },
    refetchInterval: 30_000,
  });

  const earnedBadges = badgeData?.badges.filter(b => b.earned).length ?? 0;
  const totalBadges = badgeData?.badges.length ?? 0;
  const completedQuests = questData?.quests.filter(q => q.completed).length ?? 0;
  const myRank = contestData?.leaderboard.find(e => e.isMe)?.rank;

  // Daily reset countdown
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const msLeft = tomorrow.getTime() - now.getTime();
  const hoursLeft = Math.floor(msLeft / 3_600_000);
  const minsLeft = Math.floor((msLeft % 3_600_000) / 60_000);

  // Week reset countdown
  const weekStart = contestData?.weekStart;
  const weekStartDate = weekStart ? new Date(weekStart) : null;
  const weekEndDate = weekStartDate ? new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
  const msToWeekEnd = weekEndDate ? weekEndDate.getTime() - now.getTime() : 0;
  const daysToWeekEnd = Math.max(0, Math.floor(msToWeekEnd / 86_400_000));

  return (
    <Layout>
      <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Trophy className="h-6 w-6 text-amber-400" />
            <h1 className="text-2xl font-bold text-foreground">Gamification Hub</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Complete quests, earn badges, and compete in the weekly contest.
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="border-border bg-card">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground font-mono">{completedQuests}/3</div>
              <div className="text-xs text-muted-foreground mt-1">Daily Quests Done</div>
              <div className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono">
                Resets in {hoursLeft}h {minsLeft}m
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary font-mono">{earnedBadges}/{totalBadges}</div>
              <div className="text-xs text-muted-foreground mt-1">Badges Earned</div>
              <div className="text-[10px] text-muted-foreground/60 mt-0.5">Achievements unlocked</div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-400 font-mono">
                {myRank ? `#${myRank}` : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Weekly Rank</div>
              <div className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono">
                {daysToWeekEnd > 0 ? `${daysToWeekEnd}d left` : "Ends today"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="quests">
          <TabsList className="mb-4 bg-secondary/50">
            <TabsTrigger value="quests" className="flex items-center gap-2">
              <Target className="h-4 w-4" /> Daily Quests
            </TabsTrigger>
            <TabsTrigger value="badges" className="flex items-center gap-2">
              <Star className="h-4 w-4" /> Badges
            </TabsTrigger>
            <TabsTrigger value="contest" className="flex items-center gap-2">
              <Medal className="h-4 w-4" /> Weekly Contest
            </TabsTrigger>
          </TabsList>

          {/* DAILY QUESTS */}
          <TabsContent value="quests" className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-foreground">Today's Quests</h2>
              <span className="text-xs text-muted-foreground font-mono">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </span>
            </div>

            {questsLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => (
                  <Card key={i} className="border-border animate-pulse">
                    <CardContent className="p-5 h-24" />
                  </Card>
                ))}
              </div>
            ) : questData?.quests.map(quest => (
              <QuestCard key={quest.id} quest={quest} />
            ))}

            <Card className="border-border/50 bg-secondary/20 mt-4">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">How it works:</strong> Rewards are credited to your virtual cash balance automatically when you complete a quest.
                  Quests reset daily at midnight UTC. Some quests also unlock achievement badges.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BADGES */}
          <TabsContent value="badges">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Achievement Badges</h2>
              <Badge variant="outline" className="font-mono">
                {earnedBadges} / {totalBadges} earned
              </Badge>
            </div>

            {badgesLoading ? (
              <div className="grid grid-cols-3 gap-3 animate-pulse">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-4 h-32" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {badgeData?.badges.map(badge => (
                  <BadgeCard key={badge.id} badge={badge} />
                ))}
              </div>
            )}

            <Card className="border-border/50 bg-secondary/20 mt-4">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Badge tips:</strong>{" "}
                  <span className="text-foreground">Diamond Hands</span> — hold any position for 7+ days.{" "}
                  <span className="text-foreground">Paper Hands</span> — sell within 1 hour of buying.{" "}
                  <span className="text-foreground">First Blood</span> — place your very first trade.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WEEKLY CONTEST */}
          <TabsContent value="contest">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Weekly Leaderboard</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Week of {contestData?.weekStart ?? "—"} · Ranked by portfolio growth %
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Prize pool</div>
                <div className="text-sm font-bold text-amber-400 font-mono">$800 virtual</div>
              </div>
            </div>

            {/* Prize distribution */}
            <div className="flex gap-2 mb-4">
              {["🥇 $500", "🥈 $200", "🥉 $100"].map((label, i) => (
                <div key={i} className="flex-1 rounded-lg bg-secondary/40 border border-border/50 px-3 py-2 text-center">
                  <div className="text-xs font-medium text-foreground font-mono">{label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">virtual USD</div>
                </div>
              ))}
            </div>

            <Separator className="mb-4" />

            {contestLoading ? (
              <div className="space-y-2 animate-pulse">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-14 rounded-lg bg-secondary/30" />
                ))}
              </div>
            ) : contestData?.leaderboard.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No participants yet this week.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Place a trade to automatically join the contest!
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {contestData?.leaderboard.map(entry => (
                  <ContestRow key={entry.userId} entry={entry} />
                ))}
              </div>
            )}

            <Card className="border-border/50 bg-secondary/20 mt-4">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">How the contest works:</strong> You're automatically enrolled when you place your first trade of the week.
                  Your starting portfolio value is locked in at that moment. Growth % is tracked through Sunday.
                  Prizes are distributed to the top 3 on Monday and credited to your cash balance.
                  The #1 finisher also earns the <strong className="text-foreground">Weekly Champion</strong> 🏆 badge.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
