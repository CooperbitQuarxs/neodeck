import type { StudioNode } from "../../client/studio";

export type GraphKind = "flow" | "pipeline" | "router" | "classifier" | "boardflow" | "map";
export type BuildableKind = Exclude<GraphKind, "map">;
/** A typed connection point in the graph vocabulary served by /api/graphs/node-types. */
export interface Port { id: string; label: string; type: "event" | "text" | "json" | "decision" | "request" | "any" }
/** One editable configuration field. Values live in StudioNode.config. */
export interface Field { key: string; label: string; control: "text" | "textarea" | "number" | "select" | "model" | "boolean" | "percent" | "cron"; options?: string[]; placeholder?: string; help?: string }
/** Serializable node vocabulary. Icon names are resolved by the canvas, not by the backend. */
export interface NodeType { type: string; kind: GraphKind; label: string; blurb: string; category: string; icon: string; tone?: "engine" | "accent"; inputs: Port[]; outputs: Port[]; fields: Field[] }
const port = (id: string, type: Port["type"], label = id): Port => ({ id, label, type });
const field = (key: string, label: string, control: Field["control"] = "text", options?: string[]): Field => ({ key, label, control, ...(options ? { options } : {}) });
const model = field("model", "Model", "model");
const labels = { ...field("labels", "Labels"), help: "Separate branch labels with commas. Each label creates an output." };
function node(type: string, kind: GraphKind, label: string, blurb: string, category: string, icon: string, inputs: Port[], outputs: Port[], fields: Field[] = [], tone?: NodeType["tone"]): NodeType { return { type, kind, label, blurb, category, icon, inputs, outputs, fields, tone }; }
const input = [port("input", "any", "Input")];
const output = [port("output", "any", "Output")];
export const NODE_TYPES: readonly NodeType[] = [
 ...[
  ["pr_opened", "PR opened", "Start when a pull request opens."], ["inbox_captured", "Inbox captured", "Start with a new inbox item."], ["webhook", "Webhook", "Accept an incoming webhook."], ["schedule", "Schedule", "Run on a cron schedule."], ["message", "Thread message", "Start with a message in a thread."],
 ].map(([id, label, blurb]) => node(`event.${id}`, "pipeline", label!, blurb!, "Triggers", "Zap", [], [port("event", "event", "Event")], id === "schedule" ? [field("cron", "Schedule", "cron")] : [field(id === "message" ? "thread" : "filter", id === "message" ? "Thread" : "Event filter")])),
 node("infer.request", "pipeline", "Request inference", "Ask a model to work on the input.", "Inference", "Cpu", [port("input", "any", "Input"), port("event", "event", "Trigger")], [port("text", "text", "Text")], [model, field("system", "System prompt", "textarea"), { ...field("prompt", "Prompt template", "textarea"), placeholder: "Review {{input}}" }], "engine"),
 node("infer.tidy", "pipeline", "Tidy text", "Clean up the input with a small model.", "Inference", "Cpu", input, [port("text", "text", "Text")], [model, field("prompt", "Instructions", "textarea")], "engine"),
 node("agent.spawn", "pipeline", "Ask an agent", "Give an agent the input and collect its result.", "Inference", "Bot", input, [port("result", "text", "Result")], [field("template", "Template", "select", ["Worker", "Advisor", "Chronicler", "Judge", "Warden", "Blank"]), model], "engine"),
 node("transform.template", "pipeline", "Template", "Build text from the input.", "Transform", "Shuffle", input, [port("text", "text", "Text")], [field("template", "Template", "textarea")]),
 node("transform.extract_json", "pipeline", "Extract JSON", "Read structured data from model output.", "Transform", "Shuffle", [port("text", "text", "Text")], [port("json", "json", "JSON")], [field("path", "JSON path")]),
 node("transform.merge", "pipeline", "Merge", "Combine the results of parallel branches.", "Transform", "Shuffle", [port("a", "any", "First"), port("b", "any", "Second"), port("c", "any", "Third")], [port("merged", "text", "Merged text")], [field("separator", "Separator")]),
 node("route.classify", "pipeline", "Classify", "Ask a question and route to a labelled branch.", "Route", "GitFork", input, [], [model, field("question", "Question", "textarea"), labels], "accent"),
 node("route.if", "pipeline", "Condition", "Choose yes or no from a condition.", "Route", "GitFork", input, [port("yes", "any", "Yes"), port("no", "any", "No")], [field("condition", "Condition", "textarea")]),
 node("route.fanout", "pipeline", "Fan out", "Send the input to several destinations.", "Route", "Route", input, [port("a", "any", "First"), port("b", "any", "Second"), port("c", "any", "Third")]),
 ...[
  ["comment_pr", "Comment on PR", "Post a review comment.", "comment", "Comment"], ["create_card", "Create card", "Put work on a board.", "board", "Board"], ["message_thread", "Message thread", "Send the result to a thread.", "thread", "Thread"], ["file_issue", "File issue", "Create an issue in a repository.", "repository", "Repository"], ["write_note", "Write note", "Save the result in Knowledge.", "path", "Note path"], ["http", "HTTP request", "Send the result to an endpoint.", "url", "URL"],
 ].map(([id, label, blurb, key, title]) => node(`out.${id}`, "pipeline", label!, blurb!, "Output", "Send", input, [], [field(key!, title!, id === "comment_pr" ? "textarea" : "text")])),
 node("router.entry", "router", "Virtual model", "The virtual model the request names.", "Routing", "Route", [], [port("request", "request", "Request")], [field("virtualModel", "Virtual model")]),
 node("router.stage", "router", "Model stage", "Draw from accounts, then demote when exhausted.", "Routing", "Database", [port("request", "request", "Request")], [port("next", "request", "Exhausted")], [model, { ...field("accounts", "Accounts"), help: "Use all or a comma-separated list of account names." }, field("draw", "Draw", "select", ["alternate", "least-used", "fill"]), field("perAccount", "Each account's pool", "percent"), field("cap", "Cap", "percent"), field("per", "Cap applies to", "select", ["user", "all"]), field("window", "Window", "select", ["5h", "day", "week", "month"]), field("effort", "Effort, optional")], "engine"),
 node("router.terminal", "router", "Terminal", "Limit, queue or pass through an exhausted request.", "Routing", "OctagonX", [port("request", "request", "Request")], [], [field("kind", "Outcome", "select", ["limit", "queue", "passthrough"]), field("message", "Message", "textarea")]),
 node("cls.input", "classifier", "Input", "Text to classify.", "Classifier", "Zap", [], [port("text", "text", "Text")], [field("sample", "Sample input", "textarea")]),
 node("cls.ask", "classifier", "Ask a model", "One question, with a branch for every label.", "Classifier", "HelpCircle", [port("text", "text", "Text")], [], [model, field("question", "Question", "textarea"), labels], "engine"),
 node("cls.rule", "classifier", "Match a rule", "Use a keyword or regular expression.", "Classifier", "GitFork", [port("text", "text", "Text")], [port("yes", "any", "Match"), port("no", "any", "No match")], [field("pattern", "Pattern"), field("regex", "Regular expression", "boolean")]),
 node("cls.output", "classifier", "Label", "Return this classification.", "Classifier", "Send", input, [], [field("label", "Label")]),
 node("bf.column", "boardflow", "Column", "A column cards pass through.", "Board flow", "KanbanSquare", input, output, [field("column", "Column name")]),
 node("bf.assign", "boardflow", "Assign an agent", "Give the card to an agent.", "Board flow", "Bot", input, output, [field("template", "Template", "select", ["Worker", "Advisor", "Judge", "Blank"]), model], "engine"),
 node("bf.gate", "boardflow", "Gate", "Wait for evidence before moving on.", "Board flow", "ShieldCheck", input, [port("yes", "any", "Pass"), port("no", "any", "Fail")], [field("condition", "Condition", "select", ["PR opened", "review passed", "tests pass"])]),
 node("bf.notify", "boardflow", "Notify", "Tell someone a card needs attention.", "Board flow", "Send", input, [], [field("who", "Who")]),
 node("bf.done", "boardflow", "Done", "The work has finished.", "Board flow", "ShieldCheck", input, []),
];
export const KIND_LABELS: Record<GraphKind, string> = { flow: "Flow", pipeline: "Pipeline", router: "Router", classifier: "Classifier", boardflow: "Board flow", map: "Map" };
export const BUILDABLE_KINDS: BuildableKind[] = ["flow", "pipeline", "router", "classifier", "boardflow"];
export function nodeType(type: string): NodeType | undefined { return NODE_TYPES.find(n => n.type === type); }
export function nodePorts(node: StudioNode): { inputs: Port[]; outputs: Port[] } {
 const type = nodeType(node.type);
 if (node.type === "route.classify" || node.type === "cls.ask") {
  const labels = String(node.config.labels ?? "yes,no").split(",").map(s => s.trim()).filter(Boolean);
  if (node.type === "cls.ask" && !labels.includes("unsure")) labels.push("unsure");
  return { inputs: type?.inputs ?? [], outputs: [...new Set(labels)].map(label => port(label, "any", label)) };
 }
 return { inputs: type?.inputs ?? [], outputs: type?.outputs ?? [] };
}
export function compatible(a: Port, b: Port): boolean { return a.type === b.type || a.type === "any" || b.type === "any"; }
export function defaultConfig(type: NodeType): Record<string, unknown> {
 const config: Record<string, unknown> = { name: type.label };
 for (const f of type.fields) config[f.key] = f.control === "boolean" ? false : f.control === "number" || f.control === "percent" ? 0 : f.control === "model" ? "neoproxy/small" : f.options?.[0] ?? "";
 if (type.fields.some(f => f.key === "labels")) config.labels = "yes,no,unsure";
 return config;
}
