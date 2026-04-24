import { InputHTMLAttributes, ReactNode } from "react";

export type InputType = "text" | "email" | "password";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id?: string;
  type?: InputType;
  label?: string;
  helperText?: string;
  error?: boolean;
  errorMessage?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}
