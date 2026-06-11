export type Tokens = {
  accessToken: string;
  refreshToken: string;
};

const KEY = "aikepu_tokens";

export function getTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tokens;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens) {
  window.localStorage.setItem(KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  window.localStorage.removeItem(KEY);
}

