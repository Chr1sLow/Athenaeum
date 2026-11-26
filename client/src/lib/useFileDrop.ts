import { type DragEvent, useRef, useState } from 'react';

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/**
 * Lets an element accept files dropped from the desktop. Spread `dropHandlers` on it, and show a
 * hint while `dragging` is true. Drags of anything other than files are ignored.
 */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0); // dragenter/dragleave fire for every child element

  const dropHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setDragging(true);
    },
    onDragOver: (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      onFiles(Array.from(e.dataTransfer.files));
    },
  };

  return { dragging, dropHandlers };
}
