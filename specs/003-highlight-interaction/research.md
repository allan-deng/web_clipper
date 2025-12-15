# 研究文档: 高亮交互优化

**功能分支**: `003-highlight-interaction`
**创建时间**: 2025-12-15
**状态**: 完成

## 研究摘要

此功能的技术实现路径明确，使用原生 DOM 事件和 CSS 实现。研究重点为浮窗定位策略和事件处理最佳实践。

## 研究任务

### R1: 浮窗定位策略

**Decision**: 使用 `getBoundingClientRect()` + 视口边界检测

**Rationale**: 
- 原生 API，无需额外依赖
- 返回相对于视口的精确坐标
- 可以轻松检测是否超出视口边界

**Implementation Strategy**:
```javascript
function getTooltipPosition(targetElement) {
  const rect = targetElement.getBoundingClientRect();
  const tooltipWidth = 250;
  const tooltipMaxHeight = 200;
  
  let left = rect.left;
  let top = rect.bottom + 8; // 8px 间距
  
  // 右边界检测
  if (left + tooltipWidth > window.innerWidth) {
    left = window.innerWidth - tooltipWidth - 10;
  }
  
  // 下边界检测 - 如果下方空间不足，显示在上方
  if (top + tooltipMaxHeight > window.innerHeight) {
    top = rect.top - tooltipMaxHeight - 8;
  }
  
  return { left, top };
}
```

**Alternatives considered**:
- CSS `position: fixed` + transform: 更复杂，难以处理边界情况
- 第三方定位库 (Popper.js/Floating UI): 增加依赖，对此简单场景过于复杂

### R2: 悬停事件处理与防抖

**Decision**: 使用 mouseenter/mouseleave + 延迟隐藏机制

**Rationale**:
- mouseenter/mouseleave 不会冒泡，更精确
- 延迟隐藏允许用户将鼠标移入浮窗
- 简单的 setTimeout/clearTimeout 即可实现

**Implementation Pattern**:
```javascript
let hideTimeout = null;

function showTooltip(highlight) {
  clearTimeout(hideTimeout);
  // 显示逻辑...
}

function hideTooltipDelayed() {
  hideTimeout = setTimeout(() => {
    // 隐藏逻辑...
  }, 300); // 300ms 延迟
}

// 高亮区域事件
highlightEl.addEventListener('mouseenter', () => showTooltip(highlight));
highlightEl.addEventListener('mouseleave', hideTooltipDelayed);

// 浮窗区域事件 - 允许鼠标移入浮窗
tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
tooltip.addEventListener('mouseleave', hideTooltipDelayed);
```

### R3: 编辑器交互模式

**Decision**: 内联弹窗 + 快捷键支持

**Rationale**:
- 内联弹窗不阻断用户对页面的访问
- 快捷键提高效率 (Enter 保存, Escape 取消)
- 点击外部关闭符合常见 UX 模式

**Key Interactions**:
| 操作 | 行为 |
|------|------|
| 点击高亮 | 打开编辑器 |
| Enter (在 textarea 中) | 保存并关闭 |
| Escape | 取消并关闭 |
| 点击保存按钮 | 保存并关闭 |
| 点击取消按钮 | 取消并关闭 |
| 点击编辑器外部 | 取消并关闭 |
| 点击删除按钮 | 显示确认 |

### R4: 高亮删除与 DOM 恢复

**Decision**: 使用 parentNode.replaceChild 恢复原始文本

**Rationale**:
- 高亮元素是 span 包裹的文本
- 删除时需要将文本节点放回原位
- 需要从 highlights 数组中移除对应记录

**Implementation**:
```javascript
function removeHighlight(highlightId) {
  const wrapper = document.querySelector(`[data-highlight-id="${highlightId}"]`);
  if (wrapper && wrapper.parentNode) {
    const textNode = document.createTextNode(wrapper.textContent);
    wrapper.parentNode.replaceChild(textNode, wrapper);
    
    // 从数组中移除
    highlights = highlights.filter(h => h.id !== highlightId);
  }
}
```

### R5: 样式与主题一致性

**Decision**: 复用现有扩展 UI 变量

**Rationale**:
- 保持与 popup 和其他 UI 元素的视觉一致性
- 使用 CSS 变量便于主题切换

**CSS 变量复用**:
```css
.owc-note-tooltip {
  background: #1e1e1e;      /* --bg-primary */
  border: 1px solid #404040; /* --border */
  color: #e0e0e0;           /* --text-primary */
  border-radius: 8px;       /* --radius */
}

.owc-note-editor {
  background: #1e1e1e;
  border: 1px solid #7c3aed; /* --accent */
}
```

## 技术决策总结

| 决策点 | 选择 | 置信度 |
|--------|------|--------|
| 浮窗定位 | getBoundingClientRect + 边界检测 | 高 |
| 悬停处理 | mouseenter/mouseleave + 延迟隐藏 | 高 |
| 编辑器模式 | 内联弹窗 + 快捷键 | 高 |
| DOM 恢复 | replaceChild + 文本节点 | 高 |
| 样式 | 复用现有 CSS 变量 | 高 |

## 无需研究的领域

- **后端交互**: 此功能不涉及后端
- **持久化**: 高亮数据存储在内存中（与现有行为一致）
- **跨浏览器兼容**: 目标浏览器 (Chrome/Edge 88+) 完全支持所需 API
