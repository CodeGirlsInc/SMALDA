/**
 * Accessible upload drop zone (#1513, #1512).
 *
 * The drop zone was not keyboard accessible and its title label was not
 * associated with its input. This wires the label to the input via
 * `htmlFor`/`id` and supports keyboard activation, using a neutral title
 * placeholder rather than the finance example (#1512).
 */
import * as React from "react";

export interface DropZoneProps {
  id?: string;
  label?: string;
  accept?: string;
  onFile: (file: File) => void;
}

export function DropZone({
  id = "upload-file",
  label = "Choose a document to upload",
  accept,
  onFile,
}: DropZoneProps): React.ReactElement {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const labelId = `${id}-label`;

  return (
    <div>
      <label htmlFor={id} id={labelId}>
        {label}
      </label>
      <div
        role="button"
        tabIndex={0}
        aria-labelledby={labelId}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) {
            onFile(file);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
      >
        Drag and drop, or press Enter to browse
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFile(file);
          }
        }}
      />
    </div>
  );
}

export default DropZone;
