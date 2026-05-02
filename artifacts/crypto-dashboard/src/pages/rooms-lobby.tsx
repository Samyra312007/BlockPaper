import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

async function createRoom(name: string): Promise<{ code: string }> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create room");
  return res.json();
}

async function checkRoom(code: string): Promise<boolean> {
  const res = await fetch(`/api/rooms/${code.toUpperCase()}`, { credentials: "include" });
  return res.ok;
}

export default function RoomsLobby() {
  const [, navigate] = useLocation();
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const { code } = await createRoom(roomName.trim() || "Trading Room");
      toast.success(`Room ${code} created!`);
      navigate(`/room/${code}`);
    } catch {
      toast.error("Failed to create room");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length !== 6) {
      toast.error("Enter a valid 6-character room code");
      return;
    }
    setJoining(true);
    try {
      const exists = await checkRoom(code);
      if (!exists) {
        toast.error("Room not found — check the code and try again");
        return;
      }
      navigate(`/room/${code}`);
    } catch {
      toast.error("Could not join room");
    } finally {
      setJoining(false);
    }
  }

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Trading Rooms</h1>
            <p className="text-muted-foreground text-sm">
              Trade together in real-time. Share live cursors, watch each other's moves, and compete on the leaderboard.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" /> Create a Room
                </CardTitle>
                <CardDescription className="text-xs">Start a new trading session and invite others</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-3">
                  <Input
                    placeholder="Room name (optional)"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    maxLength={60}
                    className="bg-secondary/30 text-sm"
                  />
                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating ? "Creating…" : "Create Room"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-primary" /> Join a Room
                </CardTitle>
                <CardDescription className="text-xs">Enter a 6-character code to join</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoin} className="space-y-3">
                  <Input
                    placeholder="ABCDEF"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="bg-secondary/30 font-mono text-center tracking-widest text-lg uppercase"
                  />
                  <Button type="submit" variant="outline" className="w-full" disabled={joining || joinCode.trim().length !== 6}>
                    {joining ? "Joining…" : "Join Room"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
