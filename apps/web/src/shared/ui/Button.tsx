import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ children, variant = "secondary", ...props }: PropsWithChildren<ButtonProps>) {
  return <button className={`button button-${variant}`} {...props}>{children}</button>;
}
