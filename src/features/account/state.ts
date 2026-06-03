export interface ButtonState {
  loading: boolean;
  success: boolean;
  error: boolean;
  text: string;
}

export interface AccountState {
  login: string | null;
  token: string;
  isSyncEnabled: boolean;
  activeSessions: number;
  buttons: {
    push: ButtonState;
    pull: ButtonState;
  };
}

export function createInitialState(): AccountState {
  return {
    login: null,
    token: "",
    isSyncEnabled: true,
    activeSessions: 0,
    buttons: {
      push: {
        loading: false,
        success: false,
        error: false,
        text: "Push Settings",
      },
      pull: {
        loading: false,
        success: false,
        error: false,
        text: "Pull Settings",
      },
    },
  };
}

export function resetButtonState(
  state: AccountState,
  button: "push" | "pull",
  text: string,
) {
  state.buttons[button] = {
    loading: false,
    success: false,
    error: false,
    text,
  };
}
