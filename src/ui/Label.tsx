import React, { ReactNode } from "react";

type LabelProps = {
  children: ReactNode;
};

export function Label({ children }: LabelProps) {
  return (
    <span className="whitespace-nowrap text-sm text-slatedark9">
      {children}
    </span>
  );
}
