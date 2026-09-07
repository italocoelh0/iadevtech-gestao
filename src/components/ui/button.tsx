"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { useGlobalLoading } from "@/components/system/global-loading";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        secondary: "bg-secondary text-secondary-foreground hover:opacity-80",
        outline: "border bg-background hover:bg-accent",
        ghost: "hover:bg-accent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  const globalLoading = useGlobalLoading();
  const loadingId = React.useId();
  const isSubmit = type === "submit" || type === undefined;

  React.useEffect(() => {
    if (!isSubmit || !globalLoading) return;
    const source = `form:${loadingId}`;
    globalLoading.setLoading(source, pending);
    return () => globalLoading.setLoading(source, false);
  }, [globalLoading, isSubmit, loadingId, pending]);

  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
