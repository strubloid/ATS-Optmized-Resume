export type ReviewMode = "review" | "clean" | "source" | "unsupported" | "questionnaire";

export function ReviewModes({ mode, onModeChange }: { mode: ReviewMode; onModeChange: (mode: ReviewMode) => void }) {
  const modes: Array<{ value: ReviewMode; label: string }> = [
    { value: "review", label: "Review mode" },
    { value: "clean", label: "Clean preview" },
    { value: "source", label: "Source comparison" },
    { value: "unsupported", label: "Unsupported requirements" },
    { value: "questionnaire", label: "Evidence questionnaire" }
  ];
  return (
    <div className="mode-tabs" role="tablist" aria-label="Review modes">
      {modes.map((item) => (
        <button key={item.value} className={mode === item.value ? "is-active" : ""} onClick={() => onModeChange(item.value)} data-testid={`mode-${item.value}`}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
