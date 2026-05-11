"use client";
import NextImage from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";
import type { EditorElement, TextRole } from "./core/editor-types";
import { checkAccess, registerUser } from "@/lib/api-client";
import CanvasStage from "./canvas/CanvasStage";
import ToolbarButton from "./controls/ToolbarButton";
import RegisterModal from "./modals/RegisterModal";
import SettingsPanel from "./panels/SettingsPanel";
import OrderModal from "./order/OrderModal";
import { createTextElement, createLineElement } from "./core/editor-elements";
import { checkFreeUsage } from "./validation/check-free-usage";
import { validateBeforeAI } from "./validation/validate-before-ai";
import { buildLayoutElements } from "./ai/apply-layout";
import { buildDesignerLayout } from "./ai/designer-layout";
import { measureTextHeightForFont } from "./core/editor-typography";
import AiTipsModal from "./modals/AiTipsModal";
import {
  GUIDE_COLOR,
  EXPORT_DPI,
  makeId,
  mmToPx,
  pxToMm,
  getPreviewScale,
  parseMm,
} from "./core/editor-utils";
import { type LayoutType } from "./ai/layout-engine";
import { useEditorHistory } from "./hooks/useEditorHistory";
import { patchEditorElement } from "./utils/patchElement";
import {
  Undo2,
  Redo2,
  Type,
  Minus,
  Plus,
  Printer,
  ImagePlus,
  Info,
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
  maxBottomY,
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
  maxBottomY?: number;
}) {
  const safeLeft = previewSafe;
  const safeRight = docWidth - previewSafe;
  const safeTop = previewSafe;
  const safeBottom = docHeight - previewSafe;
  const clampedX = Math.max(currentX, safeLeft);
  const clampedY = Math.max(currentY, safeTop);
  const bottomLimit = Math.min(
    safeBottom,
    typeof maxBottomY === "number" && Number.isFinite(maxBottomY)
      ? maxBottomY
      : safeBottom,
  );
  const allowedWidth = Math.min(widthPx, safeRight - clampedX);
  const allowedHeight = bottomLimit - clampedY;
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
function clampTextElementIntoCanvas(
  element: EditorElement,
  docWidth: number,
  docHeight: number,
  previewSafe: number,
) {
  if (element.type !== "text") return element;

  const x = typeof element.xMm === "number" ? mmToPx(element.xMm) : element.x;
  const y = typeof element.yMm === "number" ? mmToPx(element.yMm) : element.y;
  const width = Math.max(
    20,
    typeof element.widthMm === "number"
      ? mmToPx(element.widthMm)
      : element.width,
  );
  const fontSize = Math.max(1, element.fontSize ?? 40);
  const lineHeight = Math.max(element.lineHeight ?? 1.2, 1);
  const textHeight = Math.ceil(
    measureTextHeightForFont(
      element.text ?? "",
      width,
      fontSize,
      element.fontWeight ?? 700,
      lineHeight,
      element.fontFamily,
    ),
  );

  const minX = previewSafe;
  const minY = previewSafe;
  const maxX = Math.max(minX, docWidth - previewSafe - width);
  const maxY = Math.max(minY, docHeight - previewSafe - textHeight);

  const nextX = Math.min(Math.max(x, minX), maxX);
  const nextY = Math.min(Math.max(y, minY), maxY);

  return {
    ...element,
    x: nextX,
    y: nextY,
    xMm: pxToMm(nextX),
    yMm: pxToMm(nextY),
    height: 0,
    heightMm: undefined,
  };
}

export default function EditorShell() {
  const layoutLabelMap = {
    hero: "Hero",
    split: "Split",
    center: "Center",
  };

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
  const {
    elements,
    elementsRef,
    applyElements,
    pushHistory,
    captureHistoryStart,
    commitHistory,
    undo,
    redo,
  } = useEditorHistory([]);
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
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
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
    if (elements.length === 0) return;

    const lightElements = elements.map((el) => {
      if (el.type === "text") {
        return { ...el, height: 0, heightMm: undefined };
      }

      if (el.type === "logo") return { ...el, src: "" };

      return el;
    });

    try {
      localStorage.setItem(
        "print_editor_elements",
        JSON.stringify(lightElements),
      );
    } catch (err) {
      console.warn("localStorage save skipped:", err);
    }
  }, [elements]);
  const patchElement = (id: string, patch: Partial<EditorElement>) => {
    const base = Array.isArray(elementsRef.current) ? elementsRef.current : [];

    const nextList = base.map((item) => {
      if (item.id !== id) return item;

      const next = patchEditorElement(item, patch);

      if (next.type === "text") {
        return {
          ...next,
          height: 0,
          heightMm: undefined,
        };
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
  const nextTextTop =
    selected?.type === "text"
      ? (Array.isArray(elements) ? elements : [])
          .filter((el) => el.type === "text" && el.id !== selected.id)
          .map((el) => (el.yMm !== undefined ? mmToPx(el.yMm) : (el.y ?? 0)))
          .filter((y) => y > selectedLogicalY + 4)
          .sort((a, b) => a - b)[0]
      : undefined;

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
          lineHeight: selected.lineHeight ?? 1.2,
          fontFamily: selected.fontFamily,
          role: selected.role,
        })
      : 220;
  const fontSizeControlMax = 3000;
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

    const base = Array.isArray(elementsRef.current) ? elementsRef.current : [];

    const nextList = base.map((item) => {
      if (item.id !== selectedId) return item;

      const next = patchEditorElement(item, patch);

      if (next.type !== "text") return next;

      return clampTextElementIntoCanvas(
        next,
        previewCanvasWidth,
        previewCanvasHeight,
        previewSafe,
      );
    });

    applyElements(nextList);
  };
  const beginSelectedEdit = () => {
    if (!selectedId) return;
    captureHistoryStart();
  };
  const finishSelectedEdit = () => {
    commitHistory();
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
      const nextLayoutType =
        data.layoutType === "center" ||
        data.layoutType === "hero" ||
        data.layoutType === "split"
          ? data.layoutType
          : layoutType;

      setLayoutType(nextLayoutType);
      if (!res.ok) {
        alert(data.error || "AI алдаа гарлаа");
        setAiTips([]);
        setStatus("AI алдаа");
        return;
      }
      const nextElements = buildLayoutElements({
        data,
        widthMm,
        heightMm,
        previewCanvasWidth,
        previewCanvasHeight,
        previewSafe,
        layoutType: nextLayoutType,
      });
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

    const next = buildDesignerLayout({
      elements: elementsRef.current,
      type,
      previewCanvasWidth,
      previewCanvasHeight,
      previewSafe,
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
        const aspectRatio = img.width / img.height;

        const logoMaxWidth = Math.min(
          previewCanvasWidth * 0.12,
          previewCanvasHeight * 0.16,
          220,
        );

        const width = Math.max(70, logoMaxWidth);
        const height = Math.round(width / aspectRatio);

        const logoGap = Math.max(previewSafe * 0.7, previewCanvasWidth * 0.025);

        const logoX = previewCanvasWidth - previewSafe - logoGap - width;
        const logoY = previewSafe + logoGap;

        const finalLogoX = Math.min(
          Math.max(previewSafe, logoX),
          previewCanvasWidth - previewSafe - width,
        );

        const finalLogoY = Math.min(
          Math.max(previewSafe, logoY),
          previewCanvasHeight - previewSafe - height,
        );
        const logoElement: EditorElement = {
          id: makeId(),
          type: "logo",
          name: "Лого",
          x: finalLogoX,
          y: finalLogoY,
          width,
          height,
          xMm: pxToMm(finalLogoX),
          yMm: pxToMm(finalLogoY),
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
  return (
    <main
      className="min-h-screen bg-slate-100 text-slate-900"
      onPointerDown={() => {
        setSelectedId(null);
        setLayoutMenuOpen(false);
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
            placeholder="Санаагаа бичнэ үү…

Жишээ:
кофе шоп постер, бор дэвсгэр, алтлаг бичиг.
САРАН КАФЕ гарчигтай.
Coffee * Dessert * Brunch.
Утас: 99112233....)"
            className="mt-4 min-h-36 w-full resize-y overflow-auto rounded-2xl border border-slate-200 p-3 text-sm outline-none transition focus:border-blue-500"
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
          <div className="mt-3 border-t border-slate-200 pt-4">
            <div className="text-lg font-bold text-slate-900">
              Хэвлэлийн хэмжээ
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Document-ийн бодит хэмжээг мм-ээр оруулна.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
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
          <div className="mt-2">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
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
              <details className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
                <summary className="cursor-pointer select-none font-semibold text-slate-700">
                  Төлөв: {status}
                </summary>

                <div className="mt-2">Export quality: {EXPORT_DPI} DPI</div>

                <div className="mt-1">
                  Хэмжээ: {doc.widthMm} × {doc.heightMm} mm
                </div>

                <div className="mt-1">
                  Илүүдэл зай: {doc.bleedMm} mm · Аюулгүй бүс: {doc.safeMm} mm
                </div>

                <div className="mt-1">
                  Чиглүүлэгч шугам нь зөвхөн edit дээр харагдана. Тайрах тэмдэг
                  нь PDF дээр хүсвэл л орно.
                </div>
              </details>
            </div>
          </div>

          {selected && !isDraggingElement && (
            <SettingsPanel
              selected={selected}
              fontSizeControlMin={fontSizeControlMin}
              fontSizeControlMax={fontSizeControlMax}
              fontSizeControlStep={fontSizeControlStep}
              onStartEdit={beginSelectedEdit}
              onCommitEdit={finishSelectedEdit}
              onPatch={updateSelected}
              onClose={() => setSelectedId(null)}
              onFontChange={(nextFont) => {
                updateSelected({ fontFamily: nextFont });
                finishSelectedEdit();
              }}
              onTextAlignChange={(value) => {
                const base = Array.isArray(elementsRef.current)
                  ? elementsRef.current
                  : [];
                const next = base.map((item) =>
                  item.id === selected.id
                    ? { ...item, textAlign: value }
                    : item,
                );
                updateSelected({ textAlign: value });
                finishSelectedEdit();
              }}
              onToggleBold={() => {
                updateSelected({
                  fontWeight: (selected.fontWeight ?? 700) >= 700 ? 400 : 800,
                });
                finishSelectedEdit();
              }}
              onFontSizeChange={(value) => {
                updateSelected({
                  fontSize: value,
                  fontScale: 1,
                });
              }}
            />
          )}
        </aside>
        <section
          className="flex min-h-[calc(100vh-2rem)] min-w-0 flex-col overflow-hidden rounded-3xl bg-white shadow-sm"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedId(null);
            }
          }}
        >
          <div
            className="flex min-h-0 flex-1 flex-col bg-slate-100"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedId(null);
              }
            }}
          >
            <div className="sticky top-0 z-[100] border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
              <div className="flex min-h-14 flex-wrap items-center justify-center gap-3">
                <div className="mr-4 leading-none">
                  <div className="mr-4 flex items-center">
                    <NextImage
                      src="/logo.png"
                      alt="NEGUN"
                      width={120}
                      height={32}
                      className="h-8 w-auto object-contain"
                      priority
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <ToolbarButton icon={Undo2} label="Буцаах" onClick={undo} />
                  <ToolbarButton icon={Redo2} label="Дахин" onClick={redo} />
                  <ToolbarButton
                    icon={Type}
                    label="Текст"
                    onClick={() => changeRole("support")}
                  />
                  <ToolbarButton
                    icon={ImagePlus}
                    label="Лого"
                    onClick={() => logoInputRef.current?.click()}
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
                      onClick={() =>
                        setScale((prev) => Math.min(prev + 0.01, 3))
                      }
                      type="button"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div
                    className="relative"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <button
                      onClick={() => setLayoutMenuOpen((prev) => !prev)}
                      className="rounded-xl border px-4 py-1.5 text-sm font-medium bg-white"
                    >
                      {layoutLabelMap[layoutType]} ▼
                    </button>

                    {layoutMenuOpen && (
                      <div className="absolute top-full left-0 mt-2 w-48 rounded-2xl border bg-white shadow-xl p-2 z-50">
                        <button
                          onClick={() => {
                            applyLayout("center");
                            setLayoutMenuOpen(false);
                          }}
                          className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-100"
                        >
                          Center
                        </button>
                        <button
                          onClick={() => {
                            applyLayout("hero");
                            setLayoutMenuOpen(false);
                          }}
                          className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-100"
                        >
                          Hero
                        </button>
                        <button
                          onClick={() => {
                            applyLayout("split");
                            setLayoutMenuOpen(false);
                          }}
                          className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-100"
                        >
                          Split
                        </button>
                      </div>
                    )}
                  </div>

                  <ToolbarButton
                    icon={Printer}
                    label="PDF"
                    onClick={exportToPDF}
                  />
                  <button
                    onClick={() => setTipsOpen(true)}
                    className="rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50"
                  >
                    <Info className="h-5 w-5 text-slate-600" />
                  </button>
                  <ToolbarButton
                    icon={Printer}
                    label="Хэвлүүлэх"
                    onClick={() => setOrderOpen(true)}
                    variant="primary"
                  />
                </div>
              </div>
            </div>
            <div
              className="relative mx-auto flex min-h-0 flex-1 w-full items-start justify-start overflow-x-auto overflow-y-visible p-6 md:justify-center"
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
                    {includeCropMarks && (
                      <div className="pointer-events-none absolute inset-0 z-[90]">
                        {[
                          "left-0 top-0 border-l-2 border-t-2",
                          "right-0 top-0 border-r-2 border-t-2",
                          "left-0 bottom-0 border-l-2 border-b-2",
                          "right-0 bottom-0 border-r-2 border-b-2",
                        ].map((cls) => (
                          <div
                            key={cls}
                            className={`absolute h-6 w-6 border-red-500 ${cls}`}
                          />
                        ))}
                      </div>
                    )}

                    {isAiLoading && (
                      <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center rounded-[30px] bg-white/80 backdrop-blur-sm">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
                        <div className="mt-3 text-sm font-semibold text-slate-700">
                          AI таны загварыг бэлдэж байна...
                        </div>
                      </div>
                    )}

                    <CanvasStage
                      elements={elements}
                      selectedId={selectedId}
                      scale={scale}
                      docWidth={previewCanvasWidth}
                      docHeight={previewCanvasHeight}
                      previewBleed={previewBleed}
                      previewSafe={previewSafe}
                      onSelect={setSelectedId}
                      onDelete={(id) => {
                        const base = Array.isArray(elementsRef.current)
                          ? elementsRef.current
                          : [];
                        const next = base.filter((el) => el.id !== id);
                        setSelectedId(null);
                        pushHistory(next);
                      }}
                      onPatch={(id, patch) => {
                        patchElement(id, patch);
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
                    {guides.vertical !== null && (
                      <div
                        className="pointer-events-none absolute z-40 rounded-full"
                        style={{
                          left: guides.vertical * scale - 5,
                          top: 12,
                          width: 10,
                          height: 10,
                          backgroundColor: GUIDE_COLOR,
                          boxShadow: `0 0 0 4px ${GUIDE_COLOR}22, 0 0 16px ${GUIDE_COLOR}AA`,
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
                    {guides.horizontal !== null && (
                      <div
                        className="pointer-events-none absolute z-40 rounded-full"
                        style={{
                          left: 12,
                          top: guides.horizontal * scale - 5,
                          width: 10,
                          height: 10,
                          backgroundColor: GUIDE_COLOR,
                          boxShadow: `0 0 0 4px ${GUIDE_COLOR}22, 0 0 16px ${GUIDE_COLOR}AA`,
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

            <div className="flex h-10 shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 text-xs text-slate-500">
              <div className="font-medium text-slate-700">
                {doc.widthMm || "—"} × {doc.heightMm || "—"} mm
              </div>
              <div>{EXPORT_DPI} DPI</div>
              <div>Scale: {Math.round(scale * 100)}%</div>
            </div>
          </div>
        </section>
      </div>
      {orderOpen && (
        <OrderModal
          name={name}
          phone={phone}
          isSendingOrder={isSendingOrder}
          onNameChange={setName}
          onPhoneChange={setPhone}
          onSubmit={handleOrder}
          onClose={() => setOrderOpen(false)}
        />
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
      <AiTipsModal
        open={tipsOpen}
        onClose={() => setTipsOpen(false)}
        aiTips={aiTips}
      />
    </main>
  );
}
