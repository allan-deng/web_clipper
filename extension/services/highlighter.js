/**
 * Highlighter Service
 * 
 * Manages text selection, highlighting, and annotations on web pages.
 */

// Highlight data storage
let highlights = [];
let highlightIdCounter = 0;
let currentColor = 'yellow';
let isHighlightMode = false;

// UI Elements
let selectionMenu = null;
let notePopup = null;
let highlightCountBadge = null;

// Color definitions
const COLORS = {
  yellow: '#ffeb3b',
  green: '#4caf50',
  blue: '#2196f3',
  pink: '#e91e63',
  purple: '#9c27b0'
};

/**
 * Initialize the highlighter service
 */
export function initHighlighter() {
  // Load existing highlights from storage
  loadHighlights();
  
  // Create UI elements
  createSelectionMenu();
  createNotePopup();
  createHighlightCountBadge();
  
  // Set up event listeners
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);
  
  console.log('Highlighter service initialized');
}

/**
 * Handle mouse up event (text selection)
 */
function handleMouseUp(event) {
  // Ignore if clicking on our UI elements
  if (event.target.closest('.owc-selection-menu, .owc-note-popup')) {
    return;
  }
  
  // Hide menu if clicking elsewhere
  if (!window.getSelection().toString().trim()) {
    hideSelectionMenu();
    return;
  }
  
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText.length > 0) {
    showSelectionMenu(event.clientX, event.clientY, selection);
  }
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyDown(event) {
  // Escape to close menus
  if (event.key === 'Escape') {
    hideSelectionMenu();
    hideNotePopup();
  }
  
  // Ctrl/Cmd + H to highlight selection
  if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
    const selection = window.getSelection();
    if (selection.toString().trim()) {
      event.preventDefault();
      createHighlight(selection, currentColor, null);
    }
  }
}

/**
 * Create the selection menu UI
 */
function createSelectionMenu() {
  selectionMenu = document.createElement('div');
  selectionMenu.className = 'owc-selection-menu';
  selectionMenu.style.display = 'none';
  
  // Color picker
  const colorPicker = document.createElement('div');
  colorPicker.className = 'owc-color-picker';
  
  Object.keys(COLORS).forEach(color => {
    const btn = document.createElement('button');
    btn.className = `owc-color-btn ${color}`;
    if (color === currentColor) btn.classList.add('active');
    btn.title = color.charAt(0).toUpperCase() + color.slice(1);
    btn.onclick = () => selectColor(color);
    colorPicker.appendChild(btn);
  });
  
  selectionMenu.appendChild(colorPicker);
  
  // Highlight button
  const highlightBtn = document.createElement('button');
  highlightBtn.className = 'owc-menu-btn';
  highlightBtn.innerHTML = '🖍️';
  highlightBtn.title = 'Highlight';
  highlightBtn.onclick = handleHighlightClick;
  selectionMenu.appendChild(highlightBtn);
  
  // Note button
  const noteBtn = document.createElement('button');
  noteBtn.className = 'owc-menu-btn';
  noteBtn.innerHTML = '📝';
  noteBtn.title = 'Highlight with note';
  noteBtn.onclick = handleNoteClick;
  selectionMenu.appendChild(noteBtn);
  
  document.body.appendChild(selectionMenu);
}

/**
 * Create the note popup UI
 */
function createNotePopup() {
  notePopup = document.createElement('div');
  notePopup.className = 'owc-note-popup';
  notePopup.style.display = 'none';
  
  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Add a note...';
  textarea.id = 'owc-note-textarea';
  
  const actions = document.createElement('div');
  actions.className = 'owc-note-actions';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'owc-note-btn secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = hideNotePopup;
  
  const saveBtn = document.createElement('button');
  saveBtn.className = 'owc-note-btn primary';
  saveBtn.textContent = 'Save';
  saveBtn.onclick = handleNoteSave;
  
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  
  notePopup.appendChild(textarea);
  notePopup.appendChild(actions);
  
  document.body.appendChild(notePopup);
}

/**
 * Create highlight count badge
 */
function createHighlightCountBadge() {
  highlightCountBadge = document.createElement('div');
  highlightCountBadge.className = 'owc-highlight-count';
  document.body.appendChild(highlightCountBadge);
  updateHighlightCount();
}

/**
 * Show selection menu near cursor
 */
function showSelectionMenu(x, y, selection) {
  // Store selection for later use
  selectionMenu.dataset.selection = JSON.stringify({
    text: selection.toString(),
    rangeData: serializeRange(selection.getRangeAt(0))
  });
  
  // Position menu
  const menuWidth = 200;
  const menuHeight = 50;
  
  let left = x - menuWidth / 2;
  let top = y + 10;
  
  // Keep within viewport
  if (left < 10) left = 10;
  if (left + menuWidth > window.innerWidth - 10) {
    left = window.innerWidth - menuWidth - 10;
  }
  if (top + menuHeight > window.innerHeight - 10) {
    top = y - menuHeight - 10;
  }
  
  selectionMenu.style.left = `${left}px`;
  selectionMenu.style.top = `${top}px`;
  selectionMenu.style.display = 'flex';
}

/**
 * Hide selection menu
 */
function hideSelectionMenu() {
  if (selectionMenu) {
    selectionMenu.style.display = 'none';
  }
}

/**
 * Hide note popup
 */
function hideNotePopup() {
  if (notePopup) {
    notePopup.style.display = 'none';
    notePopup.querySelector('textarea').value = '';
  }
}

/**
 * Select highlight color
 */
function selectColor(color) {
  currentColor = color;
  
  // Update active state
  selectionMenu.querySelectorAll('.owc-color-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.classList.contains(color)) {
      btn.classList.add('active');
    }
  });
}

/**
 * Handle highlight button click
 */
function handleHighlightClick() {
  const selectionData = JSON.parse(selectionMenu.dataset.selection || '{}');
  if (selectionData.text) {
    const range = deserializeRange(selectionData.rangeData);
    if (range) {
      createHighlight(range, currentColor, null);
    }
  }
  hideSelectionMenu();
  window.getSelection().removeAllRanges();
}

/**
 * Handle note button click
 */
function handleNoteClick() {
  const rect = selectionMenu.getBoundingClientRect();
  
  notePopup.style.left = `${rect.left}px`;
  notePopup.style.top = `${rect.bottom + 10}px`;
  notePopup.style.display = 'block';
  
  const textarea = notePopup.querySelector('textarea');
  textarea.focus();
  
  // Store selection data in note popup
  notePopup.dataset.selection = selectionMenu.dataset.selection;
  
  hideSelectionMenu();
}

/**
 * Handle note save
 */
function handleNoteSave() {
  const textarea = notePopup.querySelector('textarea');
  const note = textarea.value.trim();
  const selectionData = JSON.parse(notePopup.dataset.selection || '{}');
  
  if (selectionData.text) {
    const range = deserializeRange(selectionData.rangeData);
    if (range) {
      createHighlight(range, currentColor, note || null);
    }
  }
  
  hideNotePopup();
  window.getSelection().removeAllRanges();
}

/**
 * Create a highlight from a range
 */
function createHighlight(rangeOrSelection, color, note) {
  let range;
  
  if (rangeOrSelection instanceof Range) {
    range = rangeOrSelection;
  } else if (rangeOrSelection.getRangeAt) {
    range = rangeOrSelection.getRangeAt(0);
  } else {
    return null;
  }
  
  const text = range.toString().trim();
  if (!text) return null;
  
  // Create highlight wrapper
  const wrapper = document.createElement('span');
  wrapper.className = `owc-highlight color-${color}`;
  if (note) wrapper.classList.add('has-note');
  
  const highlightId = `highlight-${++highlightIdCounter}`;
  wrapper.dataset.highlightId = highlightId;
  wrapper.dataset.note = note || '';
  
  try {
    range.surroundContents(wrapper);
  } catch (e) {
    // Range crosses multiple elements, use alternative method
    console.warn('Cannot surround contents, using alternative method');
    const contents = range.extractContents();
    wrapper.appendChild(contents);
    range.insertNode(wrapper);
  }
  
  // Store highlight data
  const highlight = {
    id: highlightId,
    text,
    note,
    color: COLORS[color],
    position: highlights.length,
    createdAt: new Date().toISOString()
  };
  
  highlights.push(highlight);
  saveHighlights();
  updateHighlightCount();
  
  // Add click handler for editing
  wrapper.addEventListener('click', () => showHighlightOptions(wrapper, highlight));
  
  return highlight;
}

/**
 * Show options for existing highlight
 */
function showHighlightOptions(element, highlight) {
  // For now, just allow removing on right-click
  // Could expand to edit note, change color, etc.
}

/**
 * Serialize a Range for storage
 */
function serializeRange(range) {
  return {
    startContainerPath: getNodePath(range.startContainer),
    startOffset: range.startOffset,
    endContainerPath: getNodePath(range.endContainer),
    endOffset: range.endOffset
  };
}

/**
 * Deserialize a Range from storage
 */
function deserializeRange(data) {
  if (!data) return null;
  
  try {
    const startContainer = getNodeFromPath(data.startContainerPath);
    const endContainer = getNodeFromPath(data.endContainerPath);
    
    if (!startContainer || !endContainer) return null;
    
    const range = document.createRange();
    range.setStart(startContainer, data.startOffset);
    range.setEnd(endContainer, data.endOffset);
    
    return range;
  } catch (e) {
    console.error('Failed to deserialize range:', e);
    return null;
  }
}

/**
 * Get a path to a node for serialization
 */
function getNodePath(node) {
  const path = [];
  let current = node;
  
  while (current && current !== document.body) {
    const parent = current.parentNode;
    if (!parent) break;
    
    const index = Array.from(parent.childNodes).indexOf(current);
    path.unshift(index);
    current = parent;
  }
  
  return path;
}

/**
 * Get a node from a path
 */
function getNodeFromPath(path) {
  let current = document.body;
  
  for (const index of path) {
    if (!current.childNodes[index]) return null;
    current = current.childNodes[index];
  }
  
  return current;
}

/**
 * Update highlight count badge
 */
function updateHighlightCount() {
  if (highlightCountBadge) {
    if (highlights.length > 0) {
      highlightCountBadge.textContent = `📌 ${highlights.length} highlight${highlights.length > 1 ? 's' : ''}`;
      highlightCountBadge.classList.add('visible');
    } else {
      highlightCountBadge.classList.remove('visible');
    }
  }
}

/**
 * Save highlights to session storage
 */
function saveHighlights() {
  try {
    sessionStorage.setItem('owc-highlights', JSON.stringify(highlights));
  } catch (e) {
    console.warn('Failed to save highlights:', e);
  }
}

/**
 * Load highlights from session storage
 */
function loadHighlights() {
  try {
    const saved = sessionStorage.getItem('owc-highlights');
    if (saved) {
      highlights = JSON.parse(saved);
      highlightIdCounter = highlights.length;
    }
  } catch (e) {
    console.warn('Failed to load highlights:', e);
    highlights = [];
  }
}

/**
 * Get all highlights for export
 * @returns {Array} Array of highlight objects
 */
export function getHighlights() {
  return highlights.map(h => ({
    text: h.text,
    note: h.note || null,
    color: h.color,
    position: h.position
  }));
}

/**
 * Clear all highlights
 */
export function clearHighlights() {
  // Remove highlight elements from DOM
  document.querySelectorAll('.owc-highlight').forEach(el => {
    const parent = el.parentNode;
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el);
    }
    parent.removeChild(el);
  });
  
  highlights = [];
  highlightIdCounter = 0;
  saveHighlights();
  updateHighlightCount();
}

/**
 * Enable/disable highlight mode
 */
export function setHighlightMode(enabled) {
  isHighlightMode = enabled;
  document.body.classList.toggle('owc-highlight-mode', enabled);
}

export default {
  initHighlighter,
  getHighlights,
  clearHighlights,
  setHighlightMode
};
