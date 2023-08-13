import React, { ComponentProps, ReactNode } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { Chevron } from "./Chevron";
import { twMerge } from "tailwind-merge";
import { animations } from "../config";

type WidgetProps = {
  title: ReactNode;
};

export function Widget({
  title,
  children,
  className,
  ...rest
}: WidgetProps & ComponentProps<typeof Accordion.Item>) {
  return (
    <Accordion.Item {...rest} className="overflow-hidden">
      <Accordion.Header>
        <Accordion.Trigger className="group flex h-6 w-full items-center gap-1 bg-slatedark7 px-2 font-semibold outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-bluedark8">
          <Chevron
            className={twMerge(
              animations &&
                "ease-[cubic-bezier(0.87,_0,_0.13,_1)] transition-transform duration-100",
              "group-data-[state=open]:rotate-0",
            )}
          />
          <span className="text-sm text-slatedark12">{title}</span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content
        className={twMerge(
          animations &&
            "data-[state=closed]:animate-slide-up data-[state=open]:animate-slide-down",
          "overflow-hidden p-2 pl-4",
          className,
        )}
      >
        <div
          className="grid items-center gap-1 gap-x-4"
          style={{ gridTemplateColumns: "min-content auto" }}
        >
          {children}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
