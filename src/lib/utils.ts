import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatWardrobeNumber(wardrobeNumber: string | null | undefined): string {
  const num = (wardrobeNumber ?? '').replace(/\D/g, '');
  return num.padStart(3, '0');
}
