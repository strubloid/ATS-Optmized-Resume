# Better Ask AI Rewrites

## Goal

The feature produces a paste-ready resume rewrite, not an analysis of a rewrite. A user should be able to choose an option without first removing AI caveats or translating generic language into their own voice.

## Prompt Design

- Give the model one specific task: rewrite the selected bullet using the supplied evidence.
- Separate immutable instructions from the candidate data with system and user messages.
- Require structured output and validate it on the server before showing it.
- Constrain the output to a resume bullet: one sentence, active voice, factual, concise, and ready to paste.
- Name prohibited meta-language explicitly. Phrases such as "confirm", "do not", "transferable", and "relevant to" belong in an editor's reasoning, never in a candidate's CV.
- Use the job requirement only to select emphasis. It is not evidence that the candidate held a title or used a technology.
- Include a close, factual example to demonstrate the desired style. Few-shot examples are more reliable than an abstract direction to "sound human".

## Evidence Rules

- Preserve facts from the selected text and supplied resume evidence only.
- Never infer technologies, titles, metrics, employers, dates, ownership, or outcomes.
- If no grounded rewrite can be produced, return an error and ask the user to try again. Do not manufacture a generic fallback that sounds like an AI disclaimer.

## Sources

- OpenAI, [Prompt engineering](https://platform.openai.com/docs/guides/prompt-engineering): use clear role-based instructions, structured outputs, relevant context, and few-shot examples.
- Anthropic, [Prompting best practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct): make constraints explicit, use examples to control tone and format, and structure context clearly.
