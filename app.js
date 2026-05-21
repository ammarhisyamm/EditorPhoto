const canvas = document.querySelector("#editorCanvas");
const ctx = canvas.getContext("2d");
const photoInput = document.querySelector("#photoInput");
const uploadButton = document.querySelector(".upload-btn");
const downloadBtn = document.querySelector("#downloadBtn");
const emptyState = document.querySelector("#emptyState");
const canvasFrame = document.querySelector(".canvas-frame");
const formatSelect = document.querySelector("#formatSelect");
const formatNote = document.querySelector("#formatNote");
const imageFitSelect = document.querySelector("#imageFitSelect");
const comboLayoutSelect = document.querySelector("#comboLayoutSelect");
const comboLayoutGroup = document.querySelector("#comboLayoutGroup");
const shapeSelect = document.querySelector("#shapeSelect");
const shapeColor = document.querySelector("#shapeColor");
const shapeHex = document.querySelector("#shapeHex");
const backgroundColor = document.querySelector("#backgroundColor");
const backgroundHex = document.querySelector("#backgroundHex");
const customDrawer = document.querySelector("#customDrawer");
const shapePad = document.querySelector("#shapePad");
const padCtx = shapePad.getContext("2d");
const clearCustomBtn = document.querySelector("#clearCustomBtn");
const controls = {
  count: document.querySelector("#countRange"),
  size: document.querySelector("#sizeRange"),
  opacity: document.querySelector("#opacityRange"),
  rotation: document.querySelector("#rotationRange"),
  points: document.querySelector("#pointsRange"),
  seed: document.querySelector("#seedRange"),
};
const labels = {
  count: document.querySelector("#countValue"),
  size: document.querySelector("#sizeValue"),
  opacity: document.querySelector("#opacityValue"),
  rotation: document.querySelector("#rotationValue"),
  points: document.querySelector("#pointsValue"),
  seed: document.querySelector("#seedValue"),
};

const state = {
  image: null,
  mode: "stickers",
  format: "portrait",
  customPoints: [],
  drawingCustom: false,
};

const formats = {
  portrait: {
    label: "Portrait 4:5",
    width: 900,
    height: 1125,
  },
  landscape: {
    label: "Landscape 5:4",
    width: 1125,
    height: 900,
  },
  "ratio-3-4": {
    label: "Portrait 3:4",
    width: 900,
    height: 1200,
  },
  "ratio-4-3": {
    label: "Landscape 4:3",
    width: 1200,
    height: 900,
  },
  square: {
    label: "Square 1:1",
    width: 1080,
    height: 1080,
  },
  story: {
    label: "Story 9:16",
    width: 1080,
    height: 1920,
  },
  wide: {
    label: "Wide 16:9",
    width: 1920,
    height: 1080,
  },
};



function readValues() {
  return {
    count: Number(controls.count.value),
    size: Number(controls.size.value),
    opacity: Number(controls.opacity.value) / 100,
    rotation: Number(controls.rotation.value),
    points: Number(controls.points.value),
    seed: Number(controls.seed.value),
    shape: shapeSelect.value,
    shapeColor: shapeColor.value,
    backgroundColor: backgroundColor.value,
    imageFit: imageFitSelect ? imageFitSelect.value : "cover-center",
    comboLayout: comboLayoutSelect ? comboLayoutSelect.value : "top",
  };
}

function syncLabels() {
  labels.count.textContent = controls.count.value;
  labels.size.textContent = controls.size.value;
  labels.opacity.textContent = `${controls.opacity.value}%`;
  labels.rotation.textContent = controls.rotation.value;
  labels.points.textContent = controls.points.value;
  labels.seed.textContent = controls.seed.value;
}

function applyFormat(formatKey) {
  const format = formats[formatKey] ?? formats.portrait;
  state.format = formatKey;
  canvas.width = format.width;
  canvas.height = format.height;
  canvasFrame.style.setProperty("--preview-ratio", `${format.width} / ${format.height}`);
  updatePreviewFit();
  formatNote.textContent = `${format.label} - ${format.width} x ${format.height} px`;
}

function updatePreviewFit() {
  const format = formats[state.format] ?? formats.portrait;
  const availableHeight = Math.max(360, window.innerHeight - 210);
  const fitWidth = Math.min(760, availableHeight * (format.width / format.height));
  canvasFrame.style.setProperty("--preview-fit-width", `${Math.round(fitWidth)}px`);
}

function normalizeHex(value, allowShort = true) {
  const trimmed = value.trim();
  const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  const pattern = allowShort
    ? /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
    : /^[0-9a-fA-F]{6}$/;
  if (!pattern.test(withoutHash)) return null;

  const expanded =
    withoutHash.length === 3
      ? withoutHash
          .split("")
          .map((character) => character + character)
          .join("")
      : withoutHash;

  return `#${expanded.toLowerCase()}`;
}

function syncHexInput(colorInput, hexInput) {
  hexInput.value = colorInput.value.toUpperCase();
  hexInput.classList.remove("invalid");
}

function createRandom(seed) {
  let value = seed * 9301 + 49297;
  return () => {
    value = (value * 233280 + 49297) % 2147483647;
    return value / 2147483647;
  };
}

function calculateImageRect(image, targetWidth, targetHeight, fitMode = "cover-center") {
  const imageRatio = image.width / image.height;
  const targetRatio = targetWidth / targetHeight;
  let width = targetWidth;
  let height = targetHeight;
  
  const isCover = fitMode.startsWith("cover");
  const align = fitMode.split("-")[1];

  if (isCover) {
    if (imageRatio > targetRatio) {
      height = targetHeight;
      width = height * imageRatio;
    } else {
      width = targetWidth;
      height = width / imageRatio;
    }
  } else {
    if (imageRatio > targetRatio) {
      width = targetWidth;
      height = width / imageRatio;
    } else {
      height = targetHeight;
      width = height * imageRatio;
    }
  }

  let x = (targetWidth - width) / 2;
  let y = (targetHeight - height) / 2;

  if (align === "top") y = 0;
  if (align === "bottom") y = targetHeight - height;

  return { x, y, width, height };
}

function makePattern(values) {
  const random = createRandom(values.seed);
  const shapes = [];
  const edgePadding = values.size * 0.25;

  for (let index = 0; index < values.count; index += 1) {
    const sizeJitter = 0.62 + random() * 0.74;
    shapes.push({
      x: edgePadding + random() * (canvas.width - edgePadding * 2),
      y: edgePadding + random() * (canvas.height - edgePadding * 2),
      radius: (values.size * sizeJitter) / 2,
      rotation:
        ((random() - 0.5) * values.rotation * Math.PI) / 90 + index * 0.08,
      alpha: 0.78 + random() * 0.22,
    });
  }

  return shapes;
}

function drawShapePath(context, type, radius, points) {
  const safePoints = Math.max(3, points);

  if (type === "circle") {
    context.arc(0, 0, radius, 0, Math.PI * 2);
    return;
  }

  if (type === "diamond") {
    context.moveTo(0, -radius);
    context.lineTo(radius, 0);
    context.lineTo(0, radius);
    context.lineTo(-radius, 0);
    context.closePath();
    return;
  }

  if (type === "heart") {
    const scale = radius / 18;
    context.moveTo(0, 7 * scale);
    context.bezierCurveTo(-18 * scale, -3 * scale, -11 * scale, -19 * scale, 0, -10 * scale);
    context.bezierCurveTo(11 * scale, -19 * scale, 18 * scale, -3 * scale, 0, 7 * scale);
    context.closePath();
    return;
  }

  if (type === "flower") {
    const lobes = safePoints;
    for (let i = 0; i <= lobes; i += 1) {
      const angle = (i / lobes) * Math.PI * 2 - Math.PI / 2;
      const nextAngle = ((i + 0.5) / lobes) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius * 0.72;
      const y = Math.sin(angle) * radius * 0.72;
      const cx = Math.cos(nextAngle) * radius * 1.08;
      const cy = Math.sin(nextAngle) * radius * 1.08;
      const nx = Math.cos(angle + (Math.PI * 2) / lobes) * radius * 0.72;
      const ny = Math.sin(angle + (Math.PI * 2) / lobes) * radius * 0.72;
      if (i === 0) context.moveTo(x, y);
      context.quadraticCurveTo(cx, cy, nx, ny);
    }
    context.closePath();
    return;
  }

  if (type === "sparkle") {
    const coordinates = [
      [0, -1],
      [0.16, -0.18],
      [1, 0],
      [0.16, 0.18],
      [0, 1],
      [-0.16, 0.18],
      [-1, 0],
      [-0.16, -0.18],
    ];
    coordinates.forEach(([x, y], index) => {
      const px = x * radius;
      const py = y * radius;
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.closePath();
    return;
  }

  if (type === "custom" && state.customPoints.length > 2) {
    state.customPoints.forEach((point, index) => {
      const x = point.x * radius * 2;
      const y = point.y * radius * 2;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    return;
  }

  const spikes = type === "star" ? safePoints : safePoints * 2;
  const inner = type === "star" ? 0.42 : 0.6;
  for (let i = 0; i < spikes * 2; i += 1) {
    const currentRadius = i % 2 === 0 ? radius : radius * inner;
    const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * currentRadius;
    const y = Math.sin(angle) * currentRadius;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function drawSingleShape(context, item, values, fillStyle) {
  context.save();
  context.translate(item.x, item.y);
  context.rotate(item.rotation);
  context.beginPath();
  drawShapePath(context, values.shape, item.radius, values.points);
  context.fillStyle = fillStyle;
  context.globalAlpha = values.opacity * item.alpha;
  context.fill();
  context.restore();
}

function drawPhoto(context) {
  if (!state.image) return;
  const values = readValues();
  const rect = calculateImageRect(state.image, canvas.width, canvas.height, values.imageFit);
  context.drawImage(state.image, rect.x, rect.y, rect.width, rect.height);
}

function drawCutoutLayer(values, pattern, bounds = null) {
  const overlay = document.createElement("canvas");
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  const overlayCtx = overlay.getContext("2d");
  const layerBounds = bounds ?? {
    x: 0,
    y: 0,
    width: overlay.width,
    height: overlay.height,
  };

  overlayCtx.fillStyle = values.backgroundColor;
  overlayCtx.fillRect(
    layerBounds.x,
    layerBounds.y,
    layerBounds.width,
    layerBounds.height,
  );
  overlayCtx.save();
  overlayCtx.beginPath();
  overlayCtx.rect(
    layerBounds.x,
    layerBounds.y,
    layerBounds.width,
    layerBounds.height,
  );
  overlayCtx.clip();
  overlayCtx.globalCompositeOperation = "destination-out";
  pattern.forEach((item) =>
    drawSingleShape(overlayCtx, { ...item, alpha: 1 }, { ...values, opacity: 1 }, "#000"),
  );
  overlayCtx.restore();

  ctx.drawImage(overlay, 0, 0);
}

function drawComboComposition(values, pattern) {
  const splitY = Math.round(canvas.height * 0.52);
  let cutoutBounds, bottomBounds;

  if (values.comboLayout === "top") {
    cutoutBounds = { x: 0, y: 0, width: canvas.width, height: splitY };
    bottomBounds = { x: 0, y: splitY, width: canvas.width, height: canvas.height - splitY };
  } else if (values.comboLayout === "bottom") {
    cutoutBounds = { x: 0, y: canvas.height - splitY, width: canvas.width, height: splitY };
    bottomBounds = { x: 0, y: 0, width: canvas.width, height: canvas.height - splitY };
  } else if (values.comboLayout === "center") {
    const margin = Math.round(canvas.height * 0.24);
    cutoutBounds = { x: 0, y: margin, width: canvas.width, height: canvas.height - margin * 2 };
    bottomBounds = [
      { x: 0, y: 0, width: canvas.width, height: margin },
      { x: 0, y: canvas.height - margin, width: canvas.width, height: margin }
    ];
  }

  drawCutoutLayer(values, pattern, cutoutBounds);

  const drawShapesOnBounds = (bounds) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.clip();
    pattern.forEach((item) => drawSingleShape(ctx, item, values, values.shapeColor));
    ctx.restore();
  };

  if (Array.isArray(bottomBounds)) {
    bottomBounds.forEach(drawShapesOnBounds);
  } else {
    drawShapesOnBounds(bottomBounds);
  }
}

function render() {
  syncLabels();
  customDrawer.classList.toggle("visible", shapeSelect.value === "custom");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!state.image) {
    downloadBtn.disabled = true;
    emptyState.classList.remove("hidden");
    return;
  }

  const values = readValues();
  const pattern = makePattern(values);
  downloadBtn.disabled = false;
  emptyState.classList.add("hidden");

  ctx.fillStyle = values.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawPhoto(ctx);

  if (state.mode === "combo") {
    drawComboComposition(values, pattern);
    return;
  }

  if (state.mode === "cutout") {
    drawCutoutLayer(values, pattern);
    return;
  }

  pattern.forEach((item) => drawSingleShape(ctx, item, values, values.shapeColor));
}

function setMode(mode) {
  const wasCombo = state.mode === "combo";
  state.mode = mode;
  document
    .querySelectorAll(".segmented button")
    .forEach((item) => item.classList.toggle("active", item.dataset.mode === mode));
    
  if (comboLayoutGroup) {
    comboLayoutGroup.style.display = mode === "combo" ? "grid" : "none";
  }

  if (mode === "combo" && !wasCombo) {
    shapeSelect.value = "circle";
    controls.count.value = 54;
    controls.size.value = 92;
    controls.opacity.value = 68;
    controls.rotation.value = 0;
  }
}



function extractDominantColors(img) {
  const c = document.createElement("canvas");
  const cx = c.getContext("2d");
  c.width = 64;
  c.height = 64;
  cx.drawImage(img, 0, 0, 64, 64);
  const data = cx.getImageData(0, 0, 64, 64).data;
  const bins = {};
  
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 128) continue;
    const r = Math.round(data[i] / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;
    const key = `${r},${g},${b}`;
    bins[key] = (bins[key] || 0) + 1;
  }
  
  const sorted = Object.entries(bins).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return ["#ffffff", "#000000"];
  
  const parseKey = (key) => key.split(",").map(Number);
  const rgbToHex = (r, g, b) =>
    "#" + [r, g, b].map((x) => Math.min(255, x).toString(16).padStart(2, "0")).join("");
    
  const color1 = parseKey(sorted[0][0]);
  let color2 = color1;
  
  for (let i = 1; i < sorted.length; i++) {
    const rgb = parseKey(sorted[i][0]);
    const dist = Math.abs(rgb[0] - color1[0]) + Math.abs(rgb[1] - color1[1]) + Math.abs(rgb[2] - color1[2]);
    if (dist > 100) {
      color2 = rgb;
      break;
    }
  }
  
  if (color2 === color1) {
    color2 = [255 - color1[0], 255 - color1[1], 255 - color1[2]];
  }
  
  return [rgbToHex(...color1), rgbToHex(...color2)];
}

function loadImage(file) {
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      state.image = image;
      const [bgHex, shapeHexColor] = extractDominantColors(image);
      backgroundColor.value = bgHex;
      shapeColor.value = shapeHexColor;
      syncHexInput(backgroundColor, backgroundHex);
      syncHexInput(shapeColor, shapeHex);
      render();
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function loadDemoImage() {
  const demoCanvas = document.createElement("canvas");
  demoCanvas.width = 900;
  demoCanvas.height = 1125;
  const demoCtx = demoCanvas.getContext("2d");
  const gradient = demoCtx.createLinearGradient(0, 0, 0, demoCanvas.height);
  gradient.addColorStop(0, "#8bd4ff");
  gradient.addColorStop(0.55, "#d7efff");
  gradient.addColorStop(1, "#2e403b");

  demoCtx.fillStyle = gradient;
  demoCtx.fillRect(0, 0, demoCanvas.width, demoCanvas.height);
  demoCtx.fillStyle = "#24342f";
  demoCtx.beginPath();
  demoCtx.ellipse(450, 720, 230, 350, -0.16, 0, Math.PI * 2);
  demoCtx.fill();
  demoCtx.fillStyle = "#f2b79d";
  demoCtx.beginPath();
  demoCtx.arc(425, 385, 92, 0, Math.PI * 2);
  demoCtx.fill();
  demoCtx.fillStyle = "#111";
  demoCtx.beginPath();
  demoCtx.ellipse(414, 324, 108, 45, -0.12, 0, Math.PI * 2);
  demoCtx.fill();
  demoCtx.fillStyle = "#ffffff";
  demoCtx.fillRect(387, 399, 74, 16);
  demoCtx.fillStyle = "#814d43";
  demoCtx.fillRect(0, 990, 900, 135);

  const image = new Image();
  image.onload = () => {
    state.image = image;
    render();
  };
  image.src = demoCanvas.toDataURL("image/png");
}

function normalizePadPoints(points) {
  if (points.length < 3) return [];

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const size = Math.max(width, height);
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  return points.map((point) => ({
    x: (point.x - centerX) / size,
    y: (point.y - centerY) / size,
  }));
}

function drawPadGuide() {
  padCtx.clearRect(0, 0, shapePad.width, shapePad.height);
  padCtx.strokeStyle = "#b8b2a4";
  padCtx.lineWidth = 1;
  padCtx.setLineDash([5, 5]);
  padCtx.beginPath();
  padCtx.arc(shapePad.width / 2, shapePad.height / 2, 68, 0, Math.PI * 2);
  padCtx.stroke();
  padCtx.setLineDash([]);
}

function drawCustomPreview(points = []) {
  drawPadGuide();
  const displayPoints =
    points.length > 0
      ? points
      : state.customPoints.map((point) => ({
          x: point.x * 136 + shapePad.width / 2,
          y: point.y * 136 + shapePad.height / 2,
        }));

  if (displayPoints.length < 2) return;

  padCtx.lineWidth = 4;
  padCtx.lineJoin = "round";
  padCtx.lineCap = "round";
  padCtx.strokeStyle = shapeColor.value;
  padCtx.fillStyle = `${shapeColor.value}33`;
  padCtx.beginPath();
  displayPoints.forEach((point, index) => {
    if (index === 0) padCtx.moveTo(point.x, point.y);
    else padCtx.lineTo(point.x, point.y);
  });
  if (!state.drawingCustom) padCtx.closePath();
  padCtx.stroke();
  if (!state.drawingCustom) padCtx.fill();
}

function getPadPoint(event) {
  const rect = shapePad.getBoundingClientRect();
  const scaleX = shapePad.width / rect.width;
  const scaleY = shapePad.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

let livePadPoints = [];

photoInput.addEventListener("change", (event) => {
  loadImage(event.target.files[0]);
});

formatSelect.addEventListener("input", () => {
  applyFormat(formatSelect.value);
  render();
});

uploadButton.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  photoInput.click();
});

document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
    render();
  });
});



[shapeSelect, imageFitSelect, comboLayoutSelect, ...Object.values(controls)].forEach(
  (element) => {
    if (!element) return;
    element.addEventListener("input", () => {
      drawCustomPreview();
      render();
    });
  },
);

[
  [shapeColor, shapeHex],
  [backgroundColor, backgroundHex],
].forEach(([colorInput, hexInput]) => {
  colorInput.addEventListener("input", () => {
    syncHexInput(colorInput, hexInput);
    drawCustomPreview();
    render();
  });

  hexInput.addEventListener("input", () => {
    const normalized = normalizeHex(hexInput.value, false);
    const hasPossiblyValidCharacters = /^#?[0-9a-fA-F]*$/.test(hexInput.value);

    hexInput.classList.toggle(
      "invalid",
      hexInput.value.length > 0 &&
        (!hasPossiblyValidCharacters || hexInput.value.replace("#", "").length > 6),
    );

    if (!normalized) return;
    colorInput.value = normalized;
    hexInput.value = normalized.toUpperCase();
    hexInput.classList.remove("invalid");
    drawCustomPreview();
    render();
  });

  hexInput.addEventListener("blur", () => {
    const normalized = normalizeHex(hexInput.value);
    if (normalized) {
      colorInput.value = normalized;
      syncHexInput(colorInput, hexInput);
      render();
      return;
    }

    syncHexInput(colorInput, hexInput);
  });
});

downloadBtn.addEventListener("click", () => {
  render();
  const link = document.createElement("a");
  link.download = "shape-photo-editor.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

shapePad.addEventListener("pointerdown", (event) => {
  state.drawingCustom = true;
  livePadPoints = [getPadPoint(event)];
  shapePad.setPointerCapture(event.pointerId);
  drawCustomPreview(livePadPoints);
});

shapePad.addEventListener("pointermove", (event) => {
  if (!state.drawingCustom) return;
  const point = getPadPoint(event);
  const lastPoint = livePadPoints[livePadPoints.length - 1];
  const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
  if (distance > 3) livePadPoints.push(point);
  drawCustomPreview(livePadPoints);
});

shapePad.addEventListener("pointerup", () => {
  state.drawingCustom = false;
  state.customPoints = normalizePadPoints(livePadPoints);
  livePadPoints = [];
  drawCustomPreview();
  render();
});

clearCustomBtn.addEventListener("click", () => {
  state.customPoints = [];
  drawCustomPreview();
  render();
});

canvas.addEventListener("dragover", (event) => {
  event.preventDefault();
});

canvas.addEventListener("drop", (event) => {
  event.preventDefault();
  loadImage(event.dataTransfer.files[0]);
});

emptyState.addEventListener("dragover", (event) => {
  event.preventDefault();
});

emptyState.addEventListener("drop", (event) => {
  event.preventDefault();
  loadImage(event.dataTransfer.files[0]);
});

emptyState.addEventListener("click", () => {
  photoInput.click();
});

window.addEventListener("resize", updatePreviewFit);

drawCustomPreview();
applyFormat(formatSelect.value);
render();

if (new URLSearchParams(window.location.search).get("demo") === "1") {
  loadDemoImage();
}
