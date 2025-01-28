let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let image = new Image();
let uploadedImage = null;
let drawing = false;
let lastX = 0;
let lastY = 0;
let brushSize = 5;
let undoStack = [];
let redoStack = [];
let isCropping = false;
let cropStartX, cropStartY, cropEndX, cropEndY;
let cropCanvasCopy;
let isDragging = false;
let offsetX = 0, offsetY = 0;
let dragOffsetX = 0, dragOffsetY = 0;
let startX = 0, startY = 0;

document.getElementById('upload').addEventListener('change', handleImageUpload);
document.getElementById('download').addEventListener('click', downloadImage);
document.getElementById('undo').addEventListener('click', undoAction);
document.getElementById('redo').addEventListener('click', redoAction);
document.getElementById('brightness').addEventListener('input', applyFilters);
document.getElementById('contrast').addEventListener('input', applyFilters);
document.getElementById('saturation').addEventListener('input', applyFilters);
document.getElementById('grayscale').addEventListener('click', applyGrayscale);
document.getElementById('blur').addEventListener('input', applyBlur);
document.getElementById('rotate').addEventListener('input', applyRotation);
document.getElementById('crop').addEventListener('click', activateCropMode);
document.getElementById('opacity').addEventListener('input', applyOpacity);
document.getElementById('draw').addEventListener('click', enableDrawing);
document.getElementById('clear-drawing').addEventListener('click', clearDrawing);
document.getElementById('brush-size').addEventListener('input', updateBrushSize);
document.getElementById('zoom-in').addEventListener('click', function () { scale += 0.1; applyZoom(); });
document.getElementById('zoom-out').addEventListener('click', function () { scale -= 0.1; applyZoom(); });

canvas.addEventListener('mousedown', startDragging);
canvas.addEventListener('mousemove', dragImage);
canvas.addEventListener('mouseup', stopDragging);
canvas.addEventListener('mouseleave', stopDragging);
canvas.addEventListener('mousedown', function(event) {
  if (isCropping) {
    startCropSelection(event);
  } else if (drawing) {
    startDrawing(event);
  }
});

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (file) {
    uploadedImage = file;
    const reader = new FileReader();
    reader.onload = function (e) {
      image.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

image.onload = function() {
  canvas.width = image.width;
  canvas.height = image.height;
  ctx.drawImage(image, 0, 0);
  saveState();
};

function applyFilters() {
  const brightness = document.getElementById('brightness').value;
  const contrast = document.getElementById('contrast').value;
  const saturation = document.getElementById('saturation').value;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = `brightness(${100 + parseInt(brightness)}%) contrast(${100 + parseInt(contrast)}%) saturate(${100 + parseInt(saturation)}%)`;
  ctx.drawImage(image, 0, 0);
  saveState();
}

let grayscaleApplied = false;

function applyGrayscale() {
  if (!grayscaleApplied) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = "grayscale(100%)";
    ctx.drawImage(image, 0, 0);
    grayscaleApplied = true;
  } else {
    removeGrayscale();
  }
  saveState();
}

function removeGrayscale() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = "none"; 
  ctx.drawImage(image, 0, 0);
  grayscaleApplied = false;
  saveState();
}

canvas.addEventListener("dblclick", function() {
  if (grayscaleApplied) {
    removeGrayscale();
  }
});

function applyBlur() {
  const blurValue = document.getElementById('blur').value;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = `blur(${blurValue}px)`;
  ctx.drawImage(image, 0, 0);
  saveState();
}

function applyRotation() {
  const rotate = document.getElementById('rotate').value;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(image, -canvas.width / 2, -canvas.height / 2);
  ctx.restore();
  saveState();
}

function activateCropMode() {
  isCropping = true;
  drawing = false;
  canvas.style.cursor = 'crosshair';
}

function startCropSelection(event) {
  cropCanvasCopy = document.createElement('canvas');
  cropCanvasCopy.width = canvas.width;
  cropCanvasCopy.height = canvas.height;
  const copyCtx = cropCanvasCopy.getContext('2d');
  copyCtx.drawImage(canvas, 0, 0);

  cropStartX = event.offsetX;
  cropStartY = event.offsetY;
  canvas.addEventListener('mousemove', drawCropSelection);
  canvas.addEventListener('mouseup', endCropSelection);
}

function drawCropSelection(event) {
  cropEndX = event.offsetX;
  cropEndY = event.offsetY;
  redrawCanvasWithCropPreview();
}

function redrawCanvasWithCropPreview() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(cropCanvasCopy, 0, 0);

  ctx.strokeStyle = 'blue';
  ctx.lineWidth = 5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.rect(
    Math.min(cropStartX, cropEndX),
    Math.min(cropStartY, cropEndY),
    Math.abs(cropEndX - cropStartX),
    Math.abs(cropEndY - cropStartY)
  );
  ctx.stroke();
}

function endCropSelection(event) {
  canvas.removeEventListener('mousemove', drawCropSelection);
  canvas.removeEventListener('mouseup', endCropSelection);

  cropEndX = event.offsetX;
  cropEndY = event.offsetY;
  performCrop();

  isCropping = false;
  canvas.style.cursor = 'default';
}

function performCrop() {
  const x = Math.min(cropStartX, cropEndX);
  const y = Math.min(cropStartY, cropEndY);
  const width = Math.abs(cropEndX - cropStartX);
  const height = Math.abs(cropEndY - cropStartY);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(cropCanvasCopy, x, y, width, height, 0, 0, width, height);

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(tempCanvas, 0, 0);

  image.src = tempCanvas.toDataURL();
  saveState();
}

function applyOpacity() {
  const opacity = document.getElementById('opacity').value;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = opacity;
  ctx.drawImage(image, 0, 0);
  saveState();
}

function enableDrawing() {
  drawing = true;
}

function clearDrawing() {
  drawing = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  saveState();
}

function updateBrushSize() {
  brushSize = document.getElementById('brush-size').value;
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseleave', stopDrawing);

function startDrawing(event) {
  if (drawing) {
    lastX = event.offsetX;
    lastY = event.offsetY;
  }
}

function draw(event) {
  if (!drawing) return;
  ctx.lineWidth = brushSize;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'black';
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(event.offsetX, event.offsetY);
  ctx.stroke();
  lastX = event.offsetX;
  lastY = event.offsetY;
}

function stopDrawing() {
  drawing = false;
}

function downloadImage() {
  const link = document.createElement('a');
  link.href = canvas.toDataURL();
  link.download = 'edited-image.png';
  link.click();
}

function saveState() {
  undoStack.push(canvas.toDataURL());
  redoStack = [];
}

function undoAction() {
  if (undoStack.length > 0) {
    const lastState = undoStack.pop();
    redoStack.push(canvas.toDataURL());
    const img = new Image();
    img.src = lastState;
    img.onload = function() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  }
}

function redoAction() {
  if (redoStack.length > 0) {
    const lastRedoState = redoStack.pop();
    undoStack.push(canvas.toDataURL());
    const img = new Image();
    img.src = lastRedoState;
    img.onload = function() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  }
}

let scale = 1;

function applyZoom() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
  saveState();
}

function startDragging(event) {
  if (event.button === 0) {  // Left mouse button
    isDragging = true;
    startX = event.offsetX - dragOffsetX;
    startY = event.offsetY - dragOffsetY;
  }
}

function dragImage(event) {
  if (isDragging) {
    let dx = event.offsetX - startX;
    let dy = event.offsetY - startY;
    
    dragOffsetX = dx;
    dragOffsetY = dy;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(dx, dy);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

function stopDragging() {
  if (isDragging) {
    isDragging = false;
  }
}

const lockButton = document.getElementById('lock');
let isLocked = false;

lockButton.addEventListener('click', () => {
  isLocked = !isLocked;

  if (isLocked) {
    lockButton.innerHTML = '<i class="bi bi-lock-fill"></i> Unlock Image';
    lockButton.classList.add('locked');
    canvas.style.pointerEvents = 'none';
  } else {
    lockButton.innerHTML = '<i class="bi bi-lock"></i> Lock Image';
    lockButton.classList.remove('locked');
    canvas.style.pointerEvents = 'auto';
  }
});

window.addEventListener('resize', () => {
  if (image.src) {
    const aspectRatio = image.width / image.height;
    const parent = canvas.parentElement;
    const maxWidth = parent.offsetWidth - 40;
    const maxHeight = parent.offsetHeight - 40;

    if (maxWidth / maxHeight > aspectRatio) {
      canvas.width = maxHeight * aspectRatio;
      canvas.height = maxHeight;
    } else {
      canvas.width = maxWidth;
      canvas.height = maxWidth / aspectRatio;
    }

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
});
