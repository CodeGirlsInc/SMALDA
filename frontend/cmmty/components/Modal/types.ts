import { ReactNode } from "react";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  size?: ModalSize;
  onClose?: () => void;
}
