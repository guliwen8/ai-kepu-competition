import Taro from '@tarojs/taro';
import { create } from 'zustand';

export type Tokens = {
  accessToken: string;
  refreshToken: string;
};

export type Me = {
  id: string;
  phone: string | null;
  email: string | null;
  username: string | null;
  roles: string[];
};

const TOKENS_KEY = 'aikepu_tokens';

type State = {
  tokens: Tokens | null;
  me: Me | null;
  setTokens: (tokens: Tokens) => void;
  clear: () => void;
  load: () => void;
  setMe: (me: Me | null) => void;
};

export const useAuthStore = create<State>((set, get) => ({
  tokens: null,
  me: null,
  setTokens: (tokens) => {
    Taro.setStorageSync(TOKENS_KEY, tokens);
    set({ tokens });
  },
  clear: () => {
    Taro.removeStorageSync(TOKENS_KEY);
    set({ tokens: null, me: null });
  },
  load: () => {
    const tokens = (Taro.getStorageSync(TOKENS_KEY) as Tokens | undefined) ?? null;
    set({ tokens });
  },
  setMe: (me) => set({ me }),
}));

export function accessToken() {
  return useAuthStore.getState().tokens?.accessToken ?? null;
}
