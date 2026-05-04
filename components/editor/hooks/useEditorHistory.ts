import { useEffect, useRef, useState } from "react";
import type { EditorElement } from "../core/editor-types";
import { cloneElements, sameElements } from "../core/editor-history";

function sanitizeElement(element: EditorElement): EditorElement {
  if (element.type !== "text") return element;

  return {
    ...element,
    height: 0,
    heightMm: undefined,
  };
}

function sanitizeElements(elements: EditorElement[]) {
  return cloneElements(Array.isArray(elements) ? elements : []).map(sanitizeElement);
}

export function useEditorHistory(initialElements: EditorElement[] = []) {
  const cleanInitial = sanitizeElements(initialElements);
  const [elements, setElements] = useState<EditorElement[]>(cleanInitial);
  const elementsRef = useRef<EditorElement[]>(cleanInitial);

  const [history, setHistory] = useState<EditorElement[][]>([]);
  const historyRef = useRef<EditorElement[][]>([]);

  const [future, setFuture] = useState<EditorElement[][]>([]);
  const futureRef = useRef<EditorElement[][]>([]);

  const pendingHistoryRef = useRef<EditorElement[] | null>(null);

  useEffect(() => {
    elementsRef.current = sanitizeElements(elements);
  }, [elements]);

  useEffect(() => {
    historyRef.current = history.map(sanitizeElements);
  }, [history]);

  useEffect(() => {
    futureRef.current = future.map(sanitizeElements);
  }, [future]);

  const applyElements = (next: EditorElement[]) => {
    const safeNext = sanitizeElements(next);
    elementsRef.current = safeNext;
    setElements(safeNext);
  };

  const pushUniqueHistory = (snapshot: EditorElement[]) => {
    const safeSnapshot = sanitizeElements(snapshot);
    const currentHistory = historyRef.current;

    if (
      currentHistory.length > 0 &&
      sameElements(currentHistory[currentHistory.length - 1], safeSnapshot)
    ) {
      return;
    }

    const nextHistory = [...currentHistory, safeSnapshot];
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  };

  const captureHistoryStart = () => {
    if (pendingHistoryRef.current) return;
    pendingHistoryRef.current = sanitizeElements(elementsRef.current);
  };

  const pushHistory = (next: EditorElement[]) => {
    pushUniqueHistory(elementsRef.current);
    futureRef.current = [];
    setFuture([]);
    applyElements(next);
    pendingHistoryRef.current = null;
  };

  const commitHistory = () => {
    if (!pendingHistoryRef.current) return;

    const before = sanitizeElements(pendingHistoryRef.current);
    const after = sanitizeElements(elementsRef.current);

    pendingHistoryRef.current = null;

    if (sameElements(before, after)) return;

    pushUniqueHistory(before);
    futureRef.current = [];
    setFuture([]);
  };

  const undo = () => {
    const currentHistory = historyRef.current;
    if (currentHistory.length === 0) return;

    const current = sanitizeElements(elementsRef.current);
    const last = sanitizeElements(currentHistory[currentHistory.length - 1]);
    const nextHistory = currentHistory.slice(0, -1);
    const nextFuture = [current, ...futureRef.current.map(sanitizeElements)];

    historyRef.current = nextHistory;
    futureRef.current = nextFuture;

    setHistory(nextHistory);
    setFuture(nextFuture);
    applyElements(last);
    pendingHistoryRef.current = null;
  };

  const redo = () => {
    const currentFuture = futureRef.current;
    if (currentFuture.length === 0) return;

    const current = sanitizeElements(elementsRef.current);
    const next = sanitizeElements(currentFuture[0]);
    const restFuture = currentFuture.slice(1);
    const nextHistory = [...historyRef.current, current];

    historyRef.current = nextHistory;
    futureRef.current = restFuture;

    setHistory(nextHistory);
    setFuture(restFuture);
    applyElements(next);
    pendingHistoryRef.current = null;
  };

  return {
    elements,
    elementsRef,
    applyElements,
    pushHistory,
    captureHistoryStart,
    commitHistory,
    undo,
    redo,
  };
}
