import { create } from "zustand";
import type {
  CompareRow,
  CsvRow,
  SourceItem,
  VariationRules,
  ChangeLogEntry,
} from "@/lib/types";
import { DEFAULT_RULES } from "@/lib/types";

type State = {
  sessionId: string;
  sourceFile: File | null;
  csvFile: File | null;
  sourceItems: SourceItem[];
  csvHeaders: string[];
  csvRows: CsvRow[];
  csvDelimiter: string;
  priceCol: string;
  variationCol: string;
  itemNameCol: string;
  itemTypeCol: string;
  compare: CompareRow[];
  changeLog: ChangeLogEntry[];
  changeLogEnabled: boolean;
  threshold: number;
  rules: VariationRules;
  set: (p: Partial<State>) => void;
  reset: () => void;
  logChange: (entry: Omit<ChangeLogEntry, "id" | "timestamp">) => void;
  clearChangeLog: () => void;
};

const newId = () =>
  "S-" +
  Math.random().toString(36).slice(2, 6).toUpperCase() +
  "-" +
  Date.now().toString(36).slice(-4).toUpperCase();

export const useSession = create<State>((set) => ({
  sessionId: newId(),
  sourceFile: null,
  csvFile: null,
  sourceItems: [],
  csvHeaders: [],
  csvRows: [],
  csvDelimiter: ",",
  priceCol: "",
  variationCol: "",
  itemNameCol: "",
  itemTypeCol: "",
  compare: [],
  changeLog: [],
  changeLogEnabled: true,
  threshold: 75,
  rules: DEFAULT_RULES,
  set: (p) => set(p),
  reset: () =>
    set({
      sessionId: newId(),
      sourceFile: null,
      csvFile: null,
      sourceItems: [],
      csvHeaders: [],
      csvRows: [],
      priceCol: "",
      variationCol: "",
      itemNameCol: "",
      itemTypeCol: "",
      compare: [],
      changeLog: [],
    }),
  logChange: (entry) =>
    set((state) => ({
      changeLog: [
        ...state.changeLog,
        {
          ...entry,
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
        },
      ],
    })),
  clearChangeLog: () => set({ changeLog: [] }),
}));
