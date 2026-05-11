export type SourceItem = { name: string; price: number };

export type CsvRow = Record<string, string>;

export type CompareStatus =
  | "updated"
  | "unchanged"
  | "no-match"
  | "parent"
  | "multi-match";

export type CompareRow = {
  rowIndex: number;
  itemName: string;
  variation: string;
  oldPrice: number;
  newPrice: number;
  status: CompareStatus;
  remarks: string;
  matchedSource?: string;
  matchScore?: number;
};

export type VariationRules = {
  half: number; // % of full
  small: number;
  large: number;
  sixPcs: number;
  withIceCream: number; // additive ₹
};

export const DEFAULT_RULES: VariationRules = {
  half: 55,
  small: 65,
  large: 115,
  sixPcs: 60,
  withIceCream: 25,
};

export type ChangeType =
  | "price_update"
  | "no_change"
  | "manual_mapping"
  | "parent_preserved"
  | "variation_mapped";

export type ChangeLogEntry = {
  id: string;
  timestamp: string;
  itemId: string;
  itemName: string;
  variation: string;
  oldPrice: number;
  newPrice: number;
  changeType: ChangeType;
  matchSource: string;
  matchScore: number;
  variationMapping: string;
  userAction: "auto" | "manual";
};

export type CompareRowWithLog = CompareRow & {
  changeLogId?: string;
};
