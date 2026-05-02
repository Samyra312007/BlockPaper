import { useEffect, useRef } from "react";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";
import { useGetCandleData, getGetCandleDataQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export function Chart({ symbol }: { symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  const { data: candles, isLoading } = useGetCandleData(symbol, { interval: "1h", limit: 200 }, {
    query: {
      queryKey: getGetCandleDataQueryKey(symbol, { interval: "1h", limit: 200 })
    }
  });

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0d1117" },
        textColor: "#8b949e",
      },
      grid: {
        vertLines: { color: "#21262d" },
        horzLines: { color: "#21262d" },
      },
      timeScale: {
        borderColor: "#21262d",
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "#21262d",
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a641",
      downColor: "#f85149",
      borderVisible: false,
      wickUpColor: "#26a641",
      wickDownColor: "#f85149",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && candles && candles.length > 0) {
      const data = [...candles].sort((a, b) => a.time - b.time).map(c => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      seriesRef.current.setData(data);
      chartRef.current?.timeScale().fitContent();
    }
  }, [candles]);

  return (
    <div className="w-full h-full relative bg-[#0d1117]">
      {isLoading && !candles && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Skeleton className="w-full h-full bg-[#0d1117]" />
        </div>
      )}
      <div ref={chartContainerRef} className="w-full h-full absolute inset-0" />
    </div>
  );
}
