import {
  Tabs,
  TabsIndicator,
  TabsList,
  TabsTrigger,
  TabsTriggerText,
} from "@/components/ui/tabs";

interface PdfLayoutTabsProps {
  onColumnsChange: (columns: 1 | 2 | 3) => void;
}

export default function PdfLayoutTabs({
  onColumnsChange,
}: PdfLayoutTabsProps) {
  return (
    <Tabs
      defaultValue="1"
      onValueChange={(value: string) => {
        const columns = Number(value) as 1 | 2 | 3;

        onColumnsChange(columns);
      }}
    >
      <TabsList>
        <TabsTrigger value="1">
          <TabsTriggerText>1</TabsTriggerText>
        </TabsTrigger>

        <TabsTrigger value="2">
          <TabsTriggerText>2</TabsTriggerText>
        </TabsTrigger>

        <TabsTrigger value="3">
          <TabsTriggerText>3</TabsTriggerText>
        </TabsTrigger>

        <TabsIndicator />
      </TabsList>
    </Tabs>
  );
}