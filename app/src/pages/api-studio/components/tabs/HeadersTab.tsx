import KeyValueTable from "../KeyValueTable";
import type { KeyValuePair } from "../../types";

export default function HeadersTab({ headers, onChange }: { headers: KeyValuePair[]; onChange: (rows: KeyValuePair[]) => void }) {
  return <KeyValueTable rows={headers} onChange={onChange} keyPlaceholder="Header name" valuePlaceholder="Header value" />;
}
