import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  plugins: [{
    name: "springboard-interaction-test-hooks",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith("/src/device/SpringBoard.tsx")) return;
      return code.replace(
        'import { CSSProperties, Dispatch, PointerEvent as ReactPointerEvent, useRef, useState } from "react";',
        'import type { CSSProperties, Dispatch, PointerEvent as ReactPointerEvent } from "react"; const useRef=(value)=>({current:value}); const useState=(value)=>[value,()=>{}];',
      );
    },
  }],
});

try {
  const { SpringBoard } = await server.ssrLoadModule("/src/device/SpringBoard.tsx");
  const walk = value => {
    const nodes = [];
    const visit = node => {
      if (!node || typeof node !== "object") return;
      if ("type" in node && "props" in node) {
        nodes.push(node);
        if (typeof node.type === "function") visit(node.type(node.props));
        visit(node.props?.children);
        return;
      }
      if (Array.isArray(node)) node.forEach(visit);
    };
    visit(value);
    return nodes;
  };
  const render = (folderState = "closed") => {
    const launches = [];
    const pages = [];
    const tree = SpringBoard({
      currentPage: 0,
      onPageChange: page => pages.push(page),
      folderState,
      dispatchFolderEvent() {},
      activeFolderSlotIndex: 6,
      onActiveFolderSlotChange() {},
      onLaunchApp: app => launches.push(app),
      messagesBadgeCount: 0,
      notificationBadgeCounts: {},
    });
    const nodes = walk(tree);
    return {
      launches,
      pages,
      pageSurface: nodes.find(node => node.props?.className === "springboard-pages"),
      calendar: nodes.find(node => node.props?.["data-app-name"] === "Calendar"),
    };
  };
  const pointerTarget = () => {
    let captured = false;
    return {
      setPointerCapture() { captured = true; },
      hasPointerCapture() { return captured; },
      releasePointerCapture() { captured = false; },
    };
  };
  const pointer = (currentTarget, x) => ({
    isPrimary: true,
    button: 0,
    pointerId: 7,
    clientX: x,
    clientY: 100,
    currentTarget,
    preventDefault() {},
  });

  {
    const view = render();
    assert.equal(view.calendar.props.onPointerDown, undefined, "icons must not stop pointerdown propagation");
    const target = pointerTarget();
    view.pageSurface.props.onPointerDown(pointer(target, 200));
    view.pageSurface.props.onPointerMove(pointer(target, 165));
    view.pageSurface.props.onPointerUp(pointer(target, 165));
    view.calendar.props.onClick({ detail: 1 });
    assert.deepEqual(view.launches, ["calendar"], "sub-threshold movement remains an immediate icon activation");
    assert.deepEqual(view.pages, []);
  }

  {
    const view = render();
    const target = pointerTarget();
    view.pageSurface.props.onPointerDown(pointer(target, 200));
    view.pageSurface.props.onPointerMove(pointer(target, 135));
    view.pageSurface.props.onPointerUp(pointer(target, 135));
    view.calendar.props.onClick({ detail: 1 });
    assert.deepEqual(view.pages, [1], "an icon-origin drag crossing 48px pages forward");
    assert.deepEqual(view.launches, [], "the dragged icon must not launch");
  }

  {
    const view = render("open");
    const target = pointerTarget();
    view.pageSurface.props.onPointerDown(pointer(target, 200));
    view.pageSurface.props.onPointerMove(pointer(target, 120));
    view.pageSurface.props.onPointerUp(pointer(target, 120));
    assert.deepEqual(view.pages, [], "an open folder continues to gate SpringBoard paging");
  }

  console.log("PASS: SpringBoard icon-origin tap, drag, launch suppression, threshold, and folder paging gate.");
} finally {
  await server.close();
}
