"use client";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";
import type { EditorElement, ElementType, TextRole } from "./editor-types";
import { supabase } from "@/lib/supabase";
import { buildAiElements } from "./build-ai-elements";
import { cloneElements, sameElements } from "./editor-history";
import { checkAccess, registerUser } from "@/lib/api-client";
import FontPreviewDropdown from "./FontPreviewDropdown";
import CanvasItem from "./CanvasItem";
import ToolbarButton from "./ToolbarButton";
import RegisterModal from "./RegisterModal";
import { createTextElement, createLineElement } from "./editor-elements";
import { validateDocSize } from "./validate-doc-size";
import { checkFreeUsage } from "./check-free-usage";
import { validateBeforeAI } from "./validate-before-ai";

import {
  getRoleLayoutConfig,
  fitFontSizeSmart,
  measureTextHeightForFont,
} from "./editor-typography";
import {
  SNAP_DISTANCE,
  GUIDE_COLOR,
  EXPORT_DPI,
  clamp,
  makeId,
  fitFontSize,
  mmToPx,
  pxToMm,
  getPreviewScale,
  parseMm,
} from "./editor-utils";
import {
  getLayoutPosition,
  getPositionXY,
  type LayoutPosition,
  type LayoutType,
} from "./layout-engine";
import {
  Undo2,
  Redo2,
  Type,
  Minus,
  Plus,
  Printer,
  ImagePlus,
  Wand2,
  PanelTopClose,
  X,
  Move,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
} from "lucide-react";

function getSafeAreaFitMaxFontSize({
  text,
  widthPx,
  currentX,
  currentY,
  docWidth,
  docHeight,
  previewSafe,
  fontWeight,
  lineHeight,
  fontFamily,
  role,
}: {
  text: string;
  widthPx: number;
  currentX: number;
  currentY: number;
  docWidth: number;
  docHeight: number;
  previewSafe: number;
  fontWeight: number;
  lineHeight: number;
  fontFamily?: string;
  role?: TextRole;
}) {
  const safeLeft = previewSafe;
  const safeRight = docWidth - previewSafe;
  const safeTop = previewSafe;
  const safeBottom = docHeight - previewSafe;

  const clampedX = Math.max(currentX, safeLeft);
  const clampedY = Math.max(currentY, safeTop);

  const allowedWidth = Math.min(widthPx, safeRight - clampedX);
  const allowedHeight = safeBottom - clampedY;

  if (allowedWidth <= 40 || allowedHeight <= 40) {
    return role === "contact" ? 24 : 40;
  }

  let low = role === "contact" ? 12 : 16;
  let high = 4000;
  let best = low;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    const h = measureTextHeightForFont(
      text,
      allowedWidth,
      mid,
      fontWeight,
      lineHeight,
      fontFamily, // 🔥 ЭНД ДАМЖУУЛЖ БАЙГАА
    );

    if (h <= allowedHeight) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}
function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  onStart,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  onStart?: () => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span>
        {label}: {step < 1 ? value.toFixed(2) : Math.round(value)}
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onPointerDown={onStart}
        onMouseDown={onStart}
        onTouchStart={onStart}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onPointerUp={onCommit}
      />
    </label>
  );
}

function SafeColorInput({
  value,
  onChange,
  onCommit,
  onStart,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  onStart?: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-11 w-full rounded-xl border border-slate-200 bg-white" />
    );
  }

  return (
    <input
      type="color"
      value={value}
      onPointerDown={onStart}
      onMouseDown={onStart}
      onFocus={onStart}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      className="h-11 w-full rounded-xl border border-slate-200 p-1"
      suppressHydrationWarning
    />
  );
}

export default function EditorShell() {
  const [doc, setDoc] = useState<{
    widthMm: string | number;
    heightMm: string | number;
    bleedMm: number;
    safeMm: number;
  }>({
    widthMm: "",
    heightMm: "",
    bleedMm: 5,
    safeMm: 20,
  });

  const widthInputRef = useRef<HTMLInputElement | null>(null);
  const heightInputRef = useRef<HTMLInputElement | null>(null);
  const [sizeError, setSizeError] = useState<{
    width?: string;
    height?: string;
  }>({});

  const [elements, setElements] = useState<EditorElement[]>([]);
  const elementsRef = useRef<EditorElement[]>([]);

  const [history, setHistory] = useState<EditorElement[][]>([]);
  const historyRef = useRef<EditorElement[][]>([]);

  const [future, setFuture] = useState<EditorElement[][]>([]);
  const futureRef = useRef<EditorElement[][]>([]);

  const pendingHistoryRef = useRef<EditorElement[] | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");

  const [generateCount, setGenerateCount] = useState(0);
  const [isRegistered, setIsRegistered] = useState(false);
  const MAX_FREE = 3;
  const [showRegister, setShowRegister] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isKiosk, setIsKiosk] = useState(false);
  const [accessLimit, setAccessLimit] = useState<number | null>(null);
  const [accessUsed, setAccessUsed] = useState<number | null>(null);
  const lastRemainingRef = useRef<number | null>(null);
  const [creditFlash, setCreditFlash] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsKiosk(params.get("kiosk") === "1");
  }, []);
  useEffect(() => {
    const registered = localStorage.getItem("print_editor_user_registered");

    if (registered === "1") {
      setShowRegister(false);
    }
  }, []);
  useEffect(() => {
    const registered =
      localStorage.getItem("print_editor_user_registered") === "1";

    setIsRegistered(registered);
  }, []);
  useEffect(() => {
    if (!isRegistered && generateCount >= 3) {
      setShowRegister(true);
    }
  }, [generateCount, isRegistered]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");

  const [scale, setScale] = useState(() => getPreviewScale(2000, 1000));
  const [status, setStatus] = useState("Бэлэн");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiTips, setAiTips] = useState<string[]>([]);
  const [layoutType, setLayoutType] = useState<LayoutType>("hero");
  const [guides, setGuides] = useState<{
    vertical: number | null;
    horizontal: number | null;
  }>({
    vertical: null,
    horizontal: null,
  });

  const [orderOpen, setOrderOpen] = useState(false);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [isDraggingElement, setIsDraggingElement] = useState(false);

  const [showGuides, setShowGuides] = useState(true);
  const [includeCropMarks, setIncludeCropMarks] = useState(false);

  const [settingsPos, setSettingsPos] = useState({ x: 980, y: 220 });
  const settingsDragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const saved = Number(
      localStorage.getItem("print_editor_ai_generate_count") || 0,
    );
    setGenerateCount(saved);
  }, []);
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const loadAccess = async () => {
      const registered =
        localStorage.getItem("print_editor_user_registered") === "1";
      const phone = localStorage.getItem("user_phone");

      if (!registered || !phone) return;

      const data = await checkAccess(phone);

      const limit = data.limit ?? 3;
      const used = data.used ?? 0;
      const remaining = Math.max(0, limit - used);

      const prevRemaining = lastRemainingRef.current;

      if (prevRemaining !== null && remaining > prevRemaining) {
        toast.success(`AI эрх нэмэгдлээ. Үлдсэн: ${remaining}`);

        setCreditFlash(true);
        setTimeout(() => {
          setCreditFlash(false);
        }, 1500);
      }

      lastRemainingRef.current = remaining;

      setAccessLimit(limit);
      setAccessUsed(used);
    };

    loadAccess();

    timer = setInterval(loadAccess, 10000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    elementsRef.current = JSON.parse(JSON.stringify(elements));

    if (elements.length > 0) {
      localStorage.setItem("print_editor_elements", JSON.stringify(elements));
    }
  }, [elements]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    futureRef.current = future;
  }, [future]);

  const applyElements = (next: EditorElement[]) => {
    const safeNext = cloneElements(Array.isArray(next) ? next : []);
    elementsRef.current = safeNext;
    setElements(safeNext);
  };

  const pushUniqueHistory = (snapshot: EditorElement[]) => {
    const safeSnapshot = cloneElements(snapshot);
    const prev = historyRef.current;
    const last = prev[prev.length - 1];

    if (last && sameElements(last, safeSnapshot)) return;

    const nextHistory = [...prev.slice(-29), safeSnapshot];
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  };

  const captureHistoryStart = () => {
    if (!pendingHistoryRef.current) {
      pendingHistoryRef.current = cloneElements(elementsRef.current);
    }
  };

  const commitHistory = () => {
    if (!pendingHistoryRef.current) return;

    if (!sameElements(pendingHistoryRef.current, elementsRef.current)) {
      pushUniqueHistory(pendingHistoryRef.current);
      futureRef.current = [];
      setFuture([]);
    }

    pendingHistoryRef.current = null;
  };

  const pushHistory = (next: EditorElement[]) => {
    pushUniqueHistory(elementsRef.current);
    futureRef.current = [];
    setFuture([]);
    pendingHistoryRef.current = null;
    applyElements(next);
  };

  const patchElement = (id: string, patch: Partial<EditorElement>) => {
    const base = Array.isArray(elementsRef.current) ? elementsRef.current : [];

    const nextList = base.map((item) => {
      if (item.id !== id) return item;

      const next: EditorElement = { ...item, ...patch };

      if (patch.x !== undefined) next.xMm = pxToMm(patch.x);
      if (patch.y !== undefined) next.yMm = pxToMm(patch.y);

      if (patch.xMm !== undefined) next.x = mmToPx(patch.xMm);
      if (patch.yMm !== undefined) next.y = mmToPx(patch.yMm);

      if (patch.width !== undefined) next.widthMm = pxToMm(patch.width);
      if (patch.height !== undefined) next.heightMm = pxToMm(patch.height);

      if (patch.widthMm !== undefined) next.width = mmToPx(patch.widthMm);
      if (patch.heightMm !== undefined) next.height = mmToPx(patch.heightMm);

      if (next.type === "logo") {
        const aspectRatio = next.aspectRatio ?? 1;

        if (patch.width !== undefined && patch.height === undefined) {
          next.height = Math.round(next.width / aspectRatio);
          next.heightMm = pxToMm(next.height);
        }

        if (patch.height !== undefined && patch.width === undefined) {
          next.width = Math.round(next.height * aspectRatio);
          next.widthMm = pxToMm(next.width);
        }
      }

      if (next.type === "line") {
        const thickness =
          patch.lineThickness ??
          patch.height ??
          next.lineThickness ??
          next.height ??
          6;

        next.lineThickness = thickness;
        next.height = thickness;
        next.heightMm = pxToMm(thickness);
      }

      return next;
    });

    applyElements(nextList);
  };

  const selected = useMemo(
    () =>
      (Array.isArray(elements) ? elements : []).find(
        (item) => item.id === selectedId,
      ) ?? null,
    [elements, selectedId],
  );

  const hasValidDocSize = Number(doc.widthMm) > 0 && Number(doc.heightMm) > 0;

  const previewCanvasWidth = hasValidDocSize ? mmToPx(Number(doc.widthMm)) : 0;
  const previewCanvasHeight = hasValidDocSize
    ? mmToPx(Number(doc.heightMm))
    : 0;
  const previewBleed = mmToPx(Number(doc.bleedMm) || 0);
  const previewSafe = mmToPx(Number(doc.safeMm) || 0);
  const previewTotalWidth = previewCanvasWidth + previewBleed * 2;
  const previewTotalHeight = previewCanvasHeight + previewBleed * 2;

  const currentFontSize = selected?.fontSize ?? 40;

  const fontSizeControlMin =
    selected?.role === "primary" ? 24 : selected?.role === "contact" ? 14 : 12;

  const selectedLogicalX =
    selected?.xMm !== undefined ? mmToPx(selected.xMm) : (selected?.x ?? 0);

  const selectedLogicalY =
    selected?.yMm !== undefined ? mmToPx(selected.yMm) : (selected?.y ?? 0);

  const selectedLogicalWidth =
    selected?.widthMm !== undefined
      ? mmToPx(selected.widthMm)
      : (selected?.width ?? 300);
  const safeAreaFitMaxFontSize =
    selected?.type === "text"
      ? getSafeAreaFitMaxFontSize({
          text: selected.text ?? "",
          widthPx: selectedLogicalWidth,
          currentX: selectedLogicalX,
          currentY: selectedLogicalY,
          docWidth: previewCanvasWidth,
          docHeight: previewCanvasHeight,
          previewSafe,
          fontWeight: selected.fontWeight ?? 700,

          // ❗ ЭНЭ ХОЁР ЧУХАЛ
          lineHeight: selected.lineHeight ?? 1.2,
          fontFamily: selected.fontFamily,

          role: selected.role,
        })
      : 220;

  const fontSizeControlMax = Math.max(
    fontSizeControlMin,
    safeAreaFitMaxFontSize,
    Math.ceil(currentFontSize),
  );

  const fontSizeControlStep = 1;
  const addText = (role: TextRole = "support") => {
    const el = createTextElement(previewCanvasWidth, "Шинэ текст");
    el.role = role;

    const base = Array.isArray(elementsRef.current) ? elementsRef.current : [];
    pushHistory([...base, el]);
    setSelectedId(el.id);
  };

  const addLine = () => {
    const el = createLineElement();

    const base = Array.isArray(elementsRef.current) ? elementsRef.current : [];
    pushHistory([...base, el]);
    setSelectedId(el.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;

    const base = Array.isArray(elementsRef.current) ? elementsRef.current : [];
    const next = base.filter((el) => el.id !== selectedId);

    pushHistory(next);
    setSelectedId(null);
  };

  const changeRole = (role: TextRole) => {
    if (!selected) {
      addText(role);
      return;
    }

    captureHistoryStart();

    const base = Array.isArray(elementsRef.current) ? elementsRef.current : [];
    const next = base.map((el) =>
      el.id === selected.id ? { ...el, role } : el,
    );

    applyElements(next);
    commitHistory();
  };

  const updateSelected = (patch: Partial<EditorElement>) => {
    if (!selectedId) return;

    captureHistoryStart(); // 🔥 START
    patchElement(selectedId, patch);
    commitHistory(); // 🔥 END
  };

  const beginSelectedEdit = () => {
    if (!selectedId) return;
    captureHistoryStart();
  };

  const finishSelectedEdit = () => {
    commitHistory();
  };

  const undo = () => {
    const prevHistory = historyRef.current;
    const last = prevHistory[prevHistory.length - 1];
    if (!last) return;

    const current = cloneElements(elementsRef.current);
    const nextFuture = [current, ...futureRef.current];

    futureRef.current = nextFuture;
    setFuture(nextFuture);

    const nextHistory = prevHistory.slice(0, -1);
    historyRef.current = nextHistory;
    setHistory(nextHistory);

    pendingHistoryRef.current = null;
    setSelectedId(null);
    applyElements(last);
  };

  const redo = () => {
    const next = futureRef.current[0];
    if (!next) return;

    const current = cloneElements(elementsRef.current);
    const nextHistory = [...historyRef.current, current];
    const nextFuture = futureRef.current.slice(1);

    historyRef.current = nextHistory;
    futureRef.current = nextFuture;

    setHistory(nextHistory);
    setFuture(nextFuture);

    pendingHistoryRef.current = null;
    setSelectedId(null);
    applyElements(next);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName?.toLowerCase();
      const isTyping =
        tag === "textarea" || tag === "input" || active?.isContentEditable;

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedId &&
        !isTyping
      ) {
        e.preventDefault();
        deleteSelected();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.stopPropagation();

        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        e.stopPropagation();
        redo();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [selectedId]);
  function looksLikeContact(text: string) {
    return /(\+?\d[\d\s-]{5,})/.test(text);
  }
  const extractClientFallback = (prompt: string) => {
    const lines = prompt
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    let headline = "";
    let subtitle = "";
    let cta = "";

    for (const line of lines) {
      if (!headline && /гарчиг|headline|голд нь/i.test(line)) {
        const cleaned = line
          .replace(/.*?(гарчигтай|гарчиг|headline|голд нь)\s*/i, "")
          .replace(/^[:\-–—]\s*/, "")
          .replace(/гэж\s+бич\.?$/i, "")
          .trim();
        if (cleaned) headline = cleaned;
      }

      if (!subtitle && /доор нь|subtitle|coffee|dessert|brunch/i.test(line)) {
        const cleaned = line
          .replace(/.*?(доор нь|subtitle)\s*/i, "")
          .replace(/^[:\-–—]\s*/, "")
          .replace(/гэж\s+бич\.?$/i, "")
          .trim();
        if (cleaned) subtitle = cleaned;
      }

      if (!cta && /утас|phone|call/i.test(line)) {
        const cleaned = line
          .replace(/.*?(утас|phone|call)\s*[:：]?\s*/i, "")
          .trim();
        if (cleaned) cta = /^утас/i.test(line) ? `Утас: ${cleaned}` : cleaned;
      }
    }

    if (!headline) {
      const m = prompt.match(/([A-ZА-ЯӨҮЁ][A-ZА-ЯӨҮЁa-zа-яөүё\s]{3,40})/);
      if (m) headline = m[1].trim();
    }

    if (!subtitle) {
      const m = prompt.match(
        /(Coffee.*|Dessert.*|Brunch.*|Coffee\s*[•*·-]\s*Dessert.*)/i,
      );
      if (m) subtitle = m[1].replace(/\s+/g, " ").trim();
    }

    if (!cta) {
      const m = prompt.match(/(\d{6,12})/);
      if (m) cta = `Утас: ${m[1]}`;
    }

    return { headline, subtitle, cta };
  };
  const getDeviceId = () => {
    let id = localStorage.getItem("print_editor_device_id");

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("print_editor_device_id", id);
    }

    return id;
  };

  const runAiText = async () => {
    const userPhone = localStorage.getItem("user_phone");
    // ✅ 1. Бүртгэлтэй хэрэглэгч бол Supabase users credit шалгана
    if (isRegistered && userPhone) {
      const accessData = await checkAccess(userPhone);
      setAccessLimit(accessData.limit ?? 3);
      setAccessUsed(accessData.used ?? 0);
      if (!accessData.access) {
        setShowAdminModal(true);
        toast.error("Таны AI эрх дууссан байна.");
        return;
      }
    }
    // ✅ 2. Бүртгэлгүй хэрэглэгч бол local count шалгана
    const canUseFree = checkFreeUsage(isRegistered, generateCount, MAX_FREE);

    if (!canUseFree) {
      toast.error("Үнэгүй ашиглалт дууслаа...");
      setShowRegister(true);
      return;
    }
    console.log("runAiText clicked", {
      width: doc.widthMm,
      height: doc.heightMm,
    });

    const { isValid, errors, widthValue, heightValue } = validateBeforeAI(doc);
    if (!isValid) {
      setSizeError(errors);

      toast.error(
        !errors.width && !errors.height
          ? "Өргөн, өндрийн хэмжээгээ оруулна уу"
          : errors.width
            ? errors.width
            : errors.height!,
      );

      const target = !widthValue
        ? widthInputRef.current
        : heightInputRef.current;

      target?.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        target?.focus();
      }, 150);

      return;
    }
    const widthMm = parseMm(widthValue);
    const heightMm = parseMm(heightValue);
    if (!aiPrompt.trim()) {
      toast.error("AI prompt оруулна уу.");
      return;
    }

    try {
      setIsAiLoading(true);
      setStatus("AI дизайн үүсгэж байна...");

      surfaceRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      const res = await fetch("/api/ai/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          widthMm,
          heightMm,
        }),
      });

      const data = await res.json();
      setAiTips(Array.isArray(data.tips) ? data.tips : []);
      const nextLayoutType = layoutType;

      setLayoutType(nextLayoutType);
      if (!res.ok) {
        alert(data.error || "AI алдаа гарлаа");
        setAiTips([]);
        setStatus("AI алдаа");
        return;
      }

      const nextElements = buildAiElements({
        data,
        widthMm,
        heightMm,
        previewCanvasWidth,
        previewCanvasHeight,
        previewSafe,
        layoutType: nextLayoutType,
      }) as EditorElement[];

      const safeLeft = previewSafe;
      const safeTop = previewSafe;
      const safeRight = previewCanvasWidth - previewSafe;
      const safeBottom = previewCanvasHeight - previewSafe;

      const safeElements = Array.isArray(elementsRef.current)
        ? elementsRef.current
        : [];

      const userLogos = safeElements.filter(
        (e) => e.type === "logo" && e.name !== "AI BG",
      );

      const bg = nextElements.find((e) => e.name === "AI BG");
      const textEls = nextElements.filter((e) => e.name !== "AI BG");

      const next = bg
        ? [bg, ...textEls, ...userLogos]
        : [...textEls, ...userLogos];

      next.forEach((el) => {
        if (el.name === "AI BG") return;
        if (!el.width || !el.height) return;

        if (el.x < safeLeft) el.x = safeLeft;
        if (el.x + el.width > safeRight) {
          el.x = safeRight - el.width;
        }

        if (el.y < safeTop) el.y = safeTop;
        if (el.y + el.height > safeBottom) {
          el.y = safeBottom - el.height;
        }

        el.xMm = pxToMm(el.x);
        el.yMm = pxToMm(el.y);
      });

      pushHistory(next);
      setSelectedId(textEls[0]?.id ?? userLogos[0]?.id ?? null);
      setStatus("AI дизайн бэлэн");

      if (!isRegistered) {
        const deviceId = getDeviceId();

        const usageRes = await fetch("/api/free-usage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deviceId }),
        });

        const usageData = await usageRes.json();

        // ❗ ЭНЭ Л ЧУХАЛ
        const usedCount = usageData.used_count;

        setGenerateCount((prev) => Math.max(prev, usedCount));

        localStorage.setItem(
          "print_editor_ai_generate_count",
          String(usedCount),
        );

        toast.success(`Үлдсэн: ${Math.max(0, MAX_FREE - usedCount)} удаа`);
      }

      // ✅ зөвхөн бүртгэлтэй хэрэглэгч дээр credit хасна
      const registeredPhone = localStorage.getItem("user_phone");
      const registeredNow =
        localStorage.getItem("print_editor_user_registered") === "1";
      if (registeredNow && registeredPhone) {
        const creditRes = await fetch("/api/use-credit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone: registeredPhone }),
        });

        const creditData = await creditRes.json();

        if (creditData.ok) {
          setAccessLimit(creditData.limit ?? accessLimit ?? 3);
          setAccessUsed(creditData.used ?? accessUsed ?? 0);
          toast.success(
            `AI эрх ашиглагдлаа. Үлдсэн: ${creditData.remaining ?? 0}`,
          );
        } else {
          setShowAdminModal(true);
          toast.error("Таны AI эрх дууссан байна.");
        }
      }
    } catch (error) {
      console.error(error);
      setAiTips([]);
      setStatus("AI алдаа");
      alert("AI дизайн үүсгэхэд алдаа гарлаа");
    } finally {
      setIsAiLoading(false);
    }
  };

  const applyLayout = (type: LayoutType) => {
    setLayoutType(type);

    const next = cloneElements(elementsRef.current);

    const safeLeft = previewSafe;
    const safeTop = previewSafe;
    const safeRight = previewCanvasWidth - previewSafe;
    const safeBottom = previewCanvasHeight - previewSafe;
    const safeWidth = safeRight - safeLeft;
    const safeHeight = safeBottom - safeTop;

    const textEls = next
      .filter((el) => el.type === "text")
      .sort((a, b) => {
        const order: TextRole[] = [
          "primary",
          "secondary",
          "support",
          "contact",
        ];
        return (
          order.indexOf(a.role ?? "support") -
          order.indexOf(b.role ?? "support")
        );
      });

    if (textEls.length === 0) return;

    const getStyle = (role: TextRole) => {
      const base = getRoleLayoutConfig(
        role,
        previewCanvasWidth,
        previewCanvasHeight,
      );

      return {
        ...base,

        fontBoost:
          role === "primary"
            ? 1.0
            : role === "secondary"
              ? 0.7
              : role === "support"
                ? 0.8
                : 0.6,

        maxWidth:
          role === "primary"
            ? "80%"
            : role === "secondary"
              ? "70%"
              : role === "support"
                ? "65%"
                : "60%",

        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        textAlign: "center",

        fontWeight:
          role === "primary"
            ? 900
            : role === "support"
              ? 800
              : role === "secondary"
                ? 700
                : 600,
      };
    };

    let gap = previewCanvasHeight * 0.028;
    let boxWidth = safeWidth;
    let boxX = safeLeft;
    let align: "left" | "center" | "right" = "center";

    if (type === "center") {
      gap = previewCanvasHeight * 0.025;
      boxWidth = safeWidth * 0.86;
      boxX = safeLeft + (safeWidth - boxWidth) / 2;
      align = "center";
    }

    if (type === "top-heavy") {
      gap = previewCanvasHeight * 0.012;
      boxWidth = safeWidth * 0.9;
      boxX = safeLeft + (safeWidth - boxWidth) / 2;
      align = "center";
    }

    if (type === "hero") {
      gap = previewCanvasHeight * 0.012;
      boxWidth = safeWidth * 0.94;
      boxX = safeLeft + (safeWidth - boxWidth) / 2;
      align = "center";
    }

    if (type === "split") {
      gap = previewCanvasHeight * 0.014;
      boxWidth = safeWidth * 0.48;
      boxX = safeLeft + safeWidth * 0.04;
      align = "left";
    }

    textEls.forEach((el) => {
      const role = el.role ?? "support";
      const style = getStyle(role);

      el.width = boxWidth;

      const estimatedHeight = measureTextHeightForFont(
        el.text ?? "",
        boxWidth,
        Math.round(
          fitFontSizeSmart(
            el.text ?? "",
            role,
            boxWidth,
            style.boxHeight,
            previewCanvasWidth,
            previewCanvasHeight,
          ) * style.fontBoost,
        ),
        style.fontWeight,
        style.lineHeight,
        el.fontFamily,
      );

      const maxAllowedHeight = previewCanvasHeight * 0.25;

      let finalFont =
        fitFontSizeSmart(
          el.text ?? "",
          role,
          boxWidth,
          style.boxHeight,
          previewCanvasWidth,
          previewCanvasHeight,
        ) * style.fontBoost;

      // 🔥 dominance
      if (role === "primary") finalFont *= 1.25;
      else if (role === "secondary") finalFont *= 0.95;
      else if (role === "support") finalFont *= 0.9;
      else if (role === "contact") finalFont *= 0.85;

      // 🔥 overflow fix
      while (estimatedHeight > maxAllowedHeight && finalFont > 10) {
        finalFont *= 0.92;
      }

      el.fontSize = Math.round(finalFont);

      el.height = Math.max(style.boxHeight, estimatedHeight);
      el.fontWeight = style.fontWeight;
      el.lineHeight = style.lineHeight;
      el.textShadow =
        role === "primary"
          ? "0 6px 20px rgba(0,0,0,0.6)"
          : "0 2px 8px rgba(0,0,0,0.28)";

      el.fontSize = Math.round(finalFont);
    });
    let safeGap = Math.max(
      previewCanvasHeight * 0.02,
      previewCanvasHeight / (textEls.length * 6),
    );
    const maxLines = 4;

    if (textEls.length > maxLines) {
      // gap-ийг багасгана
      safeGap *= 0.7;
    }

    const totalHeight =
      textEls.reduce((sum, el) => sum + el.height, 0) +
      safeGap * Math.max(0, textEls.length - 1);

    let y = safeTop + (safeHeight - totalHeight) / 2;

    if (type === "top-heavy") {
      y = safeTop + previewCanvasHeight * 0.055;
    }

    if (type === "hero") {
      y = safeTop + previewCanvasHeight * 0.12;
    }

    if (type === "split") {
      y = safeTop + (safeHeight - totalHeight) / 2;
    }

    y = clamp(y, safeTop, safeBottom - totalHeight);

    textEls.forEach((el) => {
      el.x = boxX;
      el.y = y;
      el.textAlign = align;

      if (type === "split") {
        el.position = "center-left";
      } else if (type === "top-heavy") {
        el.position = "top-center";
      } else {
        el.position = "center";
      }

      el.xMm = pxToMm(el.x);
      el.yMm = pxToMm(el.y);
      el.widthMm = pxToMm(el.width);
      el.heightMm = pxToMm(el.height);

      y += el.height + safeGap;
    });

    pushHistory(next);
  };

  const resetSession = () => {
    localStorage.removeItem("print_editor_user_registered");
    localStorage.removeItem("user_phone");
    localStorage.removeItem("print_editor_ai_generate_count");

    setGenerateCount(0);
    setShowRegister(true);

    toast.success("Шинэ хэрэглэгч эхэллээ");
  };

  const handleRegister = async () => {
    if (!registerName.trim() || !registerPhone.trim()) {
      toast.error("Нэр, утсаа оруулна уу");
      return;
    }

    try {
      const data = await registerUser(
        registerName.trim(),
        registerPhone.trim(),
      );
      localStorage.setItem("print_editor_user_registered", "1");
      localStorage.setItem("user_phone", registerPhone.trim());

      setIsRegistered(true);
      setShowRegister(false);
      setRegisterName("");
      setRegisterPhone("");

      toast.success(
        data.alreadyExists
          ? "Бүртгэлтэй хэрэглэгчээр нэвтэрлээ"
          : "Амжилттай бүртгэгдлээ. 3 AI эрх нэмэгдлээ",
      );
    } catch (error) {
      console.error("REGISTER ERROR:", error);
      toast.error("Бүртгүүлэхэд алдаа гарлаа");
    }
  };
  const handleLogoUpload = async (file: File) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const maxWidth = 320;
        const aspectRatio = img.width / img.height;
        const width = maxWidth;
        const height = Math.round(width / aspectRatio);

        const logoElement: EditorElement = {
          id: makeId(),
          type: "logo",
          name: "Лого",
          x: 120,
          y: 360,
          width,
          height,
          xMm: pxToMm(120),
          yMm: pxToMm(360),
          widthMm: pxToMm(width),
          heightMm: pxToMm(height),
          rotation: 0,
          opacity: 1,
          src: String(reader.result),
          aspectRatio,
          borderRadius: 0,
        };

        const safeElements = Array.isArray(elementsRef.current)
          ? elementsRef.current
          : [];
        pushHistory([...safeElements, logoElement]);
        setSelectedId(logoElement.id);
        setStatus("Лого орлоо");

        if (logoInputRef.current) {
          logoInputRef.current.value = "";
        }
      };

      img.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  };

  const buildExportPayload = (
    measuredElements: EditorElement[],
    preferCmyk = false,
  ) => ({
    doc: {
      widthMm: Number(doc.widthMm),
      heightMm: Number(doc.heightMm),
      bleedMm: Number(doc.bleedMm),
      safeMm: Number(doc.safeMm),
    },
    surfaceWidthPx: surfaceRef.current?.getBoundingClientRect().width ?? 1,
    surfaceHeightPx: surfaceRef.current?.getBoundingClientRect().height ?? 1,
    elements: measuredElements.map((el: any) => ({
      ...el,
      xMm: typeof el.xMm === "number" ? el.xMm : pxToMm(el.x ?? 0),
      yMm: typeof el.yMm === "number" ? el.yMm : pxToMm(el.y ?? 0),
      widthMm:
        typeof el.widthMm === "number" ? el.widthMm : pxToMm(el.width ?? 0),
      heightMm:
        typeof el.heightMm === "number" ? el.heightMm : pxToMm(el.height ?? 0),
      pdfLeftPx:
        typeof el.pdfLeftPx === "number" && Number.isFinite(el.pdfLeftPx)
          ? el.pdfLeftPx
          : undefined,
      pdfTopPx:
        typeof el.pdfTopPx === "number" && Number.isFinite(el.pdfTopPx)
          ? el.pdfTopPx
          : undefined,
      pdfWidthPx:
        typeof el.pdfWidthPx === "number" && Number.isFinite(el.pdfWidthPx)
          ? el.pdfWidthPx
          : undefined,
      pdfHeightPx:
        typeof el.pdfHeightPx === "number" && Number.isFinite(el.pdfHeightPx)
          ? el.pdfHeightPx
          : undefined,
      fontSize:
        typeof el.fontSize === "number" && Number.isFinite(el.fontSize)
          ? el.fontSize
          : 40,
      lineHeight:
        typeof el.lineHeight === "number" && Number.isFinite(el.lineHeight)
          ? el.lineHeight
          : 1.2,
    })),
    includeCropMarks,
    preferCmyk,
  });
  const buildPreviewImage = async () => {
    if (!surfaceRef.current) return null;

    const dataUrl = await toPng(surfaceRef.current, {
      cacheBust: true,
      pixelRatio: 3, // 🔥 өмнө 2 байсан → 3 болго
    });

    return dataUrl;
  };

  const handleOrder = async () => {
    if (isSendingOrder) return;
    if (!surfaceRef.current) {
      alert("Preview surface олдсонгүй");
      setIsSendingOrder(false);
      return;
    }
    try {
      if (!surfaceRef.current) {
        alert("Preview surface олдсонгүй");
        return;
      }

      setStatus("PDF үүсгэж байна...");

      const measuredElements = elements.map((el) => {
        const node = document.querySelector(
          `[data-element-id="${el.id}"]`,
        ) as HTMLElement | null;

        if (!node || !surfaceRef.current) {
          return el;
        }

        const rect = node.getBoundingClientRect();
        const parentRect = surfaceRef.current.getBoundingClientRect();

        return {
          ...el,
          pdfLeftPx: rect.left - parentRect.left,
          pdfTopPx: rect.top - parentRect.top,
          pdfWidthPx: rect.width,
          pdfHeightPx: rect.height,
        };
      });

      const pdfRes = await fetch("/api/export-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildExportPayload(measuredElements, false)),
      });
      if (!pdfRes.ok) {
        throw new Error("PDF export failed");
      }

      const pdfBlob = await pdfRes.blob();

      const previewPng = await toPng(surfaceRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });

      const previewBlob = await (await fetch(previewPng)).blob();

      setStatus("Имэйл илгээж байна...");

      const formData = new FormData();
      formData.append("name", name);
      formData.append("phone", phone);
      formData.append("file", pdfBlob, "design-print.pdf");
      formData.append("preview", previewBlob, "preview.png");

      const orderRes = await fetch("/api/send-order", {
        method: "POST",
        body: formData,
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => null);
        throw new Error(errData?.error || "Send order failed");
      }
      setStatus("Амжилттай илгээгдлээ ✅");
      toast.success("Амжилттай илгээгдлээ ✅");

      setOrderOpen(false);
      setName("");
      setPhone("");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Алдаа гарлаа");
      setStatus("Алдаа");
    } finally {
      setIsSendingOrder(false);
    }
  };

  const exportToPDF = async () => {
    try {
      setStatus("PDF үүсгэж байна...");

      if (!surfaceRef.current) {
        alert("Preview surface олдсонгүй");
        return;
      }

      const measuredElements = elements.map((el) => {
        const node = document.querySelector(
          `[data-element-id="${el.id}"]`,
        ) as HTMLElement | null;

        if (!node) return el;

        const rect = node.getBoundingClientRect();
        const parentRect = surfaceRef.current!.getBoundingClientRect();

        return {
          ...el,
          pdfLeftPx: rect.left - parentRect.left,
          pdfTopPx: rect.top - parentRect.top,
          pdfWidthPx: rect.width,
          pdfHeightPx: rect.height,
        };
      });

      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildExportPayload(measuredElements, false)),
      });

      if (!res.ok) {
        throw new Error("PDF export failed");
      }

      const blob = await res.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "design.pdf";
      a.click();

      setStatus("PDF бэлэн ✅");
    } catch (err) {
      console.error(err);
      setStatus("PDF алдаа ❌");
    }
  };

  const handleSettingsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    settingsDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: settingsPos.x,
      baseY: settingsPos.y,
    };

    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handleSettingsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!settingsDragRef.current) return;

    const dx = e.clientX - settingsDragRef.current.startX;
    const dy = e.clientY - settingsDragRef.current.startY;

    setSettingsPos({
      x: settingsDragRef.current.baseX + dx,
      y: settingsDragRef.current.baseY + dy,
    });
  };

  const handleSettingsPointerUp = () => {
    settingsDragRef.current = null;
  };

  return (
    <main
      className="min-h-screen bg-slate-100 text-slate-900"
      onPointerDown={() => {
        setSelectedId(null);
      }}
    >
      <div className="mx-auto grid max-w-[1700px] grid-cols-1 gap-4 p-3 xl:grid-cols-[360px_minmax(0,1fr)] md:p-4">
        <aside className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="text-lg font-bold text-slate-900">
            AI дизайн туслах
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Таны санаанд тулгуурлан текст, өнгө болон зохиомжийг автоматаар
            үүсгэнэ.
          </p>

          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Санаагаа бичнэ үү… (жишээ: кофе шоп постер, бор фон, алтлаг бичигтэй, гарчиг дээд хэсэгт, Дуудах текстүүдийг доор, дээр, дунд, зүүн, баруун, зүүн доор гэх мэт байршил зааж өг...)"
            className="mt-4 min-h-36 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none transition focus:border-blue-500"
          />
          {!isKiosk && (
            <div className="mt-2 text-sm text-slate-500">
              {isRegistered ? (
                <span
                  className={`font-semibold transition-all duration-300 ${
                    creditFlash
                      ? "rounded-lg bg-green-100 px-2 py-1 text-green-700"
                      : "text-green-600"
                  }`}
                >
                  ✔ Бүртгэлтэй хэрэглэгч
                  <span className="ml-1 text-slate-700">
                    · Үлдсэн:{" "}
                    <b className="text-blue-600">
                      {Math.max(0, (accessLimit ?? 3) - (accessUsed ?? 0))}
                    </b>
                  </span>
                </span>
              ) : (
                <span>
                  Үлдсэн:{" "}
                  <b className="text-blue-600">
                    {Math.max(0, MAX_FREE - generateCount)}
                  </b>{" "}
                  / {MAX_FREE}
                </span>
              )}
            </div>
          )}

          <button
            onClick={runAiText}
            type="button"
            className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
              !isRegistered && generateCount >= MAX_FREE
                ? "bg-gray-400 text-white"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {!isRegistered && generateCount >= MAX_FREE
              ? "Бүртгүүлж үргэлжлүүлэх"
              : "AI текст үүсгэх"}
          </button>

          {isKiosk && (
            <button
              type="button"
              onClick={resetSession}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              🔄 Шинэ хэрэглэгч
            </button>
          )}

          {aiTips.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-bold text-amber-900">
                💡 AI зөвлөгөө
              </div>
              <div className="mt-2 space-y-2 text-sm text-amber-800">
                {aiTips.map((tip, index) => (
                  <div key={index}>• {tip}</div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="text-lg font-bold text-slate-900">
              Хэвлэлийн хэмжээ
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Document-ийн бодит хэмжээг мм-ээр оруулна.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm">
                <span>Өргөн (mm)</span>
                <input
                  ref={widthInputRef}
                  type="text"
                  value={doc.widthMm}
                  placeholder="мм (жишээ: 3500)"
                  onFocus={(e) => {
                    if (e.target.value) e.target.select();
                  }}
                  onChange={(e) => {
                    setDoc((prev) => ({
                      ...prev,
                      widthMm: e.target.value,
                    }));

                    if (sizeError.width) {
                      setSizeError((prev) => ({ ...prev, width: undefined }));
                    }
                  }}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();

                    if (!raw) {
                      setDoc((prev) => ({
                        ...prev,
                        widthMm: "",
                      }));
                      return;
                    }

                    const mm = parseMm(raw);

                    setDoc((prev) => ({
                      ...prev,
                      widthMm:
                        Number.isFinite(mm) && mm > 0 ? Math.max(100, mm) : "",
                    }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 outline-none ${
                    sizeError.width
                      ? "border-red-500 bg-red-50"
                      : "border-slate-200 bg-white"
                  }`}
                />
                {sizeError.width && (
                  <span className="text-xs leading-5 text-red-500">
                    {sizeError.width}
                  </span>
                )}
              </label>
              <label className="grid gap-1 text-sm">
                <span>Өндөр (mm)</span>
                <input
                  ref={heightInputRef}
                  type="text"
                  value={doc.heightMm}
                  placeholder="мм (жишээ: 1500)"
                  onFocus={(e) => {
                    if (e.target.value) e.target.select();
                  }}
                  onChange={(e) => {
                    setDoc((prev) => ({
                      ...prev,
                      heightMm: e.target.value,
                    }));

                    if (sizeError.height) {
                      setSizeError((prev) => ({ ...prev, height: undefined }));
                    }
                  }}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();

                    if (!raw) {
                      setDoc((prev) => ({
                        ...prev,
                        heightMm: "",
                      }));
                      return;
                    }

                    const mm = parseMm(raw);

                    setDoc((prev) => ({
                      ...prev,
                      heightMm:
                        Number.isFinite(mm) && mm > 0 ? Math.max(100, mm) : "",
                    }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 outline-none ${
                    sizeError.height
                      ? "border-red-500 bg-red-50"
                      : "border-slate-200 bg-white"
                  }`}
                />
                {sizeError.height && (
                  <span className="text-xs leading-5 text-red-500">
                    {sizeError.height}
                  </span>
                )}
              </label>
              <label className="grid gap-1 text-sm">
                <span>Илүүдэл зай (mm)</span>
                <input
                  type="text"
                  value={doc.bleedMm}
                  placeholder="мм (жишээ: 5)"
                  onFocus={(e) => {
                    if (e.target.value) e.target.select();
                  }}
                  onChange={(e) =>
                    setDoc((prev) => ({
                      ...prev,
                      bleedMm: Number(e.target.value) || 0,
                    }))
                  }
                  onBlur={(e) => {
                    const mm = parseMm(e.target.value);
                    setDoc((prev) => ({
                      ...prev,
                      bleedMm: Number.isFinite(mm) && mm >= 0 ? mm : 5,
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Аюулгүй бүс (mm)</span>
                <input
                  type="text"
                  value={doc.safeMm}
                  placeholder="мм"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setDoc((prev) => ({
                      ...prev,
                      safeMm: e.target.value as any,
                    }))
                  }
                  onBlur={(e) => {
                    const mm = parseMm(e.target.value);
                    setDoc((prev) => ({
                      ...prev,
                      safeMm: !isNaN(mm) ? Math.max(0, mm) : 20,
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="text-lg font-bold text-slate-900">Лого оруулах</div>
            <p className="mt-1 text-sm text-slate-500">
              PNG, JPG логогоо canvas дээр нэмнэ.
            </p>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
              }}
            />

            <button
              onClick={() => logoInputRef.current?.click()}
              type="button"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <ImagePlus className="h-4 w-4" />
              Лого upload
            </button>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">
                Харагдац ба экспорт
              </div>

              <label className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showGuides}
                  onChange={(e) => setShowGuides(e.target.checked)}
                />
                <span>Чиглүүлэгч шугам харуулах</span>
              </label>

              <label className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeCropMarks}
                  onChange={(e) => setIncludeCropMarks(e.target.checked)}
                />
                <span>Тайрах тэмдэг оруулах</span>
              </label>

              <p className="mt-3 text-xs text-slate-500">
                Чиглүүлэгч шугам нь зөвхөн edit дээр харагдана. Тайрах тэмдэг нь
                PDF дээр хүсвэл л орно.
              </p>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">Төлөв</div>
              <div className="mt-1">{status}</div>
              <div className="mt-1 text-xs text-slate-500">
                Export quality: {EXPORT_DPI} DPI
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Хэмжээ: {doc.widthMm} × {doc.heightMm} mm
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Илүүдэл зай: {doc.bleedMm} mm · Аюулгүй бүс: {doc.safeMm} mm
              </div>
            </div>
          </div>
        </aside>

        <section
          className="min-w-0 rounded-3xl bg-white p-3 shadow-sm md:p-4"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedId(null);
            }
          }}
        >
          <div
            className="relative rounded-3xl bg-slate-100 p-2 md:p-4"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedId(null);
              }
            }}
          >
            <div className="sticky top-2 z-20 mx-auto mb-4 w-full max-w-[900px] rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ToolbarButton icon={Undo2} label="Буцаах" onClick={undo} />
                <ToolbarButton icon={Redo2} label="Дахин" onClick={redo} />
                <ToolbarButton
                  icon={Type}
                  label="Текст"
                  onClick={() => changeRole("support")}
                />
                {/* <ToolbarButton
                  icon={PanelTopClose}
                  label="Шугам"
                  onClick={addLine}
                /> */}

                <div className="mx-1 hidden h-8 w-px bg-slate-200 md:block" />

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setScale((prev) => Math.max(prev - 0.01, 0.01))
                    }
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <span className="min-w-14 text-center text-sm font-semibold">
                    {Math.round(scale * 100)}%
                  </span>

                  <button
                    onClick={() => setScale((prev) => Math.min(prev + 0.01, 3))}
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => applyLayout("center")}
                    className="rounded-xl border px-3 py-1 text-sm"
                  >
                    Center
                  </button>

                  <button
                    onClick={() => applyLayout("top-heavy")}
                    className="rounded-xl border px-3 py-1 text-sm"
                  >
                    Top
                  </button>

                  <button
                    onClick={() => applyLayout("hero")}
                    className="rounded-xl border px-3 py-1 text-sm"
                  >
                    Hero
                  </button>

                  <button
                    onClick={() => applyLayout("split")}
                    className="rounded-xl border px-3 py-1 text-sm"
                  >
                    Split
                  </button>
                </div>

                <ToolbarButton
                  icon={Printer}
                  label="PDF"
                  onClick={exportToPDF}
                />

                <ToolbarButton
                  icon={Printer}
                  label="Хэвлүүлэх"
                  onClick={() => setOrderOpen(true)}
                  variant="primary"
                />
              </div>
            </div>

            <div
              className="relative mx-auto flex min-h-[60vh] w-full items-start justify-start overflow-x-auto overflow-y-visible pt-14 md:justify-center"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedId(null);
                }
              }}
            >
              <div
                className="relative"
                style={{
                  width: previewTotalWidth * scale,
                  height: previewTotalHeight * scale,
                }}
              >
                {showGuides && (
                  <div
                    className="pointer-events-none absolute border border-red-500"
                    style={{
                      left: 0,
                      top: 0,
                      width: previewTotalWidth * scale,
                      height: previewTotalHeight * scale,
                    }}
                  />
                )}

                {showGuides && (
                  <div
                    className="pointer-events-none absolute z-20 border-2 border-dashed border-blue-500"
                    style={{
                      left: (previewBleed + previewSafe) * scale,
                      top: (previewBleed + previewSafe) * scale,
                      width: (previewCanvasWidth - previewSafe * 2) * scale,
                      height: (previewCanvasHeight - previewSafe * 2) * scale,
                    }}
                  />
                )}
                {hasValidDocSize ? (
                  <div
                    ref={surfaceRef}
                    onPointerDown={(e) => {
                      if (e.target === e.currentTarget) {
                        setSelectedId(null);
                      }
                    }}
                    className="relative overflow-visible rounded-[30px] border border-slate-200 bg-white shadow-xl"
                    style={{
                      width: previewTotalWidth * scale,
                      height: previewTotalHeight * scale,
                      background:
                        "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                    }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 rounded-[30px]"
                      style={{
                        boxShadow: `inset 0 0 0 ${previewBleed * scale}px rgba(239, 68, 68, 0.06)`,
                      }}
                    />

                    {isAiLoading && (
                      <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center rounded-[30px] bg-white/80 backdrop-blur-sm">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
                        <div className="mt-3 text-sm font-semibold text-slate-700">
                          AI таны загварыг бэлдэж байна...
                        </div>
                      </div>
                    )}

                    {(Array.isArray(elements) ? elements : []).map((item) => (
                      <CanvasItem
                        key={item.id}
                        element={item}
                        scale={scale}
                        selected={item.id === selectedId}
                        docWidth={previewCanvasWidth}
                        docHeight={previewCanvasHeight}
                        previewBleed={previewBleed}
                        previewSafe={previewSafe}
                        onSelect={() => setSelectedId(item.id)}
                        onDelete={() => {
                          const base = Array.isArray(elementsRef.current)
                            ? elementsRef.current
                            : [];
                          const next = base.filter((el) => el.id !== item.id);
                          setSelectedId(null);
                          pushHistory(next);
                        }}
                        onPatch={(patch) => {
                          patchElement(item.id, patch);
                        }}
                        onCommit={commitHistory}
                        onDragStart={() => {
                          captureHistoryStart();
                          setIsDraggingElement(true);
                        }}
                        onDragEnd={() => {
                          setIsDraggingElement(false);
                        }}
                        onGuidesChange={(nextGuides) => {
                          setGuides({
                            vertical:
                              nextGuides.vertical !== null
                                ? nextGuides.vertical + previewBleed
                                : null,
                            horizontal:
                              nextGuides.horizontal !== null
                                ? nextGuides.horizontal + previewBleed
                                : null,
                          });
                        }}
                      />
                    ))}

                    {guides.vertical !== null && (
                      <div
                        className="pointer-events-none absolute top-0 z-30"
                        style={{
                          left: guides.vertical * scale,
                          width: 2,
                          height: previewTotalHeight * scale,
                          backgroundColor: GUIDE_COLOR,
                          opacity: 1,
                          boxShadow: `0 0 0 1px ${GUIDE_COLOR}33, 0 0 8px ${GUIDE_COLOR}66`,
                        }}
                      />
                    )}

                    {guides.horizontal !== null && (
                      <div
                        className="pointer-events-none absolute left-0 z-30"
                        style={{
                          top: guides.horizontal * scale,
                          height: 2,
                          width: previewTotalWidth * scale,
                          backgroundColor: GUIDE_COLOR,
                          opacity: 1,
                          boxShadow: `0 0 0 1px ${GUIDE_COLOR}33, 0 0 8px ${GUIDE_COLOR}66`,
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                    Хэмжээгээ оруулсны дараа canvas гарна
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {selected && !isDraggingElement && (
        <div
          className="fixed z-40 w-[300px] rounded-3xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur"
          style={{
            left: settingsPos.x,
            top: settingsPos.y,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            onPointerDown={handleSettingsPointerDown}
            onPointerMove={handleSettingsPointerMove}
            onPointerUp={handleSettingsPointerUp}
            className="flex cursor-move items-center justify-between rounded-t-3xl border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900"
          >
            <div className="inline-flex items-center gap-2">
              <Move className="h-4 w-4" />
              Тохиргоо
            </div>

            <button
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedId(null);
              }}
              type="button"
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Хаах"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4">
            <div className="grid gap-3">
              {(selected.type === "text" || selected.type === "line") && (
                <label className="grid gap-1 text-sm">
                  <span>Өнгө</span>
                  <SafeColorInput
                    value={selected.color ?? "#0f172a"}
                    onStart={beginSelectedEdit}
                    onChange={(value) => updateSelected({ color: value })}
                    onCommit={finishSelectedEdit}
                  />
                </label>
              )}

              {selected.type === "text" && (
                <>
                  <label className="grid gap-1 text-sm">
                    <span>Фонт</span>
                    <FontPreviewDropdown
                      value={
                        selected.fontFamily ??
                        "var(--font-inter), Inter, sans-serif"
                      }
                      onChange={(nextFont) => {
                        const base = Array.isArray(elementsRef.current)
                          ? elementsRef.current
                          : [];
                        const next = base.map((item) =>
                          item.id === selected.id
                            ? { ...item, fontFamily: nextFont }
                            : item,
                        );
                        pushHistory(next);
                      }}
                    />
                  </label>

                  <div className="mt-2 flex items-center gap-2">
                    {[
                      { value: "left", icon: AlignLeft, label: "left" },
                      { value: "center", icon: AlignCenter, label: "center" },
                      { value: "right", icon: AlignRight, label: "right" },
                    ].map(({ value, icon: Icon, label }) => (
                      <button
                        key={value}
                        onClick={() => {
                          const base = Array.isArray(elementsRef.current)
                            ? elementsRef.current
                            : [];
                          const next = base.map((item) =>
                            item.id === selected.id
                              ? {
                                  ...item,
                                  textAlign: value as
                                    | "left"
                                    | "center"
                                    | "right",
                                }
                              : item,
                          );
                          pushHistory(next);
                        }}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                          (selected.textAlign ?? "left") === value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                        aria-label={label}
                        title={label}
                        type="button"
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}

                    <button
                      onClick={() => {
                        const base = Array.isArray(elementsRef.current)
                          ? elementsRef.current
                          : [];
                        const next = base.map((item) =>
                          item.id === selected.id
                            ? {
                                ...item,
                                fontWeight:
                                  (selected.fontWeight ?? 700) >= 700
                                    ? 400
                                    : 800,
                              }
                            : item,
                        );
                        pushHistory(next);
                      }}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                        (selected.fontWeight ?? 700) >= 700
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      aria-label="bold"
                      title="bold"
                      type="button"
                    >
                      <Bold className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3">
                    <Range
                      label="Мөр хооронд зай"
                      value={selected.lineHeight ?? 1.2}
                      min={1}
                      max={2}
                      step={0.05}
                      onStart={beginSelectedEdit}
                      onChange={(value) =>
                        updateSelected({ lineHeight: value })
                      }
                      onCommit={finishSelectedEdit}
                    />
                  </div>

                  <Range
                    label="Үсгийн хэмжээ (px)"
                    value={selected.fontSize ?? 40}
                    min={fontSizeControlMin}
                    max={fontSizeControlMax}
                    step={fontSizeControlStep}
                    onStart={beginSelectedEdit}
                    onChange={(value) =>
                      updateSelected({
                        fontSize: Math.min(value, fontSizeControlMax),
                        fontScale: 1,
                      })
                    }
                    onCommit={finishSelectedEdit}
                  />
                </>
              )}

              {selected.type === "line" && (
                <>
                  <Range
                    label="Шугамын урт"
                    value={selected.width}
                    min={80}
                    max={900}
                    onStart={beginSelectedEdit}
                    onChange={(value) => updateSelected({ width: value })}
                    onCommit={finishSelectedEdit}
                  />
                  <Range
                    label="Шугамын зузаан"
                    value={selected.lineThickness ?? 6}
                    min={2}
                    max={30}
                    onStart={beginSelectedEdit}
                    onChange={(value) =>
                      updateSelected({ lineThickness: value, height: value })
                    }
                    onCommit={finishSelectedEdit}
                  />
                </>
              )}

              {selected.type === "logo" && (
                <Range
                  label="Өргөн"
                  value={selected.width}
                  min={60}
                  max={900}
                  onStart={beginSelectedEdit}
                  onChange={(value) => updateSelected({ width: value })}
                  onCommit={finishSelectedEdit}
                />
              )}

              <Range
                label="Тунгалагшил"
                value={(selected.opacity ?? 1) * 100}
                min={0}
                max={100}
                step={1}
                onStart={beginSelectedEdit}
                onChange={(value) => updateSelected({ opacity: value / 100 })}
                onCommit={finishSelectedEdit}
              />
            </div>
          </div>
        </div>
      )}

      {orderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Захиалга илгээх</h2>

            <input
              placeholder="Нэр"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-200 p-3"
            />

            <input
              placeholder="Утас"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-200 p-3"
            />

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleOrder}
                disabled={isSendingOrder}
                className="rounded-xl bg-green-600 px-4 py-3 font-bold text-white disabled:opacity-60"
              >
                {isSendingOrder ? "Илгээж байна..." : "Илгээх"}
              </button>

              <button
                onClick={() => setOrderOpen(false)}
                type="button"
                className="flex-1 rounded-xl border border-slate-200 py-3 font-medium"
              >
                Болих
              </button>
            </div>
          </div>
        </div>
      )}
      {showRegister && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
          <div className="w-[360px] rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 text-lg font-bold text-slate-900">
              Бүртгүүлэх
            </div>

            <div className="space-y-3">
              <input
                placeholder="Нэр"
                value={registerName}
                onInput={(e) =>
                  setRegisterName((e.target as HTMLInputElement).value)
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none"
                autoComplete="name"
              />
              <input
                placeholder="Утас"
                value={registerPhone}
                onInput={(e) =>
                  setRegisterPhone((e.target as HTMLInputElement).value)
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none"
                autoComplete="tel"
              />

              <button
                type="button"
                onClick={handleRegister}
                className="w-full rounded-xl bg-slate-900 py-2 font-semibold text-white"
              >
                Илгээх
              </button>

              <button
                type="button"
                onClick={() => setShowRegister(false)}
                className="w-full rounded-xl border border-slate-300 py-2 font-semibold text-slate-700"
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}
      {showAdminModal && (
        <RegisterModal onClose={() => setShowAdminModal(false)} />
      )}
    </main>
  );
}
