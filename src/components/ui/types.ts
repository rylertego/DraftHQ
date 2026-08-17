import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  FormHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import type Link from "next/link";

export type ContentWidth = "readable" | "workspace" | "full";
export type PageExpression = "operations" | "draft-night";
export type ActionVariant = "primary" | "secondary" | "tertiary" | "danger";
export type ActionScope = "product" | "league";

export interface BaseUiProps {
  children: ReactNode;
}

type ProtectedHtmlAttributes<T, Omitted extends keyof HTMLAttributes<T> = never> = Omit<
  HTMLAttributes<T>,
  "children" | "className" | "color" | "style" | Omitted
>;

export interface PageShellProps extends ProtectedHtmlAttributes<HTMLDivElement>, BaseUiProps {
  width?: ContentWidth;
  expression?: PageExpression;
}

export interface PageHeaderProps extends ProtectedHtmlAttributes<HTMLElement, "title"> {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  identity?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  divider?: boolean;
}

export interface SectionProps extends ProtectedHtmlAttributes<HTMLElement, "title">, BaseUiProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  divider?: boolean;
}

export interface PanelProps extends ProtectedHtmlAttributes<HTMLElement, "title">, BaseUiProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
}

export interface DataSurfaceProps
  extends ProtectedHtmlAttributes<HTMLDivElement, "aria-label" | "role">,
    BaseUiProps {
  label: string;
}

export interface FormLayoutProps
  extends Omit<FormHTMLAttributes<HTMLFormElement>, "children" | "className" | "color" | "style">,
    BaseUiProps {
  actions?: ReactNode;
}

export interface SettingsShellProps extends ProtectedHtmlAttributes<HTMLDivElement>, BaseUiProps {
  header?: ReactNode;
  tabs?: ReactNode;
  toolbar?: ReactNode;
}

export interface WorkspaceToolbarProps extends ProtectedHtmlAttributes<HTMLDivElement, "role">, BaseUiProps {
  label?: string;
}

export interface ActionProps {
  variant?: ActionVariant;
  scope?: ActionScope;
  loading?: boolean;
  fullWidth?: boolean;
}

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "color" | "style">,
    ActionProps {
  children: ReactNode;
}

export interface LinkButtonProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, "children" | "className" | "color" | "style">,
    ActionProps {
  children: ReactNode;
  disabled?: boolean;
}

export interface IconButtonProps extends Omit<ButtonProps, "children" | "aria-label"> {
  children: ReactNode;
  label: string;
}
