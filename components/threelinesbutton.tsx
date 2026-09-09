import ReaderGlassIconButton from "@/components/readerui/ReaderGlassIconButton";
import {
  Drawer,
  DrawerBackdrop,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Heading } from "@/components/ui/heading";
import { CloseIcon, Icon, MenuIcon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react-native";
import React from "react";
import { FlatList, Pressable, StyleSheet, TextInput, useColorScheme, View } from "react-native";

export type ReaderChapter = {
  id: string;
  blockId?: string;
  title: string;
  page: number;
  sourcePage?: number;
  children?: ReaderChapter[];
};

type OutlineRow = { chapter: ReaderChapter; depth: number };

type Props = {
  chapters?: ReaderChapter[];
  compact?: boolean;
  compactWidth?: number;
  currentPage?: number;
  grouped?: boolean;
  totalPages?: number;
  onGoToPage?: (page: number) => void;
  onGoToChapter?: (chapter: ReaderChapter) => void;
};

export default function ThreeLinesButton({
  chapters = [],
  compact = false,
  compactWidth,
  currentPage = 1,
  grouped = false,
  totalPages = 0,
  onGoToPage,
  onGoToChapter,
}: Props) {
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [pageInput, setPageInput] = React.useState(String(currentPage));
  const [expandedChapterIds, setExpandedChapterIds] = React.useState<string[]>(
    [],
  );
  const isDark = useColorScheme() === "dark";
  const styles = React.useMemo(() => createStyles(isDark), [isDark]);
  const updatePageInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    setPageInput(digits);

    const page = Number.parseInt(digits, 10);
    if (!Number.isFinite(page) || page < 1 || page > totalPages) return;
    onGoToPage?.(page);
  };

  const outlineRows = React.useMemo<OutlineRow[]>(() => {
    const rows: OutlineRow[] = [];
    const append = (items: ReaderChapter[], depth: number) =>
      items.forEach((chapter) => {
        rows.push({ chapter, depth });
        if (expandedChapterIds.includes(chapter.id))
          append(chapter.children ?? [], depth + 1);
      });
    append(chapters, 0);
    return rows;
  }, [chapters, expandedChapterIds]);

  const renderChapter = React.useCallback(
    ({ item }: { item: OutlineRow }) => {
      const { chapter, depth } = item;
      const hasChildren = Boolean(chapter.children?.length);
      const isExpanded = expandedChapterIds.includes(chapter.id);
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${chapter.title}, page ${chapter.page}`}
          onPress={() => {
            setShowDrawer(false);
            requestAnimationFrame(() => onGoToChapter?.(chapter));
          }}
          style={({ pressed }) => [
            styles.chapter,
            depth > 0 && styles.section,
            depth > 0 && { marginLeft: Math.min(depth, 4) * 16 },
            pressed && styles.pressed,
          ]}
        >
          {depth > 0 ? (
            <View style={styles.sectionMarker} />
          ) : (
            <BookOpen size={17} color={isDark ? "#A6ADA1" : "#64748b"} />
          )}
          <Text className="flex-1 text-sm text-black dark:text-[#F4F5F1]" numberOfLines={2}>
            {chapter.title}
          </Text>
          <Text className="text-xs text-black/45 dark:text-white/45">{chapter.page}</Text>
          {hasChildren && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${isExpanded ? "Collapse" : "Expand"} ${chapter.title}`}
              accessibilityState={{ expanded: isExpanded }}
              hitSlop={8}
              style={{ padding: 8 }}
              onPress={(event) => {
                event.stopPropagation();
                setExpandedChapterIds((current) => isExpanded
                  ? current.filter((id) => id !== chapter.id)
                  : [...current, chapter.id]);
              }}
            >
            {isExpanded ? (
              <ChevronDown size={16} color={isDark ? "#A6ADA1" : "#64748b"} />
            ) : (
              <ChevronRight size={16} color={isDark ? "#A6ADA1" : "#64748b"} />
            )}
            </Pressable>
          )}
        </Pressable>
      );
    },
    [expandedChapterIds, isDark, onGoToChapter, styles],
  );

  return (
    <>
      {/* Menu Button */}
      <ReaderGlassIconButton
        accessibilityLabel="Open table of contents"
        compact={compact}
        compactWidth={compactWidth}
        grouped={grouped}
        onPress={() => {
          setPageInput(String(currentPage));
          setShowDrawer(true);
        }}
      >
        <Icon as={MenuIcon} size={compact ? "md" : "lg"} className="text-[#242424] dark:text-[#F4F5F1]" />
      </ReaderGlassIconButton>

      {/* Drawer */}
      <Drawer
        isOpen={showDrawer}
        size="base"
        anchor="left"
        onClose={() => {
          setShowDrawer(false);
        }}
      >
        <DrawerBackdrop />

        <DrawerContent className="pt-safe">
          <DrawerHeader>
            <Heading size="lg" className="text-foreground font-semibold">
              Table of contents
            </Heading>

            <DrawerCloseButton>
              <Icon as={CloseIcon} className="stroke-foreground" size="lg" />
            </DrawerCloseButton>
          </DrawerHeader>

          {totalPages > 0 && (
            <View style={styles.pageControl}>
              <Text className="font-lato-bold text-sm text-black/70 dark:text-white/70">Page</Text>
              <View style={styles.pageRow}>
                <TextInput
                  value={pageInput}
                  onChangeText={updatePageInput}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  accessibilityLabel="Page number"
                  style={styles.pageInput}
                />
                <Text className="text-base text-black/60 dark:text-white/60">of {totalPages}</Text>
              </View>
            </View>
          )}

          <FlatList
            data={outlineRows}
            renderItem={renderChapter}
            keyExtractor={({ chapter }) => chapter.id}
            contentContainerStyle={styles.chapterList}
            initialNumToRender={10}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={40}
            windowSize={5}
            removeClippedSubviews
            ListEmptyComponent={
              <Text className="px-5 py-6 text-sm text-black/50 dark:text-white/50">
                This PDF does not contain an embedded table of contents.
              </Text>
            }
          />
        </DrawerContent>
      </Drawer>
    </>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  pageControl: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: isDark ? "#222720" : "#f1f5f9",
  },
  pageRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pageInput: {
    width: 72,
    height: 42,
    borderWidth: 1,
    borderColor: isDark ? "#42483F" : "#cbd5e1",
    borderRadius: 10,
    backgroundColor: isDark ? "#1A1E18" : "#ffffff",
    textAlign: "center",
    fontSize: 16,
    color: isDark ? "#F4F5F1" : "#0f172a",
  },
  chapterList: { paddingHorizontal: 12, paddingBottom: 24 },
  chapter: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  section: { height: 52, paddingLeft: 14 },
  sectionMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: isDark ? "#788174" : "#94a3b8",
  },
  pressed: { backgroundColor: isDark ? "#2A3027" : "#f1f5f9" },
});
