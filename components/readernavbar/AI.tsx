import { BottomSheetTextInput } from "@/components/ui/bottomsheet";
import {
  BottomSheetFooter,
  BottomSheetScrollView,
  BottomSheetTextInput as GorhomBottomSheetTextInput,
  INITIAL_LAYOUT_VALUE,
  KEYBOARD_STATUS,
  type BottomSheetScrollViewMethods,
  useBottomSheetInternal,
} from "@gorhom/bottom-sheet";
import { supabase } from "@/lib/supabase";
import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import {
  ChevronDown,
  CircleHelp,
  FileText,
  Lightbulb,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { useDerivedValue } from "react-native-reanimated";

type AIProps = {
  selectedText?: string;
  currentPage: number;
  pageCount: number;
  blocks: ExtractedPdfBlock[];
  isExpanded: boolean;
  onComposerActive: (reason: "submit" | "suggestion") => void;
};

type ContextMode = "current" | "range" | "whole";
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: "loading" | "error";
};
type MessageFeedback = "helpful" | "not-helpful";

const quickActions = [
  { label: "Summarize this page", icon: FileText },
  { label: "Explain the key ideas", icon: Lightbulb },
  { label: "Create study questions", icon: CircleHelp },
];

const AI_ACCENT = "#639922";

export default function AI({
  selectedText = "",
  currentPage,
  pageCount,
  blocks,
  isExpanded,
  onComposerActive,
}: AIProps) {
  const isDark = useColorScheme() === "dark";
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), Math.max(pageCount, 1));
  const [contextMode, setContextMode] = useState<ContextMode>("current");
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState(String(safeCurrentPage));
  const [rangeEnd, setRangeEnd] = useState(String(Math.min(safeCurrentPage + 4, pageCount || 1)));
  const [message, setMessage] = useState(selectedText ? `Explain this: ${selectedText}` : "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageFeedback, setMessageFeedback] = useState<
    Record<string, MessageFeedback>
  >({});
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const conversationRef = useRef<BottomSheetScrollViewMethods>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const { animatedKeyboardState, animatedLayoutState, animatedPosition } =
    useBottomSheetInternal();
  const showSetup = messages.length === 0;
  const chatActive = composerFocused || isExpanded || messages.length > 0;
  const firstQuestion = messages.find((chatMessage) =>
    chatMessage.role === "user"
  )?.text;

  const toggleMessageFeedback = (
    messageId: string,
    feedback: MessageFeedback,
  ) => {
    setMessageFeedback((current) => {
      if (current[messageId] === feedback) {
        const next = { ...current };
        delete next[messageId];
        return next;
      }
      return { ...current, [messageId]: feedback };
    });
  };

  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const keyboardSubscription = Keyboard.addListener("keyboardDidShow", () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        conversationRef.current?.scrollToEnd({ animated: true });
      }, 80);
    });
    return () => {
      keyboardSubscription.remove();
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, []);

  const animatedFooterPosition = useDerivedValue(() => {
    const { containerHeight, footerHeight, handleHeight } =
      animatedLayoutState.get();
    if (handleHeight === INITIAL_LAYOUT_VALUE) return 0;

    const keyboardState = animatedKeyboardState.get();
    let footerPosition = Math.max(0, containerHeight - animatedPosition.get());
    if (keyboardState.status === KEYBOARD_STATUS.SHOWN) {
      footerPosition -= keyboardState.heightWithinContainer;
    }

    return footerPosition - footerHeight - handleHeight;
  }, [animatedKeyboardState, animatedLayoutState, animatedPosition]);

  const contextLabel = useMemo(() => {
    if (contextMode === "whole") return "Whole PDF";
    if (contextMode === "range") return `Pages ${rangeStart || "?"}–${rangeEnd || "?"}`;
    return `Current page (${safeCurrentPage})`;
  }, [contextMode, rangeEnd, rangeStart, safeCurrentPage]);

  const chooseContext = (mode: ContextMode) => {
    setContextMode(mode);
    setContextMenuOpen(false);
  };

  const normalizePage = (value: string) => {
    if (!value) return "";
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return "";
    return String(Math.min(Math.max(parsed, 1), Math.max(pageCount, 1)));
  };

  const selectedPages = useMemo(() => {
    if (contextMode === "whole") return { start: 1, end: Math.max(pageCount, 1) };
    if (contextMode === "range") {
      const start = Number.parseInt(rangeStart, 10) || 1;
      const end = Number.parseInt(rangeEnd, 10) || start;
      return {
        start: Math.min(start, end),
        end: Math.max(start, end),
      };
    }
    return { start: safeCurrentPage, end: safeCurrentPage };
  }, [contextMode, pageCount, rangeEnd, rangeStart, safeCurrentPage]);

  const buildContext = () => {
    const pages = new Map<number, string[]>();
    blocks.forEach((block) => {
      if (block.page < selectedPages.start || block.page > selectedPages.end) return;
      pages.set(block.page, [...(pages.get(block.page) ?? []), block.text.trim()]);
    });

    const pageContext = Array.from(pages.entries())
      .sort(([first], [second]) => first - second)
      .map(([page, texts]) => `Page ${page}\n${texts.filter(Boolean).join("\n")}`)
      .join("\n\n");

    return selectedText
      ? `Selected passage:\n${selectedText}\n\n${pageContext}`
      : pageContext;
  };

  const handleSend = async (messageOverride?: string) => {
    const question = (messageOverride ?? message).trim();
    if (!question || isSendingRef.current) return;

    isSendingRef.current = true;
    if (!isExpanded) onComposerActive("submit");
    const turnId = `${Date.now()}`;
    const assistantMessageId = `assistant-${turnId}`;
    setIsSending(true);
    setMessage("");
    setMessages((currentMessages) => [
      ...currentMessages,
      { id: `user-${turnId}`, role: "user", text: question },
      { id: assistantMessageId, role: "assistant", status: "loading", text: "" },
    ]);

    const finishAssistantMessage = (text: string, status?: "error") => {
      setMessages((currentMessages) =>
        currentMessages.map((currentMessage) =>
          currentMessage.id === assistantMessageId
            ? { ...currentMessage, status, text }
            : currentMessage
        )
      );
    };

    const context = buildContext();
    if (!context.trim()) {
      finishAssistantMessage(
        "The selected pages have not finished loading. Try again in a moment.",
        "error"
      );
      isSendingRef.current = false;
      setIsSending(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("ask-pdf", {
        body: { question, context, contextLabel },
      });

      if (error) throw error;
      if (!data || typeof data.answer !== "string") {
        throw new Error("The AI returned an invalid response.");
      }
      finishAssistantMessage(data.answer);
    } catch (error) {
      finishAssistantMessage(
        error instanceof Error ? error.message : "Unable to contact AI.",
        "error"
      );
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  return (
    <>
      <BottomSheetScrollView
        ref={conversationRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        alwaysBounceVertical={false}
        bounces={false}
        enableFooterMarginAdjustment
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (messages.length > 0) {
            conversationRef.current?.scrollToEnd({ animated: true });
          }
        }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>AI</Text>
          <Pressable
            accessibilityLabel="Show chat history"
            accessibilityRole="button"
            onPress={() => setHistoryOpen((value) => !value)}
            style={({ pressed }) => [
              styles.historyButton,
              historyOpen && styles.historyButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.historyText}>History</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
        {historyOpen ? (
          messages.length === 0 ? (
          <View style={styles.noticeCard}>
            <Text style={styles.cardTitle}>No conversations yet</Text>
            <Text style={styles.noticeText}>Your conversations with this PDF will appear here.</Text>
          </View>
          ) : (
            <Pressable
              accessibilityLabel="Open current conversation"
              accessibilityRole="button"
              onPress={() => {
                setHistoryOpen(false);
                requestAnimationFrame(() => {
                  conversationRef.current?.scrollToEnd({ animated: false });
                });
              }}
              style={({ pressed }) => [
                styles.historyConversation,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cardTitle}>Current conversation</Text>
              <Text numberOfLines={2} style={styles.noticeText}>
                {firstQuestion ?? "Conversation about this PDF"}
              </Text>
              <Text style={styles.historyMessageCount}>
                {messages.length} {messages.length === 1 ? "message" : "messages"}
              </Text>
            </Pressable>
          )
        ) : null}

        {showSetup && !historyOpen ? <>

        {selectedText ? (
          <View style={styles.selectedCard}>
            <Text style={styles.selectedCaption}>Selected text</Text>
            <Text numberOfLines={2} style={styles.selectedText}>{selectedText}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Context</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: contextMenuOpen }}
          onPress={() => setContextMenuOpen((value) => !value)}
          style={({ pressed }) => [styles.contextButton, pressed && styles.pressed]}
        >
          <FileText size={17} color={AI_ACCENT} />
          <Text style={styles.contextText}>{contextLabel}</Text>
          <ChevronDown size={18} color="#64748B" />
        </Pressable>

        {contextMenuOpen ? (
          <View style={styles.contextMenu}>
            {([
              ["current", `Current page (${safeCurrentPage})`],
              ["range", "Choose a page range"],
              ["whole", `Whole PDF (${pageCount || 1} pages)`],
            ] as const).map(([mode, label], index) => (
              <Pressable
                key={mode}
                onPress={() => chooseContext(mode)}
                style={[styles.contextOption, index > 0 && styles.contextOptionBorder]}
              >
                <View style={[styles.radio, contextMode === mode && styles.radioSelected]} />
                <Text style={styles.contextOptionText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {contextMode === "range" ? (
          <View style={styles.rangeRow}>
            <View style={styles.rangeField}>
              <Text style={styles.rangeLabel}>From page</Text>
              <BottomSheetTextInput value={rangeStart} onChangeText={setRangeStart} onBlur={() => setRangeStart(normalizePage(rangeStart))} keyboardType="number-pad" style={styles.rangeInput} />
            </View>
            <Text style={styles.rangeTo}>to</Text>
            <View style={styles.rangeField}>
              <Text style={styles.rangeLabel}>To page</Text>
              <BottomSheetTextInput value={rangeEnd} onChangeText={setRangeEnd} onBlur={() => setRangeEnd(normalizePage(rangeEnd))} keyboardType="number-pad" style={styles.rangeInput} />
            </View>
          </View>
        ) : null}

        {!isExpanded ? (
          <>
            <Text style={styles.sectionLabel}>Suggestions</Text>
            <View style={styles.suggestions}>
              {quickActions.map(({ label, icon: ActionIcon }) => (
                <Pressable
                  key={label}
                  onPress={() => {
                    setMessage(label);
                    onComposerActive("suggestion");
                  }}
                  style={({ pressed }) => [styles.suggestionButton, pressed && styles.pressed]}
                >
                  <ActionIcon size={17} color={AI_ACCENT} />
                  <Text style={styles.suggestionText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        </> : null}

        {!historyOpen && messages.map((chatMessage) =>
          chatMessage.role === "user" ? (
            <View key={chatMessage.id} style={styles.questionBubble}>
              <Text style={styles.questionText}>{chatMessage.text}</Text>
            </View>
          ) : (
            <View key={chatMessage.id} style={styles.answerRow}>
              <View style={styles.aiAvatar}><Sparkles size={15} color="#FFFFFF" /></View>
              <View style={styles.answerColumn}>
                <View style={[styles.answerCard, chatMessage.status === "error" && styles.answerCardError]}>
                  {chatMessage.status === "loading" ? (
                    <ActivityIndicator color={AI_ACCENT} />
                  ) : (
                    <Text selectable style={[styles.answerText, chatMessage.status === "error" && styles.answerTextError]}>
                      {chatMessage.text}
                    </Text>
                  )}
                </View>
                {chatMessage.status !== "loading" && chatMessage.status !== "error" ? (
                  <View style={styles.feedbackRow}>
                    <Pressable
                      accessibilityLabel="Helpful answer"
                      accessibilityRole="button"
                      accessibilityState={{ selected: messageFeedback[chatMessage.id] === "helpful" }}
                      hitSlop={8}
                      onPress={() => toggleMessageFeedback(chatMessage.id, "helpful")}
                      style={[
                        styles.feedbackButton,
                        messageFeedback[chatMessage.id] === "helpful" && styles.feedbackButtonSelected,
                      ]}
                    >
                      <ThumbsUp
                        size={17}
                        color={messageFeedback[chatMessage.id] === "helpful" ? "#FFFFFF" : "#64748B"}
                      />
                    </Pressable>
                    <Pressable
                      accessibilityLabel="Not helpful"
                      accessibilityRole="button"
                      accessibilityState={{ selected: messageFeedback[chatMessage.id] === "not-helpful" }}
                      hitSlop={8}
                      onPress={() => toggleMessageFeedback(chatMessage.id, "not-helpful")}
                      style={[
                        styles.feedbackButton,
                        messageFeedback[chatMessage.id] === "not-helpful" && styles.feedbackButtonSelected,
                      ]}
                    >
                      <ThumbsDown
                        size={17}
                        color={messageFeedback[chatMessage.id] === "not-helpful" ? "#FFFFFF" : "#64748B"}
                      />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          )
        )}
        </View>
      </BottomSheetScrollView>

      <BottomSheetFooter
        animatedFooterPosition={animatedFooterPosition}
        style={styles.composerFooter}
      >
        <View style={styles.composerArea}>
          <View style={[styles.composer, chatActive && styles.composerExpanded]}>
            <GorhomBottomSheetTextInput
              value={message}
              onBlur={() => {
                if (!message.trim() && !isExpanded) setComposerFocused(false);
              }}
              onChangeText={(value) => {
                if (value.endsWith("\n")) {
                  const submittedValue = value.replace(/\n+$/, "");
                  setMessage(submittedValue);
                  void handleSend(submittedValue);
                  return;
                }
                setMessage(value);
              }}
              onFocus={() => setComposerFocused(true)}
              onSubmitEditing={() => void handleSend()}
              multiline
              placeholder="Ask anything about your PDF…"
              placeholderTextColor={isDark ? "#9EA69A" : "#94A3B8"}
              returnKeyType="send"
              style={[styles.composerInput, chatActive && styles.composerInputExpanded]}
              submitBehavior="submit"
              textAlignVertical="top"
            />
            <Pressable
              accessibilityLabel="Send message"
              accessibilityRole="button"
              disabled={!message.trim() || isSending}
              onPress={() => void handleSend()}
              style={({ pressed }) => [
                styles.sendButton,
                (!message.trim() || isSending) && styles.sendButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              {isSending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Send size={17} color="#FFFFFF" />}
            </Pressable>
          </View>
        </View>
      </BottomSheetFooter>
    </>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  scrollView: { backgroundColor: isDark ? "#151814" : "#FFFEFC", flex: 1 },
  content: { flexGrow: 1, paddingBottom: 16 },
  header: { alignItems: "center", backgroundColor: isDark ? "#151814" : "#FFFEFC", flexDirection: "row", height: 42, paddingHorizontal: 16, position: "relative" },
  body: { flexGrow: 1, paddingHorizontal: 16 },
  title: { color: isDark ? "#F4F5F1" : "#0F172A", fontSize: 21, fontWeight: "600" },
  historyButton: { alignItems: "center", borderColor: isDark ? "#42483F" : "#DDE2E8", borderRadius: 10, borderWidth: 1, flexDirection: "row", height: 34, justifyContent: "center", position: "absolute", right: 16, top: 4, width: 72 },
  historyButtonActive: { backgroundColor: isDark ? "#28321E" : "#F0F5E9", borderColor: AI_ACCENT },
  historyText: { color: AI_ACCENT, fontSize: 13, fontWeight: "600" },
  pressed: { opacity: 0.68 },
  sectionLabel: { color: isDark ? "#E5E8E1" : "#16202C", fontSize: 14, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  contextButton: { alignItems: "center", backgroundColor: isDark ? "#222720" : "#FFFFFF", borderColor: isDark ? "#42483F" : "#DDE2E8", borderRadius: 10, borderWidth: 1, flexDirection: "row", height: 43, paddingHorizontal: 13 },
  contextText: { color: isDark ? "#E5E8E1" : "#334155", flex: 1, fontSize: 14, fontWeight: "600", marginLeft: 10 },
  contextMenu: { backgroundColor: isDark ? "#222720" : "#FFFFFF", borderColor: isDark ? "#42483F" : "#DDE2E8", borderRadius: 10, borderWidth: 1, marginTop: 6, overflow: "hidden" },
  contextOption: { alignItems: "center", flexDirection: "row", height: 44, paddingHorizontal: 13 },
  contextOptionBorder: { borderTopColor: isDark ? "#343A31" : "#EEF1F4", borderTopWidth: StyleSheet.hairlineWidth },
  contextOptionText: { color: isDark ? "#E5E8E1" : "#334155", fontSize: 14 },
  radio: { borderColor: "#CBD5E1", borderRadius: 8, borderWidth: 1, height: 16, marginRight: 10, width: 16 },
  radioSelected: { borderColor: AI_ACCENT, borderWidth: 5 },
  suggestions: { gap: 5 },
  suggestionButton: { alignItems: "center", backgroundColor: isDark ? "#28321E" : "#F0F5E9", borderRadius: 9, flexDirection: "row", height: 38, paddingHorizontal: 13 },
  suggestionText: { color: AI_ACCENT, fontSize: 13.5, fontWeight: "600", marginLeft: 10 },
  noticeCard: { backgroundColor: isDark ? "#222720" : "#F8FAFC", borderRadius: 10, marginTop: 10, padding: 13 },
  historyConversation: { backgroundColor: isDark ? "#222720" : "#FFFFFF", borderColor: isDark ? "#42483F" : "#DDE2E8", borderRadius: 12, borderWidth: 1, marginTop: 10, padding: 14 },
  historyMessageCount: { color: AI_ACCENT, fontSize: 12, fontWeight: "600", marginTop: 8 },
  cardTitle: { color: isDark ? "#E5E8E1" : "#334155", fontSize: 14, fontWeight: "600" },
  noticeText: { color: isDark ? "#A6ADA1" : "#64748B", fontSize: 13, marginTop: 4 },
  selectedCard: { backgroundColor: isDark ? "#28321E" : "#F0F5E9", borderRadius: 10, marginTop: 10, padding: 12 },
  selectedCaption: { color: AI_ACCENT, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  selectedText: { color: isDark ? "#E5E8E1" : "#334155", fontSize: 13, lineHeight: 19, marginTop: 4 },
  rangeRow: { alignItems: "flex-end", flexDirection: "row", gap: 8, marginTop: 8 },
  rangeField: { flex: 1 },
  rangeLabel: { color: isDark ? "#A6ADA1" : "#64748B", fontSize: 12, marginBottom: 5 },
  rangeInput: { backgroundColor: isDark ? "#222720" : "#FFFFFF", borderColor: isDark ? "#42483F" : "#DDE2E8", borderRadius: 9, borderWidth: 1, color: isDark ? "#F4F5F1" : "#334155", height: 42, paddingHorizontal: 11 },
  rangeTo: { color: "#94A3B8", paddingBottom: 12 },
  questionBubble: { alignSelf: "flex-end", backgroundColor: isDark ? "#28321E" : "#F0F5E9", borderRadius: 14, marginLeft: 54, marginTop: 20, maxWidth: "82%", paddingHorizontal: 15, paddingVertical: 12 },
  questionText: { color: isDark ? "#E5E8E1" : "#26352A", fontSize: 14, lineHeight: 20 },
  answerRow: { alignItems: "flex-start", flexDirection: "row", marginTop: 18 },
  aiAvatar: { alignItems: "center", backgroundColor: AI_ACCENT, borderRadius: 14, height: 28, justifyContent: "center", marginRight: 8, marginTop: 4, width: 28 },
  answerColumn: { flex: 1 },
  answerCard: { backgroundColor: isDark ? "#222720" : "#FFFFFF", borderColor: isDark ? "#42483F" : "#DDE2E8", borderRadius: 12, borderWidth: 1, minHeight: 48, padding: 14 },
  answerCardError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  answerText: { color: isDark ? "#E5E8E1" : "#26352A", fontSize: 14, lineHeight: 21 },
  answerTextError: { color: "#B91C1C" },
  feedbackRow: { flexDirection: "row", gap: 8, marginLeft: 8, marginTop: 10 },
  feedbackButton: { alignItems: "center", borderColor: isDark ? "#42483F" : "#DDE2E8", borderRadius: 16, borderWidth: 1, height: 32, justifyContent: "center", width: 32 },
  feedbackButtonSelected: { backgroundColor: AI_ACCENT, borderColor: AI_ACCENT },
  composerFooter: { zIndex: 1000 },
  composerArea: { backgroundColor: isDark ? "#151814" : "#FFFEFC", paddingBottom: 9, paddingHorizontal: 15, paddingTop: 8 },
  composer: { alignItems: "center", backgroundColor: isDark ? "#222720" : "#FFFFFF", borderColor: isDark ? "#42483F" : "#D9D9D6", borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, elevation: 2, flexDirection: "row", minHeight: 52, paddingLeft: 17, paddingRight: 6, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  composerExpanded: { alignItems: "flex-end", borderRadius: 24, minHeight: 68, paddingBottom: 7, paddingTop: 6 },
  composerInput: { backgroundColor: "transparent", borderWidth: 0, color: isDark ? "#F4F5F1" : "#1F2937", flex: 1, fontSize: 15, height: 50, lineHeight: 20, margin: 0, paddingBottom: 0, paddingHorizontal: 0, paddingLeft: 0, paddingRight: 10, paddingTop: 14 },
  composerInputExpanded: { height: 60, lineHeight: 21, paddingTop: 8 },
  sendButton: { alignItems: "center", backgroundColor: AI_ACCENT, borderRadius: 19, height: 38, justifyContent: "center", width: 38 },
  sendButtonDisabled: { backgroundColor: "#CBD5E1" },
});
