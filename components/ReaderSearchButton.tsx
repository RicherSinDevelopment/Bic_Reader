import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import ReaderGlassIconButton from "@/components/readerui/ReaderGlassIconButton";
import {
  Drawer,
  DrawerBackdrop,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Heading } from "@/components/ui/heading";
import { CloseIcon, Icon, SearchIcon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import React, { useDeferredValue, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, useColorScheme, View } from "react-native";

type SearchResult = {
  id: string;
  blockId: string;
  page: number;
  snippet: string;
  matchIndex: number;
};

type Props = {
  blocks: ExtractedPdfBlock[];
  grouped?: boolean;
  onSelectResult: (
    page: number,
    blockId: string,
    query: string,
    matchIndex: number,
  ) => void;
};

function resultSnippet(text: string, query: string) {
  const match = text.toLocaleLowerCase().indexOf(query);
  const start = Math.max(0, match - 48);
  const end = Math.min(text.length, match + query.length + 72);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export default function ReaderSearchButton({
  blocks,
  grouped = false,
  onSelectResult,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const isDark = useColorScheme() === "dark";
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const results = useMemo<SearchResult[]>(() => {
    if (!deferredQuery) return [];
    const matches: SearchResult[] = [];
    for (const block of blocks) {
      const normalized = block.text.toLocaleLowerCase();
      let fromIndex = 0;
      let occurrence = 0;
      while (matches.length < 250) {
        const match = normalized.indexOf(deferredQuery, fromIndex);
        if (match < 0) break;
        matches.push({
          id: `${block.id}-${occurrence}`,
          blockId: block.id,
          page: block.page,
          snippet: resultSnippet(block.text, deferredQuery),
          matchIndex: match,
        });
        occurrence += 1;
        fromIndex = match + Math.max(1, deferredQuery.length);
      }
      if (matches.length >= 250) break;
    }
    return matches;
  }, [blocks, deferredQuery]);

  return (
    <>
      <ReaderGlassIconButton
        accessibilityLabel="Search in book"
        grouped={grouped}
        onPress={() => setIsOpen(true)}
      >
        <Icon as={SearchIcon} size="lg" className="text-[#242424] dark:text-[#F4F5F1]" />
      </ReaderGlassIconButton>

      <Drawer
        isOpen={isOpen}
        size="lg"
        anchor="right"
        onClose={() => setIsOpen(false)}
      >
        <DrawerBackdrop />
        <DrawerContent className="pt-safe">
          <DrawerHeader>
            <Heading size="lg" className="text-foreground font-semibold">
              Find in book
            </Heading>
            <DrawerCloseButton>
              <Icon as={CloseIcon} className="stroke-foreground" size="lg" />
            </DrawerCloseButton>
          </DrawerHeader>

          <View style={styles.searchBox}>
            <Icon as={SearchIcon} size="md" className="text-black/40 dark:text-white/50" />
            <TextInput
              accessibilityLabel="Search text in this book"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              placeholder="Search this book"
              placeholderTextColor={isDark ? "#9EA69A" : "#9ca3af"}
              value={query}
              onChangeText={setQuery}
              style={styles.input}
            />
          </View>

          <Text className="mb-2 mt-3 text-xs text-black/50 dark:text-white/50">
            {deferredQuery
              ? `${results.length}${results.length === 250 ? "+" : ""} result${results.length === 1 ? "" : "s"}`
              : "Type a word or phrase"}
          </Text>

          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews
            contentContainerStyle={styles.results}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              deferredQuery ? (
                <Text className="py-8 text-center text-sm text-black/45 dark:text-white/45">
                  No matches found
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Search result on page ${item.page}`}
                onPress={() => {
                  setIsOpen(false);
                  requestAnimationFrame(() =>
                    onSelectResult(
                      item.page,
                      item.blockId,
                      deferredQuery,
                      item.matchIndex,
                    ),
                  );
                }}
                style={({ pressed }) => [
                  styles.result,
                  pressed && styles.pressed,
                ]}
              >
                <Text className="text-xs font-semibold text-[#719b79]">
                  Page {item.page}
                </Text>
                <Text
                  className="mt-1 text-sm leading-5 text-black/75 dark:text-white/75"
                  numberOfLines={3}
                >
                  {item.snippet}
                </Text>
              </Pressable>
            )}
          />
        </DrawerContent>
      </Drawer>
    </>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  searchBox: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: isDark ? "#42483F" : "#dbe2ea",
    borderRadius: 14,
    backgroundColor: isDark ? "#222720" : "#ffffff",
    paddingHorizontal: 14,
  },
  input: { flex: 1, height: "100%", color: isDark ? "#F4F5F1" : "#0f172a", fontSize: 16 },
  results: { paddingBottom: 32 },
  result: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 12 },
  pressed: { backgroundColor: isDark ? "#2A3027" : "#f1f5f9" },
  separator: { height: 1, backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.07)" },
});
