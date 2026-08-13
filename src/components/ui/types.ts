import type {
  ButtonHTMLAttributes,
  FormHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import type { LinkProps } from "next/link";

export type ContentWidth = "readable" | "workspace" | "full";
export type PageExpression = "operations" | "draft-night";
export type ActionVariant = "primary" | "secondary" | "tertiary" | "danger";
export type ActionScope = "product" | "league";

export interface BaseUiProps {
  children: ReactNode;
  className?: string;
}

export interface PageShellProps extends Omit<HTMLAttributes<HTMLDivElement>, "children">, BaseUiProps {
  width?: ContentWidth;
  expression?: PageExpression;
}

export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  identity?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  divider?: boolean;
}

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "title">, BaseUiProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  divider?: boolean;
}

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "title">, BaseUiProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
}

export interface DataSurfaceProps extends Omit<HTMLAttributes<HTMLDivElement>, "children">, BaseUiProps {
  label?: string;
}

export interface FormLayoutProps
  extends Omit<FormHTMLAttributes<HTMLFormElement>, "children" | "className">,
    BaseUiProps {
  actions?: ReactNode;
}

export interface SettingsShellProps extends Omit<HTMLAttributes<HTMLDivElement>, "children">, BaseUiProps {
  header?: ReactNode;
  tabs?: ReactNode;
  toolbar?: ReactNode;
}

export interface WorkspaceToolbarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children">, BaseUiProps {
  label?: string;
}

export interface ActionProps {
  variant?: ActionVariant;
  scope?: ActionScope;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className">,
    ActionProps {
  children: ReactNode;
}

export interface LinkButtonProps
  extends Omit<LinkProps, "children" | "className">,
    ActionProps {
  children: ReactNode;
  disabled?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLAnchorElement>["onClick"];
}

export interface IconButtonProps extends Omit<ButtonProps, "children" | "aria-label"> {
  children: ReactNode;
  label: string;
}
