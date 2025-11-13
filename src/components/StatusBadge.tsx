import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: "critical" | "low" | "safe";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variants = {
    critical: "destructive",
    low: "outline",
    safe: "default",
  } as const;

  const colors = {
    critical: "bg-destructive text-destructive-foreground",
    low: "bg-warning text-warning-foreground border-warning",
    safe: "bg-success text-success-foreground",
  };

  return (
    <Badge className={colors[status]}>
      {status.toUpperCase()}
    </Badge>
  );
}
