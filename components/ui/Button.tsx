import { ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  href?: never;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={[styles.button, styles[variant], className].filter(Boolean).join(" ")}
      {...props}
    />
  );
});

/** Same visual treatment as Button, for cases that navigate instead of act (e.g. "Add New User"). */
export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={[styles.button, styles[variant], className].filter(Boolean).join(" ")}>
      {children}
    </Link>
  );
}
