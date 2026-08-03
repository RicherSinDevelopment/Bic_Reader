import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBackdrop,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
} from '@/components/ui/drawer';
import { Heading } from '@/components/ui/heading';
import { CloseIcon, Icon, MenuIcon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

export type ReaderChapter = {
  id: string;
  blockId?: string;
  title: string;
  page: number;
  children?: ReaderChapter[];
};

type OutlineRow = { chapter: ReaderChapter; depth: number };

type Props = {
  chapters?: ReaderChapter[];
  currentPage?: number;
  totalPages?: number;
  onGoToPage?: (page: number) => void;
  onGoToChapter?: (chapter: ReaderChapter) => void;
};

export default function ThreeLinesButton({
  chapters = [],
  currentPage = 1,
  totalPages = 0,
  onGoToPage,
  onGoToChapter,
}: Props) {
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [pageInput, setPageInput] = React.useState(String(currentPage));
  const [expandedChapterIds, setExpandedChapterIds] = React.useState<string[]>([]);

  const goToPage = () => {
    const requested = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(requested) || totalPages < 1) {
      setPageInput(String(currentPage));
      return;
    }
    const page = Math.max(1, Math.min(requested, totalPages));
    setPageInput(String(page));
    setShowDrawer(false);
    requestAnimationFrame(() => onGoToPage?.(page));
  };

  const outlineRows = React.useMemo<OutlineRow[]>(() => {
    const rows: OutlineRow[] = [];
    const append = (items: ReaderChapter[], depth: number) => items.forEach((chapter) => {
      rows.push({ chapter, depth });
      if (expandedChapterIds.includes(chapter.id)) append(chapter.children ?? [], depth + 1);
    });
    append(chapters, 0);
    return rows;
  }, [chapters, expandedChapterIds]);

  const renderChapter = React.useCallback(({ item }: { item: OutlineRow }) => {
    const { chapter, depth } = item;
    const hasChildren = Boolean(chapter.children?.length);
    const isExpanded = expandedChapterIds.includes(chapter.id);
    return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${chapter.title}, page ${chapter.page}`}
      onPress={() => {
        if (hasChildren && !isExpanded) {
          setExpandedChapterIds((current) => [...current, chapter.id]);
          return;
        }
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
      {depth > 0
        ? <View style={styles.sectionMarker} />
        : <BookOpen size={17} color="#64748b" />}
      <Text className="flex-1 text-sm text-black" numberOfLines={2}>
        {chapter.title}
      </Text>
      <Text className="text-xs text-black/45">{chapter.page}</Text>
      {hasChildren && (isExpanded
        ? <ChevronDown size={16} color="#64748b" />
        : <ChevronRight size={16} color="#64748b" />)}
    </Pressable>
  );
  }, [expandedChapterIds, onGoToChapter]);

  return (
    <>
      {/* Menu Button */}
      <Button
        variant="outline"
        size="sm"
        className="h-12 w-12 rounded-xl p-3"
        onPress={() => {
          setPageInput(String(currentPage));
          setShowDrawer(true);
        }}
      >
        <Icon as={MenuIcon} size="md" />
      </Button>

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
            <Heading
              size="lg"
              className="text-foreground font-semibold"
            >
              Table of contents
            </Heading>

            <DrawerCloseButton>
              <Icon
                as={CloseIcon}
                className="stroke-foreground"
                size="lg"
              />
            </DrawerCloseButton>
          </DrawerHeader>

          {totalPages > 0 && (
            <View style={styles.pageControl}>
                <Text className="font-lato-bold text-sm text-black/70">Page</Text>
                <View style={styles.pageRow}>
                  <TextInput
                    value={pageInput}
                    onChangeText={setPageInput}
                    onSubmitEditing={goToPage}
                    keyboardType="number-pad"
                    returnKeyType="go"
                    selectTextOnFocus
                    accessibilityLabel="Page number"
                    style={styles.pageInput}
                  />
                  <Text className="text-base text-black/60">of {totalPages}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Go to page ${pageInput}`}
                    onPress={goToPage}
                    style={styles.goButton}
                  >
                    <ChevronRight size={20} color="#ffffff" />
                  </Pressable>
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
              <Text className="px-5 py-6 text-sm text-black/50">
                This PDF does not contain an embedded table of contents.
              </Text>
            }
          />
        </DrawerContent>
      </Drawer>
    </>
  );
}

const styles = StyleSheet.create({
  pageControl: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 14, backgroundColor: '#f1f5f9' },
  pageRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageInput: { width: 72, height: 42, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, backgroundColor: '#ffffff', textAlign: 'center', fontSize: 16, color: '#0f172a' },
  goButton: { marginLeft: 'auto', width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#719b79' },
  chapterList: { paddingHorizontal: 12, paddingBottom: 24 },
  chapter: { height: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  section: { height: 52, paddingLeft: 14 },
  sectionMarker: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#94a3b8' },
  pressed: { backgroundColor: '#f1f5f9' },
});

