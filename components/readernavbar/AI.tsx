import {
  BottomSheetTextInput,
} from "@/components/ui/bottomsheet";
import {
  BottomSheetFooter,
  BottomSheetTextInput as GorhomBottomSheetTextInput,
  INITIAL_LAYOUT_VALUE,
  KEYBOARD_STATUS,
  useBottomSheetInternal,
} from "@gorhom/bottom-sheet";
import { supabase } from "@/lib/supabase";
import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import {
  ChevronDown,
  CircleHelp,
  FileText,
  History,
  Lightbulb,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeViewGestureHandler } from "react-native-gesture-handler";
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

const quickActions = [
  { label: "Summarize this page", icon: FileText },
  { label: "Explain the key ideas", icon: Lightbulb },
  { label: "Create study questions", icon: CircleHelp },
];

export default function AI({
  selectedText = "",
  currentPage,
  pageCount,
  blocks,
  isExpanded,
  onComposerActive,
}: AIProps) {
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), Math.max(pageCount, 1));
  const [contextMode, setContextMode] = useState<ContextMode>("current");
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState(String(safeCurrentPage));
  const [rangeEnd, setRangeEnd] = useState(String(Math.min(safeCurrentPage + 4, pageCount || 1)));
  const [message, setMessage] = useState(selectedText ? `Explain this: ${selectedText}` : "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const conversationRef = useRef<ScrollView>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const { animatedKeyboardState, animatedLayoutState, animatedPosition } =
    useBottomSheetInternal();
  const showSetup = !composerFocused && !isExpanded;
  const chatActive = composerFocused || isExpanded;

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
    <View style={styles.root}>
      <NativeViewGestureHandler disallowInterruption>
        <ScrollView
          ref={conversationRef}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          bounces
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          onContentSizeChange={() => {
            if (messages.length > 0) {
              conversationRef.current?.scrollToEnd({ animated: true });
            }
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Sparkles size={20} color="#416A48" />
            <Text style={styles.title}>AI</Text>
          </View>
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
            <History size={16} color="#416A48" />
            <Text style={styles.historyText}>History</Text>
          </Pressable>
        </View>

        {showSetup ? <>
        {historyOpen ? (
          <View style={styles.noticeCard}>
            <Text style={styles.cardTitle}>No conversations yet</Text>
            <Text style={styles.noticeText}>Your conversations with this PDF will appear here.</Text>
          </View>
        ) : null}

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
          <FileText size={17} color="#416A48" />
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
                  <ActionIcon size={17} color="#416A48" />
                  <Text style={styles.suggestionText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        </> : null}

        {messages.map((chatMessage) =>
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
                    <ActivityIndicator color="#416A48" />
                  ) : (
                    <Text selectable style={[styles.answerText, chatMessage.status === "error" && styles.answerTextError]}>
                      {chatMessage.text}
                    </Text>
                  )}
                </View>
                {chatMessage.status !== "loading" && chatMessage.status !== "error" ? (
                  <View style={styles.feedbackRow}>
                    <Pressable accessibilityLabel="Helpful answer" hitSlop={10}><ThumbsUp size={17} color="#64748B" /></Pressable>
                    <Pressable accessibilityLabel="Not helpful" hitSlop={10}><ThumbsDown size={17} color="#64748B" /></Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          )
        )}
        </ScrollView>
      </NativeViewGestureHandler>

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
              placeholderTextColor="#94A3B8"
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#FFFEFC", flex: 1 },
  scrollView: { flex: 1, flexShrink: 1 },
  content: { flexGrow: 1, paddingBottom: 82, paddingHorizontal: 16, paddingTop: 4 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  titleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  title: { color: "#0F172A", fontSize: 21, fontWeight: "600" },
  historyButton: { alignItems: "center", borderColor: "#DDE2E8", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, height: 36, paddingHorizontal: 11 },
  historyButtonActive: { backgroundColor: "#EEF4EE", borderColor: "#AABCAA" },
  historyText: { color: "#416A48", fontSize: 13, fontWeight: "600" },
  pressed: { opacity: 0.68 },
  sectionLabel: { color: "#16202C", fontSize: 14, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  contextButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE2E8", borderRadius: 10, borderWidth: 1, flexDirection: "row", height: 43, paddingHorizontal: 13 },
  contextText: { color: "#334155", flex: 1, fontSize: 14, fontWeight: "600", marginLeft: 10 },
  contextMenu: { backgroundColor: "#FFFFFF", borderColor: "#DDE2E8", borderRadius: 10, borderWidth: 1, marginTop: 6, overflow: "hidden" },
  contextOption: { alignItems: "center", flexDirection: "row", height: 44, paddingHorizontal: 13 },
  contextOptionBorder: { borderTopColor: "#EEF1F4", borderTopWidth: StyleSheet.hairlineWidth },
  contextOptionText: { color: "#334155", fontSize: 14 },
  radio: { borderColor: "#CBD5E1", borderRadius: 8, borderWidth: 1, height: 16, marginRight: 10, width: 16 },
  radioSelected: { borderColor: "#6F9275", borderWidth: 5 },
  suggestions: { gap: 5 },
  suggestionButton: { alignItems: "center", backgroundColor: "#EEF4EE", borderRadius: 9, flexDirection: "row", height: 38, paddingHorizontal: 13 },
  suggestionText: { color: "#416A48", fontSize: 13.5, fontWeight: "600", marginLeft: 10 },
  noticeCard: { backgroundColor: "#F8FAFC", borderRadius: 10, marginTop: 10, padding: 13 },
  cardTitle: { color: "#334155", fontSize: 14, fontWeight: "600" },
  noticeText: { color: "#64748B", fontSize: 13, marginTop: 4 },
  selectedCard: { backgroundColor: "#EEF4EE", borderRadius: 10, marginTop: 10, padding: 12 },
  selectedCaption: { color: "#58715D", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  selectedText: { color: "#334155", fontSize: 13, lineHeight: 19, marginTop: 4 },
  rangeRow: { alignItems: "flex-end", flexDirection: "row", gap: 8, marginTop: 8 },
  rangeField: { flex: 1 },
  rangeLabel: { color: "#64748B", fontSize: 12, marginBottom: 5 },
  rangeInput: { backgroundColor: "#FFFFFF", borderColor: "#DDE2E8", borderRadius: 9, borderWidth: 1, color: "#334155", height: 42, paddingHorizontal: 11 },
  rangeTo: { color: "#94A3B8", paddingBottom: 12 },
  questionBubble: { alignSelf: "flex-end", backgroundColor: "#E9F0EA", borderRadius: 14, marginLeft: 54, marginTop: 20, maxWidth: "82%", paddingHorizontal: 15, paddingVertical: 12 },
  questionText: { color: "#26352A", fontSize: 14, lineHeight: 20 },
  answerRow: { alignItems: "flex-start", flexDirection: "row", marginTop: 18 },
  aiAvatar: { alignItems: "center", backgroundColor: "#416A48", borderRadius: 14, height: 28, justifyContent: "center", marginRight: 8, marginTop: 4, width: 28 },
  answerColumn: { flex: 1 },
  answerCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE2E8", borderRadius: 12, borderWidth: 1, minHeight: 48, padding: 14 },
  answerCardError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  answerText: { color: "#26352A", fontSize: 14, lineHeight: 21 },
  answerTextError: { color: "#B91C1C" },
  feedbackRow: { flexDirection: "row", gap: 18, marginLeft: 8, marginTop: 10 },
  composerFooter: { zIndex: 1000 },
  composerArea: { backgroundColor: "#FFFEFC", paddingBottom: 9, paddingHorizontal: 15, paddingTop: 8 },
  composer: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9D9D6", borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, elevation: 2, flexDirection: "row", minHeight: 52, paddingLeft: 17, paddingRight: 6, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  composerExpanded: { alignItems: "flex-end", borderRadius: 24, minHeight: 68, paddingBottom: 7, paddingTop: 6 },
  composerInput: { backgroundColor: "transparent", borderWidth: 0, color: "#1F2937", flex: 1, fontSize: 15, height: 50, margin: 0, paddingHorizontal: 0, paddingLeft: 0, paddingRight: 10, paddingVertical: 9 },
  composerInputExpanded: { height: 60, lineHeight: 21, paddingTop: 8 },
  sendButton: { alignItems: "center", backgroundColor: "#416A48", borderRadius: 19, height: 38, justifyContent: "center", width: 38 },
  sendButtonDisabled: { backgroundColor: "#CBD5E1" },
});
