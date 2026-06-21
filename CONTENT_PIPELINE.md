# Content Pipeline

How uploaded material becomes a structured course and study content.

## Flow

```
UploadModal → processUpload()  [in src/store/useStore.ts]
  → extractFileContent() per file  [PDF text · DOCX · TXT/MD · image + scanned-PDF OCR]
  → generateCourseOutline() [LLM, if proxy/key]
  → analyzeContentToOutlineAsync() [offline; embedding-cluster topics when embeddings available]
  → analyzeContentToOutline() [offline; deterministic lexical fallback]
  → buildCourseFromOutline() | mergeOutlineIntoCourse() [extend mode]
  → buildConceptSpans() [sentence-level source provenance]
  → mergeCourseTasks()
  → skill nodes + beta mastery init
  → persistLibrary()
```

## Offline engine (`contentAnalysis.ts`)

- Section detection, RAKE + TextRank keyphrases
- Definition extraction, prerequisite inference
- Embedding-based topic clustering (`embeddingCluster.ts`) when embeddings are available, with deterministic lexical fallback
- Hybrid NER (`entityExtract.ts`) and concept→section binding (`conceptSectionBinding.ts`)
- `analyzeContentToOutline()` / `analyzeContentToOutlineAsync()` — no API key required

## LLM path (`courseGenerator.ts`)

- Used when `useLlm !== false` and proxy/key available
- Richer topics, objectives, glossary

## Source modes

| Mode | Behavior |
|------|----------|
| `strict` | Notes only — minimize enrichment |
| `enriched` | Notes primary + optional LLM enrichment |
| `notes-only` | Structure from notes, no additions |

## Incremental upload

Upload modal → **Extend existing course** → `mergeOutlineIntoCourse()` merges topics/glossary by normalized title.

## Limitations

- YouTube URLs: **transcripts ingested** via the server proxy `/v1/youtube/transcript` — captions are parsed (manual track preferred, ASR fallback) and the resulting text feeds the same outline → course pipeline as text uploads. The video metadata is preserved on the file row; the transcript becomes `extractedText` for chunking + RAG.
- Images / scanned PDFs: **OCR is wired** — `ocrExtract.ts` rasterizes pages and runs Tesseract.js, either in-browser or via the server proxy `POST /v1/ocr/pages` (languages `eng+ell`, capped at `OCR_MAX_PAGES`, default 15). Extracted text feeds the same outline → course pipeline.
- Audio: UI types only — Whisper transcription remains on the roadmap (not wired).
- Re-upload without extend mode creates a **new** course
- PDF page boundaries are preserved as `\f` (form-feed) so RAG citations resolve to `p.X`. PPTX slides use the same convention.

See [ARCHITECTURE.md](ARCHITECTURE.md) for module index.
