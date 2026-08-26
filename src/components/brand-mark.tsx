import { cn } from "@/lib/utils";

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo-mark.png"
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
