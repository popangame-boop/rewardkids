import { Skeleton } from "@/components/ui/skeleton";

export default function ChildLoading() {
  return (
    <div className="px-4 pt-6 pb-2 space-y-6 max-w-lg mx-auto">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-4 w-64 rounded-xl" />
      </div>

      {/* Content Skeletons */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-border rounded-[1.8rem] p-4 flex items-center gap-4 shadow-sm"
          >
            {/* Icon Skeleton */}
            <Skeleton className="w-14 h-14 rounded-2xl flex-shrink-0" />
            
            {/* Text details skeleton */}
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
