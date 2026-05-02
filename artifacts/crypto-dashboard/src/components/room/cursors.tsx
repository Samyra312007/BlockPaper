import type { CursorState } from "@/hooks/use-room-ws";

interface RoomCursorsProps {
  cursors: Record<string, CursorState>;
  currentSymbol: string;
}

export function RoomCursors({ cursors, currentSymbol }: RoomCursorsProps) {
  const visible = Object.values(cursors).filter((c) => c.symbol === currentSymbol);

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      {visible.map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute transition-all duration-100 ease-linear"
          style={{
            left: `${cursor.x * 100}%`,
            top: `${cursor.y * 100}%`,
            transform: "translate(-4px, -4px)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="drop-shadow-md">
            <path
              d="M4 2L16 10L10 11.5L7.5 17L4 2Z"
              fill={cursor.color}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="1"
            />
          </svg>
          <div
            className="absolute top-4 left-3 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
            style={{ backgroundColor: cursor.color, color: "#000" }}
          >
            {cursor.username.split(" ")[0]}
          </div>
        </div>
      ))}
    </div>
  );
}
