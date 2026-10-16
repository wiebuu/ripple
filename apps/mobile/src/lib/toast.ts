import { create } from 'zustand';

type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' };
type ToastState = { toast: Toast | null; show: (message: string, tone?: Toast['tone']) => void; hide: () => void };

let seq = 0;
export const useToast = create<ToastState>((set) => ({
  toast: null,
  show: (message, tone = 'success') => set({ toast: { id: ++seq, message, tone } }),
  hide: () => set({ toast: null }),
}));

export const toast = (message: string, tone?: Toast['tone']) => useToast.getState().show(message, tone);
