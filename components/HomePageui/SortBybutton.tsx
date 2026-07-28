import { ChevronDownIcon } from '@/components/ui/icon';
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from '@/components/ui/select';

export default function SortButton() {
  return (
    <Select>
      <SelectTrigger variant="outline" size="md">
        <SelectInput placeholder="Select option" />
        <SelectIcon className="mr-3" as={ChevronDownIcon} />
      </SelectTrigger>
      <SelectPortal>
        <SelectBackdrop />
        <SelectContent>
          <SelectDragIndicatorWrapper>
            <SelectDragIndicator />
          </SelectDragIndicatorWrapper>
          <SelectItem label="Date added (newest)" value="ux" />
          <SelectItem label="Date added (oldest)" value="web" />
          <SelectItem
            label="closest to finishing"
            value="Cross Platform Development Process"
          />
          <SelectItem label="Furthest to finishing" value="ui" />
        </SelectContent>
      </SelectPortal>
    </Select>
  );
}
