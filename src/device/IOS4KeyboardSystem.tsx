import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { DeviceAudio } from "../audio/deviceAudio";

export type IOS4KeyboardMode = "letters" | "numbers" | "symbols";
export type IOS4ShiftState = "lower" | "upper";
export type IOS4ReturnKeyType = "return" | "send" | "search" | "go" | "done";
export type IOS4InputType = "single-line" | "multi-line";
export type IOS4KeyboardDismissReason =
  | "submit"
  | "cancel"
  | "navigation"
  | "device-home"
  | "app-switch"
  | "lock"
  | "sleep"
  | "shutdown"
  | "session-reset"
  | "input-switch"
  | "explicit";

type IOS4TextControl = HTMLInputElement | HTMLTextAreaElement;

type IOS4InputRegistration = {
  inputId: string;
  inputType: IOS4InputType;
  returnKeyType: IOS4ReturnKeyType;
  value: string;
  maxLength?: number;
  element: IOS4TextControl;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onDismiss?: (reason: IOS4KeyboardDismissReason) => void;
  dismissOnSubmit: boolean;
};

type IOS4KeyboardViewState = {
  activeInputId: string | null;
  inputType: IOS4InputType | null;
  returnKeyType: IOS4ReturnKeyType;
  mode: IOS4KeyboardMode;
  shiftState: IOS4ShiftState;
  textValue: string;
  keyboardVisible: boolean;
};

type IOS4KeyboardContextValue = {
  suspended: boolean;
  state: IOS4KeyboardViewState;
  openKeyboard: (registration: IOS4InputRegistration) => void;
  refreshKeyboard: (registration: IOS4InputRegistration) => void;
  closeKeyboard: (reason: IOS4KeyboardDismissReason, inputId?: string) => void;
  submitKeyboardFromHost: (inputId: string) => boolean;
  isInputActive: (inputId: string) => boolean;
};

const INITIAL_KEYBOARD_STATE: IOS4KeyboardViewState = {
  activeInputId: null,
  inputType: null,
  returnKeyType: "return",
  mode: "letters",
  shiftState: "lower",
  textValue: "",
  keyboardVisible: false,
};

const IOS4KeyboardContext = createContext<IOS4KeyboardContextValue | null>(null);
let measuredOpenSessionId: string | null = null;

const LETTER_ROWS = [
  [..."QWERTYUIOP"],
  [..."ASDFGHJKL"],
] as const;

const NUMBER_ROWS = [
  [..."1234567890"],
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""] as const,
] as const;

const SYMBOL_ROWS = [
  ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="] as const,
  ["_", "\\", "|", "~", "<", ">", "€", "£", "¥", "•"] as const,
] as const;

const NUMBER_BOTTOM_ROW = [".", ",", "?", "!", "'"] as const;
const SYMBOL_BOTTOM_ROW = [".", ",", "?", "!", "'"] as const;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

function keepFocusedControlVisible(element: IOS4TextControl) {
  requestAnimationFrame(() => {
    const viewport = element.closest<HTMLElement>(".ios4-keyboard-viewport");
    if (!viewport || !element.isConnected) return;
    let ancestor = element.parentElement;
    while (ancestor && ancestor !== viewport) {
      if (ancestor.scrollHeight > ancestor.clientHeight) {
        const controlRect = element.getBoundingClientRect();
        const ancestorRect = ancestor.getBoundingClientRect();
        const submitControl = element.form?.querySelector<HTMLElement>('button[type="submit"]');
        const submitRect = submitControl?.getBoundingClientRect();
        const visibleBottom = submitRect && submitRect.top - controlRect.bottom <= 80
          ? Math.max(controlRect.bottom, submitRect.bottom)
          : controlRect.bottom;
        if (visibleBottom > ancestorRect.bottom) ancestor.scrollTop += visibleBottom - ancestorRect.bottom;
        if (controlRect.top < ancestorRect.top) ancestor.scrollTop -= ancestorRect.top - controlRect.top;
        return;
      }
      ancestor = ancestor.parentElement;
    }
  });
}

export function IOS4KeyboardSystem({ children, suspended = false, suspendReason = "app-switch", onVisibilityChange, experienceSessionId }: {
  children: ReactNode;
  suspended?: boolean;
  suspendReason?: IOS4KeyboardDismissReason;
  onVisibilityChange?: (visible: boolean) => void;
  experienceSessionId?: string | null;
}) {
  const activeRegistration = useRef<IOS4InputRegistration | null>(null);
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;
  const [state, setState] = useState<IOS4KeyboardViewState>(INITIAL_KEYBOARD_STATE);
  const keyboardVisible = !suspended && state.keyboardVisible;
  useLayoutEffect(() => {
    onVisibilityChange?.(keyboardVisible);
    return () => onVisibilityChange?.(false);
  }, [onVisibilityChange, keyboardVisible]);

  const closeKeyboard = useCallback((reason: IOS4KeyboardDismissReason, inputId?: string) => {
    const active = activeRegistration.current;
    if (inputId && active?.inputId !== inputId) return;
    active?.onDismiss?.(reason);
    activeRegistration.current = null;
    if (active && document.activeElement === active.element) active.element.blur();
    setState(INITIAL_KEYBOARD_STATE);
  }, []);

  const openKeyboard = useCallback((registration: IOS4InputRegistration) => {
    if (suspendedRef.current) {
      if (document.activeElement === registration.element) registration.element.blur();
      return;
    }
    const previous = activeRegistration.current;
    if (import.meta.env.DEV && experienceSessionId && measuredOpenSessionId !== experienceSessionId) {
      measuredOpenSessionId = experienceSessionId;
      const openedAt = performance.now();
      requestAnimationFrame(() => console.info("[IOS4Keyboard] first open/layout ms", Math.round(performance.now() - openedAt)));
    }
    if (previous && previous.inputId !== registration.inputId) previous.onDismiss?.("input-switch");
    activeRegistration.current = registration;
    setState(current => ({
      activeInputId: registration.inputId,
      inputType: registration.inputType,
      returnKeyType: registration.returnKeyType,
      mode: current.activeInputId === registration.inputId ? current.mode : "letters",
      shiftState: current.activeInputId === registration.inputId ? current.shiftState : "lower",
      textValue: registration.value,
      keyboardVisible: true,
    }));
    keepFocusedControlVisible(registration.element);
  }, [experienceSessionId]);

  const refreshKeyboard = useCallback((registration: IOS4InputRegistration) => {
    if (suspendedRef.current) return;
    if (activeRegistration.current?.inputId !== registration.inputId) return;
    activeRegistration.current = registration;
    setState(current => current.textValue === registration.value
      ? current
      : { ...current, textValue: registration.value });
  }, []);

  useLayoutEffect(() => {
    if (suspended) closeKeyboard(suspendReason);
  }, [closeKeyboard, suspendReason, suspended]);

  useEffect(() => () => {
    activeRegistration.current?.onDismiss?.("navigation");
    activeRegistration.current = null;
  }, []);

  const applyTextEdit = useCallback((insertedText: string, deleteBackward = false) => {
    const registration = activeRegistration.current;
    if (!registration) return;
    const { element } = registration;
    const currentValue = registration.value;
    let selectionStart = element.selectionStart ?? currentValue.length;
    const selectionEnd = element.selectionEnd ?? selectionStart;

    if (deleteBackward && selectionStart === selectionEnd && selectionStart > 0) {
      selectionStart = Array.from(currentValue.slice(0, selectionStart)).slice(0, -1).join("").length;
    }

    let nextValue = currentValue.slice(0, selectionStart) + insertedText + currentValue.slice(selectionEnd);
    if (registration.maxLength !== undefined) nextValue = nextValue.slice(0, registration.maxLength);
    const nextCaret = Math.min(selectionStart + insertedText.length, nextValue.length);
    registration.onChange(nextValue);
    activeRegistration.current = { ...registration, value: nextValue };
    setState(current => ({
      ...current,
      textValue: nextValue,
      shiftState: insertedText && current.mode === "letters" && current.shiftState === "upper" ? "lower" : current.shiftState,
    }));
    requestAnimationFrame(() => {
      if (!element.isConnected || suspendedRef.current || activeRegistration.current?.inputId !== registration.inputId) return;
      element.focus({ preventScroll: true });
      element.setSelectionRange(nextCaret, nextCaret);
    });
  }, []);

  const pressCharacter = useCallback((character: string) => {
    DeviceAudio.keyboardTap();
    const value = state.mode === "letters" && state.shiftState === "lower" ? character.toLowerCase() : character;
    applyTextEdit(value);
  }, [applyTextEdit, state.mode, state.shiftState]);

  const pressBackspace = useCallback(() => {
    DeviceAudio.keyboardTap();
    applyTextEdit("", true);
  }, [applyTextEdit]);

  const pressSpace = useCallback(() => {
    DeviceAudio.keyboardTap();
    applyTextEdit(" ");
  }, [applyTextEdit]);

  const submitRegistration = useCallback((registration: IOS4InputRegistration) => {
    if (registration.onSubmit) registration.onSubmit();
    else registration.element.form?.requestSubmit();
    if (registration.dismissOnSubmit) closeKeyboard("submit", registration.inputId);
  }, [closeKeyboard]);

  const submitKeyboardFromHost = useCallback((inputId: string) => {
    const registration = activeRegistration.current;
    if (!registration || registration.inputId !== inputId) return false;
    if (registration.inputType === "multi-line" && registration.returnKeyType === "return") return false;
    submitRegistration(registration);
    return true;
  }, [submitRegistration]);

  const pressReturn = useCallback(() => {
    const registration = activeRegistration.current;
    if (!registration) return;
    DeviceAudio.keyboardTap();
    if (registration.inputType === "multi-line" && registration.returnKeyType === "return") {
      applyTextEdit("\n");
      return;
    }
    submitRegistration(registration);
  }, [applyTextEdit, submitRegistration]);

  const contextValue: IOS4KeyboardContextValue = {
    suspended,
    state: suspended ? INITIAL_KEYBOARD_STATE : state,
    openKeyboard,
    refreshKeyboard,
    closeKeyboard,
    submitKeyboardFromHost,
    isInputActive: inputId => !suspended && state.activeInputId === inputId,
  };

  const rows = state.mode === "letters" ? LETTER_ROWS : state.mode === "numbers" ? NUMBER_ROWS : SYMBOL_ROWS;
  const bottomCharacters = state.mode === "symbols" ? SYMBOL_BOTTOM_ROW : NUMBER_BOTTOM_ROW;

  return <IOS4KeyboardContext.Provider value={contextValue}>
    <div className={`ios4-keyboard-system${keyboardVisible ? " is-keyboard-visible" : ""}`} data-keyboard-owner={keyboardVisible ? state.activeInputId ?? undefined : undefined} data-keyboard-visible={keyboardVisible}>
      <div className="ios4-keyboard-viewport">{children}</div>
      {!suspended && <section className="ios4-keyboard" aria-label="iOS 4.1 software keyboard" aria-hidden={!keyboardVisible}>
        {rows.map((row, index) => <div className={`ios4-keyboard-row is-row-${index + 1}${state.mode !== "letters" && index === 1 ? " is-ten-key-punctuation" : ""}`} key={`${state.mode}-${index}`}>
          {row.map(key => <IOS4KeyboardKey key={key} label={key} onPress={() => pressCharacter(key)} />)}
        </div>)}
        <div className={`ios4-keyboard-row is-row-3 is-${state.mode === "letters" ? "alpha" : "numeric"}`}>
          {state.mode === "letters"
            ? <IOS4KeyboardKey label="Shift" className={`is-function is-shift is-${state.shiftState}`} onPress={() => {
              DeviceAudio.keyboardTap();
              setState(current => ({ ...current, shiftState: current.shiftState === "lower" ? "upper" : "lower" }));
            }}><span className="ios4-shift-icon" aria-hidden="true" /></IOS4KeyboardKey>
            : <IOS4KeyboardKey label={state.mode === "numbers" ? "Symbols" : "Numbers"} className="is-function is-symbol-switch" onPress={() => {
              DeviceAudio.keyboardTap();
              setState(current => ({ ...current, mode: current.mode === "numbers" ? "symbols" : "numbers" }));
            }}>{state.mode === "numbers" ? "#+=" : "123"}</IOS4KeyboardKey>}
          <div className="ios4-keyboard-row-center">
            {(state.mode === "letters" ? [..."ZXCVBNM"] : bottomCharacters).map(key => <IOS4KeyboardKey key={key} label={key} onPress={() => pressCharacter(key)} />)}
          </div>
          <IOS4KeyboardKey label="Delete" className="is-function is-delete" onPress={pressBackspace}><span aria-hidden="true">⌫</span></IOS4KeyboardKey>
        </div>
        <div className="ios4-keyboard-row is-bottom-row">
          <IOS4KeyboardKey label={state.mode === "letters" ? "Numbers" : "Letters"} className="is-function is-mode" onPress={() => {
            DeviceAudio.keyboardTap();
            setState(current => ({ ...current, mode: current.mode === "letters" ? "numbers" : "letters", shiftState: "lower" }));
          }}>{state.mode === "letters" ? "123" : "ABC"}</IOS4KeyboardKey>
          <IOS4KeyboardKey label="Space" className="is-space" onPress={pressSpace}>space</IOS4KeyboardKey>
          <IOS4KeyboardKey label={state.returnKeyType} className={`is-function is-return${state.returnKeyType !== "return" ? " is-action" : ""}`} onPress={pressReturn}>{state.returnKeyType}</IOS4KeyboardKey>
        </div>
      </section>}
    </div>
  </IOS4KeyboardContext.Provider>;
}

function IOS4KeyboardKey({ label, className = "", children, onPress }: {
  label: string;
  className?: string;
  children?: ReactNode;
  onPress: () => void;
}) {
  return <button
    type="button"
    className={`ios4-keyboard-key ${className}`.trim()}
    aria-label={label}
    tabIndex={-1}
    onPointerDown={event => event.preventDefault()}
    onClick={onPress}
  >{children ?? label}</button>;
}

type IOS4KeyboardBindingProps = {
  keyboardInputId: string;
  keyboardReturnKeyType?: IOS4ReturnKeyType;
  keyboardDismissOnSubmit?: boolean;
  onKeyboardSubmit?: () => void;
  onKeyboardDismiss?: (reason: IOS4KeyboardDismissReason) => void;
  value: string;
  onValueChange: (value: string) => void;
};

type IOS4InputProps = Omit<ComponentPropsWithoutRef<"input">, "inputMode" | "onChange" | "value"> & IOS4KeyboardBindingProps;
type IOS4TextareaProps = Omit<ComponentPropsWithoutRef<"textarea">, "inputMode" | "onChange" | "value"> & IOS4KeyboardBindingProps;

function useIOS4KeyboardBinding({
  inputId,
  inputType,
  returnKeyType,
  value,
  maxLength,
  onValueChange,
  onSubmit,
  onDismiss,
  dismissOnSubmit,
  openWhenMounted,
}: {
  inputId: string;
  inputType: IOS4InputType;
  returnKeyType: IOS4ReturnKeyType;
  value: string;
  maxLength?: number;
  onValueChange: (value: string) => void;
  onSubmit?: () => void;
  onDismiss?: (reason: IOS4KeyboardDismissReason) => void;
  dismissOnSubmit: boolean;
  openWhenMounted: boolean;
}) {
  const context = useContext(IOS4KeyboardContext);
  if (!context) throw new Error("iOS 4 inputs must be rendered inside IOS4KeyboardSystem");
  const elementRef = useRef<IOS4TextControl | null>(null);
  const initialFocusHandled = useRef(false);
  const createRegistration = (): IOS4InputRegistration | null => elementRef.current ? ({
    inputId,
    inputType,
    returnKeyType,
    value,
    maxLength,
    element: elementRef.current,
    onChange: onValueChange,
    onSubmit,
    onDismiss,
    dismissOnSubmit,
  }) : null;

  useLayoutEffect(() => {
    const registration = createRegistration();
    if (!registration) return;
    const initialAutofocus = openWhenMounted && !initialFocusHandled.current;
    initialFocusHandled.current = true;
    if (context.suspended) return;
    if ((initialAutofocus || document.activeElement === registration.element) && !context.isInputActive(inputId)) {
      context.openKeyboard(registration);
      return;
    }
    context.refreshKeyboard(registration);
  });

  useEffect(() => () => context.closeKeyboard("navigation", inputId), [context.closeKeyboard, inputId]);

  return {
    elementRef,
    open: () => {
      if (!elementRef.current) return;
      const registration = createRegistration();
      if (registration) context.openKeyboard(registration);
    },
    submitFromPhysicalKeyboard: () => context.submitKeyboardFromHost(inputId),
  };
}

export const IOS4Input = forwardRef<HTMLInputElement, IOS4InputProps>(function IOS4Input({
  keyboardInputId,
  keyboardReturnKeyType = "return",
  keyboardDismissOnSubmit = false,
  onKeyboardSubmit,
  onKeyboardDismiss,
  autoFocus = false,
  onFocus,
  onKeyDown,
  onValueChange,
  value,
  maxLength,
  ...props
}, forwardedRef) {
  const binding = useIOS4KeyboardBinding({
    inputId: keyboardInputId,
    inputType: "single-line",
    returnKeyType: keyboardReturnKeyType,
    value,
    maxLength,
    onValueChange,
    onSubmit: onKeyboardSubmit,
    onDismiss: onKeyboardDismiss,
    dismissOnSubmit: keyboardDismissOnSubmit,
    openWhenMounted: autoFocus,
  });
  return <input
    {...props}
    ref={element => {
      binding.elementRef.current = element;
      assignRef(forwardedRef, element);
    }}
    value={value}
    maxLength={maxLength}
    inputMode="none"
    autoComplete="off"
    autoCorrect="off"
    autoCapitalize="off"
    spellCheck={false}
    autoFocus={autoFocus}
    onFocus={(event: FocusEvent<HTMLInputElement>) => {
      binding.open();
      onFocus?.(event);
    }}
    onChange={event => onValueChange(event.currentTarget.value)}
    onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && !event.nativeEvent.isComposing && binding.submitFromPhysicalKeyboard()) event.preventDefault();
      onKeyDown?.(event);
    }}
  />;
});

export const IOS4Textarea = forwardRef<HTMLTextAreaElement, IOS4TextareaProps>(function IOS4Textarea({
  keyboardInputId,
  keyboardReturnKeyType = "return",
  keyboardDismissOnSubmit = false,
  onKeyboardSubmit,
  onKeyboardDismiss,
  autoFocus = false,
  onFocus,
  onKeyDown,
  onValueChange,
  value,
  maxLength,
  ...props
}, forwardedRef) {
  const binding = useIOS4KeyboardBinding({
    inputId: keyboardInputId,
    inputType: "multi-line",
    returnKeyType: keyboardReturnKeyType,
    value,
    maxLength,
    onValueChange,
    onSubmit: onKeyboardSubmit,
    onDismiss: onKeyboardDismiss,
    dismissOnSubmit: keyboardDismissOnSubmit,
    openWhenMounted: autoFocus,
  });
  return <textarea
    {...props}
    ref={element => {
      binding.elementRef.current = element;
      assignRef(forwardedRef, element);
    }}
    value={value}
    maxLength={maxLength}
    inputMode="none"
    autoComplete="off"
    autoCorrect="off"
    autoCapitalize="off"
    spellCheck={false}
    autoFocus={autoFocus}
    onFocus={(event: FocusEvent<HTMLTextAreaElement>) => {
      binding.open();
      onFocus?.(event);
    }}
    onChange={event => onValueChange(event.currentTarget.value)}
    onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.nativeEvent.isComposing && binding.submitFromPhysicalKeyboard()) event.preventDefault();
      onKeyDown?.(event);
    }}
  />;
});
