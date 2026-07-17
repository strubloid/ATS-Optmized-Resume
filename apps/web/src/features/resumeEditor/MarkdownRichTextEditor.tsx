import { useEffect, useRef, useState } from "react";
import { Button } from "../../shared/ui/Button";
import { TextAreaField } from "../../shared/ui/Field";
import { htmlToMarkdown, markdownToHtml } from "./markdownRichText";

type Mode = "markdown" | "richtext";

interface MarkdownRichTextEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  rows?: number;
  label?: string;
}

export function MarkdownRichTextEditor({ value, onChange, rows = 22, label = "resume.md" }: MarkdownRichTextEditorProps) {
  const [mode, setMode] = useState<Mode>("markdown");
  const [markdownDraft, setMarkdownDraft] = useState(value);
  const [copyStatus, setCopyStatus] = useState("");
  const lastSyncedValue = useRef(value);
  const editableRef = useRef<HTMLDivElement | null>(null);
  const skipNextInputRef = useRef(false);

  useEffect(() => {
    if (value === lastSyncedValue.current) return;
    setMarkdownDraft(value);
    lastSyncedValue.current = value;
    if (editableRef.current && mode === "richtext") {
      skipNextInputRef.current = true;
      editableRef.current.innerHTML = markdownToHtml(value);
    }
  }, [value, mode]);

  useEffect(() => {
    if (mode !== "richtext" || !editableRef.current) return;
    skipNextInputRef.current = true;
    editableRef.current.innerHTML = markdownToHtml(markdownDraft);
  }, [mode]);

  function commitMarkdown(next: string) {
    setMarkdownDraft(next);
    onChange(next);
    lastSyncedValue.current = next;
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "markdown" && editableRef.current) {
      const md = htmlToMarkdown(editableRef.current.innerHTML);
      commitMarkdown(md);
    }
    setMode(next);
  }

  function handleRichTextInput() {
    if (skipNextInputRef.current) {
      skipNextInputRef.current = false;
      return;
    }
    if (!editableRef.current) return;
    commitMarkdown(htmlToMarkdown(editableRef.current.innerHTML));
  }

  function flashCopyStatus(message: string) {
    setCopyStatus(message);
    window.setTimeout(() => setCopyStatus(""), 2000);
  }

  async function copyAsMarkdown() {
    try {
      await navigator.clipboard.writeText(markdownDraft);
      flashCopyStatus("Copied as Markdown");
    } catch {
      flashCopyStatus("Copy as Markdown failed");
    }
  }

  async function copyAsRichText() {
    const html = markdownToHtml(markdownDraft);
    const text = markdownDraft;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" })
          })
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      flashCopyStatus("Copied as Rich Text");
    } catch {
      flashCopyStatus("Copy as Rich Text failed");
    }
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-editor-toolbar" role="toolbar" aria-label="Editor toolbar">
        <div className="rich-text-editor-modes" role="tablist" aria-label="Editor mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "markdown"}
            className={mode === "markdown" ? "is-active" : ""}
            onClick={() => switchMode("markdown")}
            data-testid="editor-mode-markdown"
          >Markdown</button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "richtext"}
            className={mode === "richtext" ? "is-active" : ""}
            onClick={() => switchMode("richtext")}
            data-testid="editor-mode-richtext"
          >Rich Text</button>
        </div>
        <div className="rich-text-editor-actions">
          <Button variant="quiet" onClick={copyAsMarkdown} data-testid="editor-copy-markdown">Copy as Markdown</Button>
          <Button variant="quiet" onClick={copyAsRichText} data-testid="editor-copy-richtext">Copy as Rich Text</Button>
        </div>
      </div>
      {mode === "markdown" ? (
        <TextAreaField
          label={label}
          value={markdownDraft}
          rows={rows}
          onChange={(event) => commitMarkdown(event.target.value)}
        />
      ) : (
        <label className="field">
          <span>{label}</span>
          <div
            ref={editableRef}
            className="rich-text-editor-surface"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            data-testid="editor-richtext-surface"
            onInput={handleRichTextInput}
            onBlur={handleRichTextInput}
          />
        </label>
      )}
      {copyStatus ? <p className="status-line" data-testid="editor-copy-status">{copyStatus}</p> : null}
    </div>
  );
}
