import React, { Children, ReactNode, isValidElement } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Chevron } from "./Chevron";
import { twMerge } from "tailwind-merge";

export function List() {
  return (
    <RadioGroupPrimitive.Root
      className="col-span-full flex flex-col"
      style={{
        background: `repeating-linear-gradient(to bottom, rgb(38, 41, 43), rgb(38, 41, 43) 24px, rgb(43, 47, 49) 24px, rgb(43, 47, 49) 48px)`,
      }}
    >
      <Item value="Scene Collection">
        <Item value="Collection">
          <Item Icon={Camera} value="Camera" />
          <Item value="Cube">
            <Item Icon={Mesh} value="Cube.001" />
            <Item Icon={Material} value="Material" />
          </Item>
          <Item Icon={Lightbulb} value="Light" />
        </Item>
      </Item>
    </RadioGroupPrimitive.Root>
  );
}

export function Item({
  value,
  children,
  level,
  Icon,
}: {
  value: string;
  children?: ReactNode;
  level?: number;
  Icon?: ({ color }: { color: string }) => React.JSX.Element;
}) {
  const padder = <div style={{ width: `${(level ?? 0) * 16}px` }} />;

  const [selected, setSelected] = React.useState(false);

  if (Children.count(children) > 0) {
    return (
      <Accordion.Root
        type="multiple"
        className="flex"
        onValueChange={() => {
          setSelected(!selected);
        }}
      >
        <Accordion.Item className="group w-full" value={`accordion-${value}`}>
          <RadioGroupPrimitive.Item
            value={`radio-${value}`}
            asChild
            className="flex h-6 w-full items-center px-2 text-sm text-slatedark12 outline-none data-[state=checked]:bg-bluedark7"
          >
            <Accordion.Header className="flex">
              {padder}
              <Accordion.Trigger className="mr-1 flex h-4 w-4 items-center justify-center rounded outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-bluedark8">
                <Chevron className={twMerge(selected && "rotate-0")} />
              </Accordion.Trigger>
              {Icon && (
                <div className="mr-2">
                  <Icon color="white" />
                </div>
              )}
              {value}
            </Accordion.Header>
          </RadioGroupPrimitive.Item>
          <Accordion.Content>
            {Children.map(children, (child) => {
              if (isValidElement(child)) {
                return React.cloneElement(child as any, {
                  level: (level ?? 0) + 1,
                });
              }
            })}
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    );
  }

  return (
    <RadioGroupPrimitive.Item
      value={value}
      className="flex h-6 w-full items-center px-2 pl-3 text-sm text-slatedark12 outline-none data-[state=checked]:bg-bluedark7"
    >
      {padder}
      {Icon && (
        <div className="mr-2">
          <Icon color="white" />
        </div>
      )}
      {value}
    </RadioGroupPrimitive.Item>
  );
}

function Camera({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.374 11.7333L14.9332 9.68601L14.9332 13.7807L12.374 11.7333Z"
        stroke={color}
        stroke-width="2.13333"
      />
      <path d="M3.5 8H12" stroke={color} stroke-width="2" />
      <path
        d="M2.06667 9.60001H10.6669C11.256 9.60001 11.7336 10.0776 11.7336 10.6667V13.9333C11.7336 14.5224 11.256 15 10.6669 15H4.44183C4.15893 15 3.88762 14.8876 3.68758 14.6876L1.31242 12.3124C1.11238 12.1124 1 11.8411 1 11.5582V10.6667C1 10.0776 1.47756 9.60001 2.06667 9.60001Z"
        fill={color}
      />
      <path
        d="M16 5C16 7.20914 14.2091 9 12 9C9.79086 9 8 7.20914 8 5C8 2.79086 9.79086 1 12 1C14.2091 1 16 2.79086 16 5ZM10.6253 5C10.6253 5.75924 11.2408 6.37472 12 6.37472C12.7592 6.37472 13.3747 5.75924 13.3747 5C13.3747 4.24076 12.7592 3.62528 12 3.62528C11.2408 3.62528 10.6253 4.24076 10.6253 5Z"
        fill={color}
      />
      <path
        d="M7 5.5C7 7.433 5.433 9 3.5 9C1.567 9 0 7.433 0 5.5C0 3.567 1.567 2 3.5 2C5.433 2 7 3.567 7 5.5ZM2.29712 5.5C2.29712 6.16433 2.83567 6.70288 3.5 6.70288C4.16433 6.70288 4.70288 6.16433 4.70288 5.5C4.70288 4.83567 4.16433 4.29712 3.5 4.29712C2.83567 4.29712 2.29712 4.83567 2.29712 5.5Z"
        fill={color}
      />
    </svg>
  );
}

function Mesh({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.22449 12.5758C6.97072 14.015 9.02928 14.015 9.77551 12.5758L13.4856 5.42063C14.1759 4.08932 13.2097 2.5 11.7101 2.5H4.28991C2.79027 2.5 1.82409 4.08932 2.5144 5.42063L6.22449 12.5758Z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Material({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_68_174)">
        <circle cx="8" cy="8" r="6.5" stroke={color} />
        <path d="M8 9V1C5 1 1 4 1 7C4 9 4 9 8 9Z" fill={color} />
        <path
          d="M8 15L8.00015 9C12 9 12 9 15 8C15 11 11.0003 15 8 15Z"
          fill={color}
        />
      </g>
      <defs>
        <clipPath id="clip0_68_174">
          <rect x="1" y="1" width="14" height="14" rx="7" fill={color} />
        </clipPath>
      </defs>
    </svg>
  );
}

function Eye({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.30931 8.26422C2.2241 8.17643 2.13857 8.08831 2.05257 8C2.13857 7.9117 2.2241 7.82357 2.30931 7.73578C3.05906 6.96332 3.78417 6.21623 4.58709 5.59217C5.6383 4.77514 6.72999 4.25 8.0021 4.25C9.2741 4.25 10.3647 4.77504 11.4147 5.59196C12.2152 6.21469 12.9379 6.95966 13.6856 7.73034C13.7725 7.81993 13.8598 7.90987 13.9475 8C13.8598 8.09013 13.7725 8.18007 13.6856 8.26966C12.9379 9.04034 12.2152 9.78531 11.4147 10.408C10.3647 11.225 9.2741 11.75 8.0021 11.75C6.72999 11.75 5.6383 11.2249 4.58709 10.4078C3.78417 9.78377 3.05906 9.03668 2.30931 8.26422Z"
        stroke={color}
        strokeWidth="1.5"
      />
      <rect x="6.5" y="6.5" width="3" height="3" rx="1.5" fill={color} />
      <path
        d="M8 11C3.5 11 3.5 5 8 5C5 5 4 6 3 7.99986C4 10 5 11 8 11Z"
        fill={color}
      />
      <path
        d="M8 11C12.5 11 12.5 5 8 5C11 5 12 6 13 7.99986C12 10 11 11 8 11Z"
        fill={color}
      />
    </svg>
  );
}

function Lightbulb({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.55403 10H10.446C10.8085 10 11.1687 9.90667 11.4647 9.69743C15.8249 6.61528 13.1864 1 8.00027 1C2.81412 1 0.17496 6.6153 4.5354 9.69745C4.8314 9.90668 5.19155 10 5.55403 10Z"
        fill={color}
      />
      <rect x="5" y="11" width="6" height="1" rx="0.5" fill={color} />
      <path
        d="M10.382 13H5.61803C5.2767 13 5 13.2767 5 13.618C5 13.8521 5.13226 14.0661 5.34164 14.1708L6.78885 14.8944C6.92771 14.9639 7.08082 15 7.23607 15H8.76393C8.91918 15 9.07229 14.9639 9.21115 14.8944L10.6584 14.1708C10.8677 14.0661 11 13.8521 11 13.618C11 13.2767 10.7233 13 10.382 13Z"
        fill={color}
      />
    </svg>
  );
}
