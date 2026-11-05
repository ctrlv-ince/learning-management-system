import { useMemo, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, Copy, ImagePlus, Italic, Layers3, Maximize2, Plus, Presentation, Quote, Redo2, Table2, Trash2, Undo2 } from "lucide-react";
import { apiUpload } from "../api.js";
import { useAuth } from "../shared.jsx";
import { buildLessonPresentationPptx, presentationPalettes } from "../presentationBuilder.js";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MAX_SLIDES = 30;
const blankSlide = (title = "New slide", layout = "keypoints") => ({ title, body: "", bullets: "", layout, table: [["", ""], ["", ""], ["", ""]], image: null, titleStyle: {}, bodyStyle: {}, bulletStyle: {} });
const layoutPresets = [
  { id: "cover", label: "Cover", detail: "Strong opening slide", icon: Presentation },
  { id: "keypoints", label: "Key points", detail: "Clear lesson breakdown", icon: Layers3 },
  { id: "split", label: "Two columns", detail: "Explain + emphasize", icon: Layers3 },
  { id: "image", label: "Image focus", detail: "Pair text with a visual", icon: ImagePlus },
  { id: "table", label: "Data table", detail: "Compare information", icon: Table2 },
  { id: "quote", label: "Quote", detail: "Feature a key statement", icon: Quote },
];

function safeFilename(value) {
  return (value || "lesson-presentation")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "lesson-presentation";
}

export default function PresentationBuilder({ lessonId, lessonTitle, onSaved, standalone = false }) {
  const { notify } = useAuth();
  const [open, setOpen] = useState(standalone);
  const [deckTitle, setDeckTitle] = useState(lessonTitle || "Lesson presentation");
  const [theme, setTheme] = useState("forest");
  const [slides, setSlides] = useState(() => [blankSlide(lessonTitle || "Lesson overview", "cover")]);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [active, setActive] = useState(0);
  const [styleTarget, setStyleTarget] = useState("body");
  const [focusMode, setFocusMode] = useState(false);
  const [zoom, setZoom] = useState(100);
  const canvasRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const palette = presentationPalettes[theme] || presentationPalettes.forest;
  const current = slides[active] || slides[0];
  const currentStyle = current[`${styleTarget}Style`] || {};
  const styleDefaultSize = styleTarget === "title"
    ? current.layout === "cover" ? 43 : current.layout === "quote" ? 33 : 30
    : styleTarget === "body"
      ? current.layout === "table" ? 13 : current.layout === "cover" ? 21 : current.layout === "quote" ? 27 : 19
      : current.layout === "cover" ? 16 : current.layout === "quote" ? 15 : 18;
  const defaultStyleColor = styleTarget === "title" && ["cover", "quote"].includes(current.layout)
    ? "#ffffff"
    : styleTarget === "body" && ["cover", "quote"].includes(current.layout)
      ? "#f1f4ef"
      : "#26372d";
  const previewStyle = {
    "--slide-accent": `#${palette.accent}`,
    "--slide-paper": `#${palette.paper}`,
    "--slide-dark": `#${palette.dark}`,
    "--slide-ink": `#${palette.ink}`,
    "--slide-muted": `#${palette.muted}`,
    "--slide-soft": `#${palette.soft}`,
    "--title-size": current.titleStyle?.size || (current.layout === "cover" ? 43 : current.layout === "quote" ? 33 : 30),
    "--title-font": current.titleStyle?.font || "Aptos Display",
    "--title-color": current.titleStyle?.color || (["cover", "quote"].includes(current.layout) ? "#ffffff" : `#${palette.dark}`),
    "--title-align": current.titleStyle?.align || "left",
    "--title-weight": (current.titleStyle?.bold ?? true) ? 700 : 400,
    "--title-style": current.titleStyle?.italic ? "italic" : "normal",
    "--body-size": current.bodyStyle?.size || (current.layout === "cover" ? 21 : current.layout === "quote" ? 27 : 19),
    "--body-font": current.bodyStyle?.font || "Aptos",
    "--body-color": current.bodyStyle?.color || (["cover", "quote"].includes(current.layout) ? "#f1f4ef" : `#${palette.ink}`),
    "--body-align": current.bodyStyle?.align || "left",
    "--body-weight": current.bodyStyle?.bold ? 700 : 400,
    "--body-style": current.bodyStyle?.italic ? "italic" : "normal",
    "--bullet-size": current.bulletStyle?.size || (current.layout === "cover" ? 16 : current.layout === "quote" ? 15 : 18),
    "--bullet-font": current.bulletStyle?.font || "Aptos",
    "--bullet-color": current.bulletStyle?.color || (["cover", "quote"].includes(current.layout) ? "#ffffff" : `#${palette.ink}`),
    "--bullet-align": current.bulletStyle?.align || "left",
    "--bullet-weight": current.bulletStyle?.bold ? 700 : 400,
    "--bullet-style": current.bulletStyle?.italic ? "italic" : "normal",
    "--table-font-size": current.bodyStyle?.size || 13,
    "--table-font-family": current.bodyStyle?.font || "Aptos",
  };
  const validation = useMemo(() => {
    if (!deckTitle.trim()) return "Add a presentation title.";
    const imageBytes = slides.reduce((total, slide) => total + (slide.image?.data?.byteLength || 0), 0);
    if (imageBytes > 11 * 1024 * 1024) return "The selected images are too large for one lesson upload. Remove an image or choose smaller files.";
    for (let index = 0; index < slides.length; index += 1) {
      const slide = slides[index];
      const bullets = slide.bullets.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (slide.title.trim().length < 2) return `Slide ${index + 1} needs a title with at least 2 characters.`;
      const tableHasContent = slide.table?.some((row) => row.some((cell) => cell.trim()));
      if (!slide.body.trim() && !bullets.length && !tableHasContent && !slide.image) return `Add lesson text, a key point, table entry, or image to slide ${index + 1}.`;
      if (bullets.length > 6) return `Slide ${index + 1} can have up to 6 key points.`;
      if (bullets.some((line) => line.length > 180)) return `Keep each key point on slide ${index + 1} under 180 characters.`;
      if (slide.body.length > 1200) return `Keep slide ${index + 1} lesson text under 1,200 characters.`;
    }
    return "";
  }, [deckTitle, slides]);

  function commitSlides(nextSlides) {
    setHistory((state) => ({ past: [...state.past.slice(-39), slides], future: [] }));
    setSlides(nextSlides);
  }

  function updateSlide(key, value) {
    commitSlides(slides.map((slide, index) => index === active ? { ...slide, [key]: value } : slide));
    setError("");
    setSuccess("");
  }

  function updateTextStyle(key, value) {
    commitSlides(slides.map((slide, index) => index === active ? { ...slide, [`${styleTarget}Style`]: { ...(slide[`${styleTarget}Style`] || {}), [key]: value } } : slide));
  }

  function addSlide(layout = "keypoints") {
    if (slides.length >= MAX_SLIDES) return;
    const title = layoutPresets.find((item) => item.id === layout)?.label || `Slide ${slides.length + 1}`;
    const next = [...slides, blankSlide(`${title} ${slides.length + 1}`, layout)];
    commitSlides(next);
    setActive(next.length - 1);
    setError("");
    setSuccess("");
  }

  function updateTableCell(rowIndex, columnIndex, value) {
    commitSlides(slides.map((slide, index) => {
      if (index !== active) return slide;
      return { ...slide, table: slide.table.map((row, rowNumber) => row.map((cell, columnNumber) => rowNumber === rowIndex && columnNumber === columnIndex ? value : cell)) };
    }));
    setError("");
    setSuccess("");
  }

  function resizeTable(axis, amount) {
    commitSlides(slides.map((slide, index) => {
      if (index !== active) return slide;
      const table = slide.table.map((row) => [...row]);
      if (axis === "row" && (amount > 0 ? table.length < 6 : table.length > 2)) {
        if (amount > 0) table.push(Array(table[0].length).fill(""));
        else table.pop();
      }
      if (axis === "column" && (amount > 0 ? table[0].length < 4 : table[0].length > 2)) {
        table.forEach((row) => amount > 0 ? row.push("") : row.pop());
      }
      return { ...slide, table };
    }));
  }

  async function selectSlideImage(file) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Choose a PNG or JPEG image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose an image under 5 MB so the finished deck stays easy to share.");
      return;
    }
    try {
      const image = { name: file.name, type: file.type, data: new Uint8Array(await file.arrayBuffer()), preview: URL.createObjectURL(file) };
      updateSlide("image", image);
    } catch {
      setError("This image could not be read. Try a PNG or JPEG file.");
    }
  }

  function moveSlide(direction) {
    const target = active + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[active], next[target]] = [next[target], next[active]];
    commitSlides(next);
    setActive(target);
  }

  function removeSlide() {
    if (slides.length <= 1) return;
    commitSlides(slides.filter((_, index) => index !== active));
    setActive(Math.max(0, active - 1));
    setError("");
    setSuccess("");
  }

  function duplicateSlide() {
    if (slides.length >= MAX_SLIDES) return;
    const copy = structuredClone(current);
    copy.title = `${current.title} copy`;
    const next = [...slides.slice(0, active + 1), copy, ...slides.slice(active + 1)];
    commitSlides(next);
    setActive(active + 1);
  }

  function undo() {
    if (!history.past.length) return;
    const previous = history.past[history.past.length - 1];
    setHistory((state) => ({ past: state.past.slice(0, -1), future: [slides, ...state.future] }));
    setSlides(previous);
    setActive((index) => Math.min(index, previous.length - 1));
  }

  function redo() {
    if (!history.future.length) return;
    const next = history.future[0];
    setHistory((state) => ({ past: [...state.past, slides], future: state.future.slice(1) }));
    setSlides(next);
    setActive((index) => Math.min(index, next.length - 1));
  }

  async function savePresentation() {
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setProgress(0);
    setError("");
    setSuccess("");
    try {
      const bytes = buildLessonPresentationPptx(slides, theme);
      const file = new File([bytes], `${safeFilename(deckTitle)}.pptx`, { type: PPTX_MIME });
      const form = new FormData();
      form.append("files", file);
      await apiUpload(`/lessons/${lessonId}/materials`, form, { onProgress: setProgress });
      setSuccess("Presentation saved to this lesson and is ready to preview.");
      notify("Presentation added to lesson materials.");
      await onSaved?.();
    } catch (saveError) {
      setError(saveError.message || "Could not save the presentation.");
      notify(saveError.message || "Could not save the presentation.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <section className={`presentation-builder${standalone ? " presentation-builder-standalone" : ""}${focusMode ? " presentation-focus-mode" : ""}`} aria-label="Create a lesson presentation" onKeyDown={(event) => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
      const editingText = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName);
      if ((event.ctrlKey || event.metaKey) && !editingText && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && !editingText && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      if ((event.ctrlKey || event.metaKey) && !editingText && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSlide(); }
    }}>
      {!standalone && <div className="presentation-builder-heading">
        <span className="presentation-builder-icon"><Presentation size={19} /></span>
        <div>
          <strong>Create a presentation</strong>
          <p>Build slides here and save a PowerPoint to the lesson.</p>
        </div>
        <button className="button secondary" type="button" disabled={busy} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? "Close editor" : "Open editor"}
        </button>
      </div>}

      {open && <div className="presentation-editor">
        <div className="presentation-editor-toolbar">
          <label className="presentation-deck-title">
            <span>Presentation title</span>
            <input value={deckTitle} maxLength={100} onChange={(event) => setDeckTitle(event.target.value)} placeholder="e.g. Introduction to probability" />
          </label>
          <label className="presentation-theme-select">
            <span>Slide theme</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value)}>
              <option value="forest">Modulink forest</option>
              <option value="ocean">Ocean</option>
              <option value="clay">Clay</option>
            </select>
          </label>
          {standalone && <div className="presentation-history-actions"><button className="button secondary icon-button" type="button" onClick={undo} disabled={!history.past.length} aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)"><Undo2 size={17} /></button><button className="button secondary icon-button" type="button" onClick={redo} disabled={!history.future.length} aria-label="Redo (Ctrl+Y)" title="Redo (Ctrl+Y)"><Redo2 size={17} /></button></div>}
        </div>

        <details className="presentation-template-library">
          <summary className="presentation-template-heading"><span><b>Slide templates</b><small>Choose a ready-made layout for your next slide.</small></span><span>{slides.length} of {MAX_SLIDES} slides</span></summary>
          <div className="presentation-template-grid">
            {layoutPresets.map(({ id, label, detail, icon: Icon }) => <button className={`presentation-template-card template-${id}`} type="button" key={id} onClick={() => addSlide(id)} disabled={slides.length >= MAX_SLIDES}>
              <span className="template-thumbnail"><i /><i /><i /><Icon size={16} /></span>
              <span className="template-card-copy"><b>{label}</b><small>{detail}</small></span>
              <Plus size={15} className="template-add-icon" />
            </button>)}
          </div>
        </details>

        <div className={`presentation-editor-grid${focusMode ? " is-focus" : ""}`}>
          <div className="presentation-slide-list">
            <div className="presentation-slide-list-heading"><strong>Slides</strong><span>{slides.length} / {MAX_SLIDES}</span></div>
            <div className="presentation-slide-buttons" role="list" aria-label="Presentation slides">
              {slides.map((slide, index) => <button key={index} type="button" role="listitem" className={`presentation-slide-tab ${active === index ? "is-active" : ""}`} onClick={() => setActive(index)}>
                <span className={`presentation-slide-mini mini-${slide.layout}`}><i /><i /><i /></span>
                <span className="presentation-slide-number">{String(index + 1).padStart(2, "0")}</span>
                <span>{slide.title.trim() || "Untitled slide"}</span>
              </button>)}
            </div>
            <button className="button secondary presentation-add-slide" type="button" onClick={() => addSlide("keypoints")} disabled={slides.length >= MAX_SLIDES}><Plus size={16} /> Add blank slide</button>
            <button className="button secondary presentation-add-slide" type="button" onClick={duplicateSlide} disabled={slides.length >= MAX_SLIDES} title="Duplicate slide (Ctrl+D)"><Copy size={15} /> Duplicate slide</button>
          </div>

          <div className="presentation-slide-editor">
            <div className="presentation-slide-editor-top">
              <span className="eyebrow">SLIDE {String(active + 1).padStart(2, "0")} SETTINGS</span>
              <div className="presentation-slide-actions">
                <button className="button secondary icon-button" type="button" onClick={() => moveSlide(-1)} disabled={active === 0 || busy} aria-label="Move slide up"><ArrowUp size={16} /></button>
                <button className="button secondary icon-button" type="button" onClick={() => moveSlide(1)} disabled={active === slides.length - 1 || busy} aria-label="Move slide down"><ArrowDown size={16} /></button>
                <button className="button danger icon-button" type="button" onClick={removeSlide} disabled={slides.length <= 1 || busy} aria-label="Delete slide"><Trash2 size={16} /></button>
              </div>
            </div>
            <label><span>Slide title</span><input value={current.title} maxLength={100} onChange={(event) => updateSlide("title", event.target.value)} placeholder="Name this slide" /></label>
            <label><span>Slide layout</span><select value={current.layout} onChange={(event) => updateSlide("layout", event.target.value)}>{layoutPresets.map((layout) => <option value={layout.id} key={layout.id}>{layout.label}</option>)}</select></label>
            {current.layout !== "table" && <label><span>{current.layout === "quote" ? "Featured statement" : "Lesson text"} <small>Optional</small></span><textarea value={current.body} maxLength={1200} rows={4} onChange={(event) => updateSlide("body", event.target.value)} placeholder={current.layout === "quote" ? "Write the statement you want students to remember." : "Add a short explanation. Use a new line for a new paragraph."} /> </label>}
            {!["cover", "quote", "table"].includes(current.layout) && <label><span>Key points <small>One per line, up to 6</small></span><textarea value={current.bullets} rows={4} onChange={(event) => updateSlide("bullets", event.target.value)} placeholder={"Define the main idea\nShow an example\nExplain why it matters"} /></label>}
            {current.layout === "quote" && <label><span>Attribution <small>Optional</small></span><input value={current.bullets} maxLength={180} onChange={(event) => updateSlide("bullets", event.target.value)} placeholder="Author, source, or lesson" /></label>}
            <div className="presentation-format-inspector">
              <div className="presentation-format-heading"><span>Text formatting</span><small>Style a text area</small></div>
              <div className="presentation-format-targets" role="group" aria-label="Choose text to format">
                {[{ id: "title", label: "Title" }, { id: "body", label: current.layout === "table" ? "Table text" : "Body" }, { id: "bullet", label: current.layout === "quote" ? "Attribution" : "Key points" }].map((target) => <button key={target.id} className={styleTarget === target.id ? "is-active" : ""} type="button" onClick={() => setStyleTarget(target.id)}>{target.label}</button>)}
              </div>
              <div className="presentation-format-grid">
                <label><span>Font</span><select value={currentStyle.font || (styleTarget === "title" ? "Aptos Display" : "Aptos")} onChange={(event) => updateTextStyle("font", event.target.value)}><option>Aptos</option><option>Aptos Display</option><option>Arial</option><option>Georgia</option><option>Verdana</option></select></label>
                <label><span>Size</span><select value={currentStyle.size || styleDefaultSize} onChange={(event) => updateTextStyle("size", Number(event.target.value))}>{[12, 14, 16, 18, 20, 21, 24, 27, 28, 30, 32, 33, 36, 40, 43, 44, 48].map((size) => <option value={size} key={size}>{size} pt</option>)}</select></label>
                <div className="presentation-format-buttons"><button type="button" className={`button secondary icon-button${(currentStyle.bold ?? styleTarget === "title") ? " is-selected" : ""}`} onClick={() => updateTextStyle("bold", !(currentStyle.bold ?? styleTarget === "title"))} aria-pressed={currentStyle.bold ?? styleTarget === "title"} aria-label="Bold"><Bold size={16} /></button><button type="button" className={`button secondary icon-button${currentStyle.italic ? " is-selected" : ""}`} onClick={() => updateTextStyle("italic", !currentStyle.italic)} aria-pressed={Boolean(currentStyle.italic)} aria-label="Italic"><Italic size={16} /></button></div>
                <div className="presentation-format-buttons align-format-buttons"><button type="button" className={`button secondary icon-button${(currentStyle.align || "left") === "left" ? " is-selected" : ""}`} onClick={() => updateTextStyle("align", "left")} aria-label="Align left"><AlignLeft size={16} /></button><button type="button" className={`button secondary icon-button${currentStyle.align === "center" ? " is-selected" : ""}`} onClick={() => updateTextStyle("align", "center")} aria-label="Align center"><AlignCenter size={16} /></button><button type="button" className={`button secondary icon-button${currentStyle.align === "right" ? " is-selected" : ""}`} onClick={() => updateTextStyle("align", "right")} aria-label="Align right"><AlignRight size={16} /></button></div>
                <label className="presentation-format-color"><span>Text color</span><input type="color" value={currentStyle.color || defaultStyleColor} onChange={(event) => updateTextStyle("color", event.target.value)} /></label>
              </div>
            </div>
            {current.layout === "image" && <div className="presentation-image-tools">
              <div className="presentation-image-tools-title"><span><ImagePlus size={16} /> Slide image</span><small>PNG or JPEG · max 5 MB</small></div>
              {current.image ? <div className="presentation-image-selected"><img src={current.image.preview} alt="Selected slide artwork preview" /><span><b>{current.image.name}</b><small>Included in the exported PPTX</small></span><button className="button danger" type="button" onClick={() => updateSlide("image", null)}>Remove</button></div> : <label className="presentation-image-drop"><ImagePlus size={20} /><span><b>Choose an image</b><small>It will be embedded in the PowerPoint file.</small></span><input type="file" accept="image/png,image/jpeg" onChange={(event) => { selectSlideImage(event.target.files?.[0]); event.target.value = ""; }} /></label>}
            </div>}
            {current.layout === "table" && <div className="presentation-table-tools">
              <div className="presentation-table-tools-heading"><span><Table2 size={16} /> Build a table</span><span className="presentation-table-size">{current.table.length} rows · {current.table[0].length} columns</span></div>
              <div className="presentation-table-dimensions"><button type="button" className="button secondary" onClick={() => resizeTable("row", 1)} disabled={current.table.length >= 6}>+ Row</button><button type="button" className="button secondary" onClick={() => resizeTable("row", -1)} disabled={current.table.length <= 2}>− Row</button><button type="button" className="button secondary" onClick={() => resizeTable("column", 1)} disabled={current.table[0].length >= 4}>+ Column</button><button type="button" className="button secondary" onClick={() => resizeTable("column", -1)} disabled={current.table[0].length <= 2}>− Column</button></div>
              <div className="presentation-table-edit" style={{ "--table-columns": current.table[0].length }}>{current.table.map((row, rowIndex) => row.map((cell, columnIndex) => <input key={`${rowIndex}-${columnIndex}`} aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`} className={rowIndex === 0 ? "is-header-cell" : ""} maxLength={100} value={cell} onChange={(event) => updateTableCell(rowIndex, columnIndex, event.target.value)} placeholder={rowIndex === 0 ? `Header ${columnIndex + 1}` : "Cell text"} />))}</div>
            </div>}
            <div className="presentation-field-hint">{current.body.length} / 1,200 characters</div>
          </div>

          <div className="presentation-canvas-column">
            <div className="presentation-canvas-toolbar"><div><strong>Slide canvas</strong><span>{String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span></div><div className="presentation-canvas-actions"><button className="button secondary icon-button" type="button" onClick={() => setFocusMode((value) => !value)} aria-pressed={focusMode} title={focusMode ? "Show slide list and inspector" : "Focus on slide"}><Maximize2 size={16} /></button><select aria-label="Canvas zoom" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>{[60, 75, 90, 100, 110, 125, 150].map((value) => <option key={value} value={value}>{value}%</option>)}</select><button className="button secondary icon-button" type="button" onClick={() => canvasRef.current?.requestFullscreen?.()} title="Full screen canvas"><Maximize2 size={16} /></button></div></div>
            <div className="presentation-canvas-stage" ref={canvasRef}>
            <div className="presentation-preview-wrap" style={{ width: `${zoom}%` }}>
            <div className={`presentation-preview presentation-preview-${current.layout}`} style={previewStyle}>
              <div className="presentation-preview-accent" />
              <div className="presentation-preview-kicker">{active === 0 ? "MODULINK LEARNING / LESSON PRESENTATION" : `LESSON ${String(active + 1).padStart(2, "0")} / MODULINK LEARNING`}</div>
              <h3>{current.title.trim() || "Your slide title"}</h3>
              {current.layout === "table" ? <div className="presentation-preview-table" style={{ "--table-columns": current.table[0].length }}>{current.table.map((row, rowIndex) => row.map((cell, columnIndex) => <span className={rowIndex === 0 ? "is-header-cell" : ""} key={`${rowIndex}-${columnIndex}`}>{cell || (rowIndex === 0 ? `Header ${columnIndex + 1}` : "Cell")}</span>))}</div> : current.layout === "image" ? <div className="presentation-preview-image-layout">{current.image ? <img src={current.image.preview} alt="Slide image preview" /> : <div className="presentation-preview-image-placeholder"><ImagePlus size={24} /><span>Add a visual</span></div>}<div>{current.body.trim() && <p>{current.body}</p>}{current.bullets.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 4).map((line, index) => <div className="presentation-preview-bullet" key={`${index}-${line}`}><i />{line}</div>)}</div></div> : current.layout === "quote" ? <><p>{current.body || "Your featured statement appears here."}</p>{current.bullets && <div className="presentation-preview-attribution">— {current.bullets}</div>}</> : <>{current.body.trim() && <p>{current.body}</p>}{current.bullets.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 6).map((line, index) => <div className="presentation-preview-bullet" key={`${index}-${line}`}><i />{line}</div>)}</>}
              <span className="presentation-preview-count">{String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
            </div>
            </div></div>
          </div>
        </div>

        {progress !== null && <div className="upload-progress" role="status" aria-live="polite"><div className="upload-progress-label"><span>{progress >= 100 ? "Saving presentation to lesson…" : "Uploading presentation…"}</span><span>{progress}%</span></div><progress max="100" value={progress} aria-label="Presentation upload progress" /></div>}
        {error && <p className="upload-error" role="alert">{error}</p>}
        {success && <p className="upload-success" role="status">{success}</p>}
        <div className="presentation-save-row"><span>Give each slide a title and some content. Images are limited to 5 MB each.</span><button className="button primary" type="button" onClick={savePresentation} disabled={busy}>{busy ? "Saving…" : "Save presentation to lesson"}</button></div>
      </div>}
    </section>
  );
}
