"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SwitchProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> & {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      className,
      checked,
      defaultChecked,
      disabled,
      onCheckedChange,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [internalChecked, setInternalChecked] = React.useState<boolean>(
      defaultChecked ?? false,
    );

    const isControlled = typeof checked === "boolean";
    const isChecked = isControlled ? (checked as boolean) : internalChecked;

    const toggle = () => {
      const next = !isChecked;
      if (!isControlled) setInternalChecked(next);
      onCheckedChange?.(next);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isChecked}
        disabled={disabled}
        onClick={(e) => {
          if (disabled) return;
          toggle();
          onClick?.(e);
        }}
        className={cn(
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3cadaf]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50",
          isChecked ? "bg-[#3cadaf]" : "bg-slate-200",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
            isChecked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    );
  },
);

Switch.displayName = "Switch";
