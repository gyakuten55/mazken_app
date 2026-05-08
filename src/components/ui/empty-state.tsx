import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6 gap-4 text-muted-foreground",
        className,
      )}
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <Icon className="h-7 w-7" />
      </div>
      <div className="space-y-1.5">
        <div className="text-base font-semibold text-foreground">{title}</div>
        {description && (
          <p className="text-sm leading-relaxed max-w-md">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
