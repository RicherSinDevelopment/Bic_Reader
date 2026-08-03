import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import { Button } from "@/components/ui/button";
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
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";

type SearchResult = {
  id: string;
  blockId: string;
  page: number;
  snippet: string;
};

type Props = {
  blocks: ExtractedPdfBlock[];
  onSelectResult: (page: number, blockId: string) => void;
};

function resultSnippet(text: string, query: string) {
  const match = text.toLocaleLowerCase().indexOf(query);
  const start = Math.max(0, match - 48);
  const end = Math.min(text.length, match + query.length + 72);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export default function ReaderSearchButton({ blocks, onSelectResult }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());

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
      <Button
        accessibilityLabel="Search in book"
        variant="outline"
        size="sm"
        className="h-12 w-12 rounded-xl p-3"
        onPress={() => setIsOpen(true)}
      >
        <Icon as={SearchIcon} size="md" />
      </Button>

      <Drawer isOpen={isOpen} size="lg" anchor="right" onClose={() => setIsOpen(false)}>
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
            <Icon as={SearchIcon} size="md" className="text-black/40" />
            <TextInput
              accessibilityLabel="Search text in this book"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              placeholder="Search this book"
              placeholderTextColor="#9ca3af"
              value={query}
              onChangeText={setQuery}
              style={styles.input}
            />
          </View>

          <Text className="mb-2 mt-3 text-xs text-black/50">
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
            ListEmptyComponent={deferredQuery ? (
              <Text className="py-8 text-center text-sm text-black/45">
                No matches found
              </Text>
            ) : null}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Search result on page ${item.page}`}
                onPress={() => {
                  setIsOpen(false);
                  requestAnimationFrame(() => onSelectResult(item.page, item.blockId));
                }}
                style={({ pressed }) => [styles.result, pressed && styles.pressed]}
              >
                <Text className="text-xs font-semibold text-[#719b79]">Page {item.page}</Text>
                <Text className="mt-1 text-sm leading-5 text-black/75" numberOfLines={3}>
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

const styles = StyleSheet.create({
  searchBox: { height: 52, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#dbe2ea", borderRadius: 14, backgroundColor: "#ffffff", paddingHorizontal: 14 },
  input: { flex: 1, height: "100%", color: "#0f172a", fontSize: 16 },
  results: { paddingBottom: 32 },
  result: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 12 },
  pressed: { backgroundColor: "#f1f5f9" },
  separator: { height: 1, backgroundColor: "rgba(15, 23, 42, 0.07)" },
});
