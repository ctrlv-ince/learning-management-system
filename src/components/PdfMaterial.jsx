import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export default function PdfMaterial({ file }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdf, setPdf] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [stageWidth, setStageWidth] = useState(800);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const stageRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!previewOpen) return undefined;
    const controller = new AbortController();
    let loadingTask;
    let loadedPdf;

    async function loadPdf() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(file.url, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "This PDF is missing from lesson storage. Ask your faculty member to upload it again."
              : `The PDF could not be loaded (${response.status}). Try opening the original file.`,
          );
        }
        const data = new Uint8Array(await response.arrayBuffer());
        loadingTask = pdfjs.getDocument({ data });
        loadedPdf = await loadingTask.promise;
        if (controller.signal.aborted) {
          await loadedPdf.destroy();
          return;
        }
        setPdf(loadedPdf);
        setPageNumber(1);
      } catch (loadError) {
        if (!controller.signal.aborted)
          setError(loadError.message || "This PDF could not be opened.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadPdf();
    return () => {
      controller.abort();
      if (loadedPdf) void loadedPdf.destroy();
      else if (loadingTask) void loadingTask.destroy();
    };
  }, [file.url, previewOpen]);

  useEffect(() => {
    if (!previewOpen || !stageRef.current) return undefined;
    const stage = stageRef.current;
    const updateWidth = () => setStageWidth(stage.clientWidth || 800);
    updateWidth();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }
    const observer = new ResizeObserver(updateWidth);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [previewOpen]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return undefined;
    let renderTask;
    let cancelled = false;

    async function renderPage() {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.6, Math.max(0.5, (stageWidth - 36) / baseViewport.width));
        const viewport = page.getViewport({ scale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) throw new Error("Your browser could not draw the PDF page.");
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
        });
        await renderTask.promise;
      } catch (renderError) {
        if (!cancelled && renderError.name !== "RenderingCancelledException")
          setError(renderError.message || "This PDF page could not be rendered.");
      }
    }

    renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, stageWidth]);

  return (
    <section className={`pdf-material${previewOpen ? " is-open" : ""}`}>
      <div className="material-link pdf-material-heading">
        <span className="material-file"><FileText size={15} /></span>
        <span>
          <b>{file.name}</b>
          <small>{(file.size / 1024 / 1024).toFixed(1)} MB · PDF document</small>
        </span>
        <button
          className="button secondary pdf-preview-toggle"
          type="button"
          aria-expanded={previewOpen}
          onClick={() => setPreviewOpen((open) => !open)}
        >
          {previewOpen ? "Close preview" : "View PDF"}
          {previewOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
        <a
          className="pdf-open-link"
          href={file.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${file.name} in a new tab`}
          title="Open PDF in a new tab"
        >
          <ArrowUpRight size={16} />
        </a>
      </div>
      {previewOpen && (
        <div className="pdf-preview-frame">
          {loading ? (
            <div className="pdf-reader-state" role="status">Loading PDF…</div>
          ) : error ? (
            <div className="pdf-reader-state pdf-reader-error" role="alert">
              <p>{error}</p>
              <a href={file.url} target="_blank" rel="noreferrer">Open original PDF</a>
            </div>
          ) : pdf ? (
            <>
              <div className="pdf-reader-toolbar">
                <button type="button" className="pdf-page-button" disabled={pageNumber <= 1} onClick={() => setPageNumber((page) => Math.max(1, page - 1))}>
                  <ChevronLeft size={17} /> Previous
                </button>
                <span aria-live="polite">Page {pageNumber} of {pdf.numPages}</span>
                <button type="button" className="pdf-page-button" disabled={pageNumber >= pdf.numPages} onClick={() => setPageNumber((page) => Math.min(pdf.numPages, page + 1))}>
                  Next <ChevronRight size={17} />
                </button>
              </div>
              <div className="pdf-canvas-stage" ref={stageRef}>
                <canvas ref={canvasRef} aria-label={`${file.name}, page ${pageNumber}`} />
              </div>
            </>
          ) : (
            <div className="pdf-reader-state" role="status">Preparing PDF reader…</div>
          )}
        </div>
      )}
    </section>
  );
}
