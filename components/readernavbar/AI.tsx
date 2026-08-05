import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@/components/ui/bottomsheet";
import { supabase } from "@/lib/supabase";
import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import {
  ChevronDown,
  History,
  Send,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

type AIProps = {
  selectedText?: string;
  currentPage: number;
  pageCount: number;
  blocks: ExtractedPdfBlock[];
};

type ContextMode = "current" | "range" | "whole";

const quickActions = [
  "Summarize this page",
  "Explain the key ideas",
  "Create study questions",
];

export default function AI({
  selectedText = "",
  currentPage,
  pageCount,
  blocks,
}: AIProps) {
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), Math.max(pageCount, 1));
  const [contextMode, setContextMode] = useState<ContextMode>("current");
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState(String(safeCurrentPage));
  const [rangeEnd, setRangeEnd] = useState(String(Math.min(safeCurrentPage + 4, pageCount || 1)));
  const [message, setMessage] = useState(selectedText ? `Explain this: ${selectedText}` : "");
  const [answer, setAnswer] = useState("");
  const [requestError, setRequestError] = useState("");
  const [isSending, setIsSending] = useState(false);

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

  const handleSend = async () => {
    const question = message.trim();
    if (!question || isSending) return;

    setIsSending(true);
    setRequestError("");
    setAnswer("");

    const context = buildContext();
    if (!context.trim()) {
      setRequestError("The selected pages have not finished loading. Try again in a moment.");
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
      setAnswer(data.answer);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Unable to contact AI.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <BottomSheetScrollView
      className="bg-[#F7F5EC]"
      contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row items-center justify-between pb-2 pt-2">
        <Text className="font-lato-bold text-3xl text-[#172019]">AI</Text>

        <Pressable
          accessibilityLabel="Show chat history"
          accessibilityRole="button"
          onPress={() => setHistoryOpen((value) => !value)}
          className={`h-12 flex-row items-center justify-center gap-2 rounded-2xl border px-4 ${
            historyOpen ? "border-[#6F9275] bg-[#DDEBDD]" : "border-black/10 bg-white/70"
          }`}
        >
          <History size={20} color="#354A39" />
          <Text className="font-lato-bold text-sm text-[#354A39]">History</Text>
        </Pressable>
      </View>

      {historyOpen ? (
        <View className="mt-4 rounded-2xl bg-white/70 px-5 py-5">
          <Text className="font-lato-bold text-base text-[#26352A]">No conversations yet</Text>
          <Text className="mt-2 text-base leading-6 text-black/45">
            Your conversations with this PDF will appear here once AI is connected.
          </Text>
        </View>
      ) : null}

      {selectedText ? (
        <View className="mt-4 rounded-2xl bg-[#E8F1E8] px-5 py-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-[#58715D]">
            Selected text
          </Text>
          <Text className="mt-2 text-base leading-6 text-[#26352A]" numberOfLines={2}>
            {selectedText}
          </Text>
        </View>
      ) : null}

      <Text className="mb-3 mt-6 font-lato-bold text-base text-[#26352A]">Context</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: contextMenuOpen }}
        onPress={() => setContextMenuOpen((value) => !value)}
        className="min-h-14 flex-row items-center rounded-2xl border border-black/10 bg-white px-5 py-4"
      >
        <Text className="flex-1 font-lato-bold text-base text-[#26352A]">{contextLabel}</Text>
        <ChevronDown size={21} color="#6D776F" />
      </Pressable>

      {contextMenuOpen ? (
        <View className="mt-2 overflow-hidden rounded-2xl border border-black/10 bg-white">
          {([
            ["current", `Current page (${safeCurrentPage})`],
            ["range", "Choose a page range"],
            ["whole", `Whole PDF (${pageCount || 1} pages)`],
          ] as const).map(([mode, label], index) => (
            <Pressable
              key={mode}
              onPress={() => chooseContext(mode)}
              className={`min-h-14 flex-row items-center px-5 py-4 ${index > 0 ? "border-t border-black/5" : ""}`}
            >
              <View className={`mr-3 h-4 w-4 rounded-full border ${
                contextMode === mode ? "border-[5px] border-[#6F9275]" : "border-black/25"
              }`} />
              <Text className="text-base text-[#26352A]">{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {contextMode === "range" ? (
        <View className="mt-3 flex-row items-end gap-3">
          <View className="flex-1">
            <Text className="mb-2 text-sm text-black/55">From page</Text>
            <BottomSheetTextInput
              value={rangeStart}
              onChangeText={setRangeStart}
              onBlur={() => setRangeStart(normalizePage(rangeStart))}
              keyboardType="number-pad"
              className="min-h-14 rounded-xl border border-black/10 bg-white px-4 py-4 text-base text-[#26352A]"
            />
          </View>
          <Text className="pb-3 text-black/35">to</Text>
          <View className="flex-1">
            <Text className="mb-2 text-sm text-black/55">To page</Text>
            <BottomSheetTextInput
              value={rangeEnd}
              onChangeText={setRangeEnd}
              onBlur={() => setRangeEnd(normalizePage(rangeEnd))}
              keyboardType="number-pad"
              className="min-h-14 rounded-xl border border-black/10 bg-white px-4 py-4 text-base text-[#26352A]"
            />
          </View>
        </View>
      ) : null}

      <Text className="mb-3 mt-6 font-lato-bold text-base text-[#26352A]">Suggestions</Text>
      <View className="gap-2">
        {quickActions.map((action) => (
          <Pressable
            key={action}
            onPress={() => {
              setMessage(action);
              setRequestError("");
            }}
            className="min-h-12 justify-center rounded-2xl bg-[#E8F1E8] px-5 py-3"
          >
            <Text className="text-base font-semibold text-[#416A48]">{action}</Text>
          </Pressable>
        ))}
      </View>

      <View className="mt-6 rounded-3xl border border-black/10 bg-white px-4 pb-4 pt-3">
        <BottomSheetTextInput
          value={message}
          onChangeText={(value) => {
            setMessage(value);
            setRequestError("");
          }}
          multiline
          placeholder="Ask anything about your PDF…"
          placeholderTextColor="#909890"
          className="min-h-28 px-1 py-3 text-base leading-6 text-[#26352A]"
          textAlignVertical="top"
        />
        <View className="flex-row items-center justify-between">
          <Text className="ml-1 text-sm text-black/40">{contextLabel}</Text>
          <Pressable
            accessibilityLabel="Send message"
            accessibilityRole="button"
            disabled={!message.trim() || isSending}
            onPress={() => void handleSend()}
            className={`h-12 w-12 items-center justify-center rounded-2xl ${
              message.trim() && !isSending ? "bg-[#527158]" : "bg-black/10"
            }`}
          >
            {isSending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Send size={20} color="white" />
            )}
          </Pressable>
        </View>
      </View>

      {answer ? (
        <View className="mt-5 rounded-3xl bg-[#E8F1E8] px-5 py-5">
          <Text className="mb-2 font-lato-bold text-base text-[#416A48]">Answer</Text>
          <Text selectable className="text-base leading-7 text-[#26352A]">{answer}</Text>
        </View>
      ) : null}

      {requestError ? (
        <View className="mt-4 rounded-2xl bg-red-50 px-4 py-3">
          <Text accessibilityRole="alert" className="text-sm leading-5 text-red-700">
            {requestError}
          </Text>
        </View>
      ) : null}

    </BottomSheetScrollView>
  );
}
