// 查词弹窗定位：保证弹窗始终完整落在可视区域内。
// 宽屏：浮在被点词的下方；下方空间不够且上方更宽裕时翻到上方；高度超出时内部滚动。
// 窄屏（< md，768px）：改成贴底的抽屉，避开底部工具栏。

export const POPUP_WIDTH = 340;
export const POPUP_MARGIN = 8;
export const SHEET_BREAKPOINT = 768;
// 下方至少要有这么多空间才优先放在词的下方
const PREFERRED_MIN_HEIGHT = 320;

export type PopupPlacement =
  | { mode: "sheet" }
  | { mode: "below"; left: number; top: number; maxHeight: number; width: number }
  | { mode: "above"; left: number; bottom: number; maxHeight: number; width: number };

interface PlacementInput {
  /** 被点词水平中心（视口坐标） */
  x: number;
  /** 被点词底边 + 间距（视口坐标） */
  y: number;
  /** 被点词顶边 - 间距（视口坐标）；缺省时按 y 估算 */
  anchorTop?: number;
  viewportWidth: number;
  viewportHeight: number;
  /** 弹层宽度，缺省为查词弹窗宽度 */
  width?: number;
  /** 下方空间至少多少才优先放在下方，缺省按查词弹窗（内容较高）取值 */
  preferredMinHeight?: number;
  /** 窄屏是否改为底部抽屉；小浮层（如划线菜单）传 false，只做边缘限制 */
  allowSheet?: boolean;
}

export function computePopupPlacement(input: PlacementInput): PopupPlacement {
  const { x, y, viewportWidth, viewportHeight } = input;

  if (viewportWidth < SHEET_BREAKPOINT && input.allowSheet !== false) {
    return { mode: "sheet" };
  }

  const width = Math.min(input.width ?? POPUP_WIDTH, viewportWidth - POPUP_MARGIN * 2);
  const left = Math.min(Math.max(x - width / 2, POPUP_MARGIN), viewportWidth - width - POPUP_MARGIN);

  const anchorTop = input.anchorTop ?? y - 40;
  const spaceBelow = viewportHeight - y - POPUP_MARGIN;
  const spaceAbove = anchorTop - POPUP_MARGIN;

  const minHeight = input.preferredMinHeight ?? PREFERRED_MIN_HEIGHT;
  if (spaceBelow >= minHeight || spaceBelow >= spaceAbove) {
    return { mode: "below", left, top: y, maxHeight: Math.max(spaceBelow, 160), width };
  }
  return { mode: "above", left, bottom: viewportHeight - anchorTop, maxHeight: Math.max(spaceAbove, 160), width };
}
