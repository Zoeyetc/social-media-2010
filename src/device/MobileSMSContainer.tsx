import { Dispatch, useEffect, useRef } from "react";
import { DeviceAudio } from "../audio/deviceAudio";
import { MessagesEvent, MessagesState, MobileSMSMessage, shouldScheduleDadLoveReply, shouldScheduleMomLoveReply, shouldScheduleMomReply } from "../state/messagesState";
import { IOS4Input } from "./IOS4KeyboardSystem";
import { PendingMediaAttachment } from "./MediaAttachmentPresentation";

type MobileSMSContainerProps = {
  state: MessagesState;
  dispatch: Dispatch<MessagesEvent>;
  currentElapsedMs: number;
  currentDeviceDateTime: Date;
  currentDeviceTime: string;
  onScheduleMomReply: () => void;
  onScheduleMomLoveReply: () => void;
  onScheduleDadLoveReply: () => void;
  onOpenCameraPicker: () => void;
  cameraPickerActive: boolean;
};

export function MobileSMSContainer({ state, dispatch, currentElapsedMs, currentDeviceDateTime, currentDeviceTime, onScheduleMomReply, onScheduleMomLoveReply, onScheduleDadLoveReply, onOpenCameraPicker, cameraPickerActive }: MobileSMSContainerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const conversationOpen = state.view === "conversation";
  const conversationSummaries = createConversationSummaries(state.messages);
  const activeMessages = state.activeConversationId
    ? state.messages.filter(message => message.conversationId === state.activeConversationId)
    : [];
  const contactName = activeMessages.find(message => message.direction === "incoming")?.sender ?? "Messages";
  const pendingAttachment = state.activeConversationId ? state.pendingAttachments[state.activeConversationId] : undefined;
  const canSend = Boolean(state.draft.trim() || pendingAttachment);
  const sendDraft = () => {
    if (!canSend) return;
    const schedulesMomReply = shouldScheduleMomReply(state, state.draft);
    const schedulesMomLoveReply = shouldScheduleMomLoveReply(state, state.draft);
    const schedulesDadLoveReply = shouldScheduleDadLoveReply(state, state.draft, currentElapsedMs);
    DeviceAudio.messageSent();
    dispatch({ type: "SEND", elapsedMs: currentElapsedMs, createdAt: currentDeviceDateTime.toISOString(), timestamp: currentDeviceTime });
    if (schedulesMomReply) onScheduleMomReply();
    if (schedulesMomLoveReply) onScheduleMomLoveReply();
    if (schedulesDadLoveReply) onScheduleDadLoveReply();
  };

  useEffect(() => {
    const transcript = conversationRef.current;
    if (!transcript) return;
    const scrollToLatest = () => { transcript.scrollTop = transcript.scrollHeight; };
    scrollToLatest();
    const observer = new ResizeObserver(scrollToLatest);
    observer.observe(transcript);
    return () => observer.disconnect();
  }, [state.activeConversationId, activeMessages.length]);

  return <section className="mobilesms-container" aria-label="Messages" inert={cameraPickerActive}>
    <header className="mobilesms-navigation-bar">
      {!conversationOpen && (conversationSummaries.length > 0 || state.editingConversations) && <button
        className="mobilesms-list-edit-control"
        type="button" onClick={() => dispatch({ type: "TOGGLE_LIST_EDIT" })}
        data-control-evidence="PERIOD-EVIDENCE"
      >{state.editingConversations ? "Done" : "Edit"}</button>}
      {conversationOpen && <button
        className="mobilesms-back-button"
        onClick={() => dispatch({ type: "BACK_TO_LIST" })}
      >Messages</button>}
      <strong>{conversationOpen ? contactName : "Messages"}</strong>
      {!conversationOpen && <span
        className="mobilesms-compose-control-hold"
        aria-hidden="true"
        data-provenance-status="HOLD"
      />}
    </header>
    {conversationOpen
      ? <>
        <div ref={conversationRef} className="mobilesms-conversation-scroll" role="log" aria-label={`Conversation with ${contactName}`}>
          {activeMessages.map(message => <div
            key={message.id}
            className={`mobilesms-message-row is-${message.direction}`}
          >
            <p
              className={`mobilesms-bubble is-${message.direction}${message.attachment ? " is-mms" : ""}`}
              data-message-status={message.status}
            >{message.attachment && <img className="mobilesms-image-message" src={message.attachment.objectUrl} alt="Photo" />}{message.text}</p>
          </div>)}
        </div>
        {pendingAttachment && <PendingMediaAttachment attachment={pendingAttachment} onRemove={() => dispatch({ type: "REMOVE_ATTACHMENT", contextId: state.activeConversationId! })} />}
        <div className="mobilesms-composer">
          <button
            type="button"
            className="mobilesms-camera-slot"
            data-provenance-status="READY"
            data-asset-source="8B117:/Applications/MobileSMS.app/PhotoButton@2x~iphone.png"
            aria-label="Camera"
            onClick={() => {
              onOpenCameraPicker();
            }}
          />
          <IOS4Input
            ref={inputRef}
            keyboardInputId="messages-compose"
            keyboardReturnKeyType="send"
            onKeyboardSubmit={sendDraft}
            aria-label="Text Message"
            value={state.draft}
            onValueChange={value => dispatch({ type: "EDIT_DRAFT", value })}
            onKeyDown={event => {
              const editsText = event.key.length === 1
                || (event.key === "Backspace" && state.draft.length > 0)
                || (event.key === "Delete" && state.draft.length > 0);
              if (editsText && !event.metaKey && !event.ctrlKey && !event.altKey) DeviceAudio.keyboardTap();
            }}
            autoFocus={false}
          />
          <button
            type="button"
            disabled={!canSend}
            onClick={sendDraft}
          >Send</button>
        </div>
      </>
      : <div className="mobilesms-conversation-list">
        {conversationSummaries.map(summary => <div key={summary.conversationId} className={`mobilesms-list-row${state.editingConversations ? " is-editing" : ""}`}>
          {state.editingConversations && <button type="button" className="mobilesms-delete-minus" aria-label={`Delete conversation with ${summary.contactName}`} onClick={() => dispatch({type:"SELECT_DELETE_CONVERSATION",conversationId:summary.conversationId})}>−</button>}
          <button
          type="button"
          className="mobilesms-conversation-row"
          disabled={state.editingConversations}
          onClick={() => dispatch({ type: "OPEN_CONVERSATION", conversationId: summary.conversationId })}
        >
          <span className="mobilesms-conversation-copy">
            <strong>{summary.contactName}</strong>
            <span>{summary.latestMessage.text || (summary.latestMessage.attachment ? "Photo" : "")}</span>
          </span>
          {summary.latestMessage.timestamp && <time>{summary.latestMessage.timestamp}</time>}
        </button>
          {state.editingConversations && state.deleteConversationId === summary.conversationId && <button type="button" className="mobilesms-delete-confirm" onClick={() => dispatch({type:"DELETE_CONVERSATION",conversationId:summary.conversationId})}>Delete</button>}
        </div>)}
      </div>}
  </section>;
}

function createConversationSummaries(messages: readonly MobileSMSMessage[]) {
  const conversationIds = [...new Set(messages.map(message => message.conversationId))];
  return conversationIds.map(conversationId => {
    const conversationMessages = messages.filter(message => message.conversationId === conversationId);
    const latestMessage = conversationMessages[conversationMessages.length - 1];
    const contactName = conversationMessages.find(message => message.direction === "incoming")?.sender ?? conversationId;
    return { conversationId, contactName, latestMessage, lastIndex: messages.lastIndexOf(latestMessage) };
  }).sort((a, b) => b.lastIndex - a.lastIndex);
}
