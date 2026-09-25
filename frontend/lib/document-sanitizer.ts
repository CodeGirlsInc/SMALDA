"use client";

import DOMPurify from "dompurify";

/**
 * Browser-only SVG sanitization for untrusted upload markup. This module owns
 * active-content removal; scalar values and API response mapping live in
 * separate modules.
 */

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";

const FORBIDDEN_SVG_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "style",
  "animate",
  "animatemotion",
  "animatetransform",
  "set",
  "discard",
  "audio",
  "video",
  "handler",
  "listener",
  "link",
  "meta",
  "image",
  "feimage",
  "font-face-uri",
  "use",
  "a",
]);

const ALLOWED_SVG_ELEMENTS = new Set([
  "svg",
  "g",
  "defs",
  "title",
  "desc",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "textpath",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "pattern",
  "marker",
  "symbol",
  "view",
  "mask",
  "filter",
  "fegaussianblur",
  "feoffset",
  "feblend",
  "fecolormatrix",
  "fecomponenttransfer",
  "fecomposite",
  "fediffuselighting",
  "feconvolvematrix",
  "fedisplacementmap",
  "fedropshadow",
  "feflood",
  "fefunca",
  "fefuncb",
  "fefuncg",
  "fefuncr",
  "femerge",
  "femergenode",
  "femorphology",
  "fepointlight",
  "fespecularlighting",
  "fespotlight",
  "fetile",
  "feturbulence",
  "switch",
  "font",
  "font-face",
  "font-face-format",
  "font-face-name",
  "glyph",
  "missing-glyph",
  "hkern",
  "vkern",
  "tref",
  "cursor",
]);

const URL_ATTRIBUTES = new Set([
  "href",
  "src",
  "srcset",
  "action",
  "formaction",
  "poster",
  "background",
  "codebase",
  "cite",
  "icon",
  "manifest",
  "profile",
  "usemap",
  "ping",
  "longdesc",
]);

const CSS_URL_ATTRIBUTES = new Set([
  "background-image",
  "clip-path",
  "color-profile",
  "cursor",
  "fill",
  "filter",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "stroke",
]);

function parseSvg(markup: string): SVGSVGElement {
  const document = new window.DOMParser().parseFromString(
    markup,
    "image/svg+xml",
  );
  const root = document.documentElement;

  if (
    document.querySelector("parsererror") ||
    root.localName.toLowerCase() !== "svg" ||
    root.namespaceURI !== SVG_NAMESPACE
  ) {
    throw new Error("Invalid SVG document");
  }

  return root as SVGSVGElement;
}

function isLocalReference(value: string): boolean {
  return /^#[A-Za-z0-9_.:-]+$/.test(value);
}

function isLocalCssReference(value: string): boolean {
  return /^url\(\s*#[A-Za-z0-9_.:-]+\s*\)$/i.test(value.trim());
}

/** Sanitizes untrusted SVG markup and throws when no DOM sanitizer is available. */
export function sanitizeSvg(markup: string): string {
  if (
    typeof window === "undefined" ||
    !DOMPurify.isSupported ||
    typeof window.DOMParser === "undefined" ||
    typeof window.XMLSerializer === "undefined"
  ) {
    throw new Error("SVG sanitization is unavailable");
  }

  if (
    /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(markup) ||
    /<\?(?!xml(?:\s|\?))/i.test(markup)
  ) {
    throw new Error("Unsafe SVG declaration");
  }

  const purified = String(
    DOMPurify.sanitize(markup, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: Array.from(FORBIDDEN_SVG_ELEMENTS),
      FORBID_ATTR: ["style"],
      ALLOW_ARIA_ATTR: true,
      ALLOW_UNKNOWN_PROTOCOLS: false,
    }),
  );
  const root = parseSvg(purified);

  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (
      element.namespaceURI !== SVG_NAMESPACE ||
      FORBIDDEN_SVG_ELEMENTS.has(element.localName.toLowerCase()) ||
      !ALLOWED_SVG_ELEMENTS.has(element.localName.toLowerCase())
    ) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const localName = attribute.localName.toLowerCase();
      const value = attribute.value;

      if (name === "xmlns" || name.startsWith("xmlns:")) {
        const isKnownNamespace =
          value === SVG_NAMESPACE || value === XLINK_NAMESPACE;
        if (!isKnownNamespace) element.removeAttributeNode(attribute);
        continue;
      }

      if (
        name.startsWith("on") ||
        name === "style" ||
        name === "xml:base" ||
        (attribute.namespaceURI === XLINK_NAMESPACE && localName !== "href") ||
        (attribute.namespaceURI === XML_NAMESPACE &&
          localName !== "space" &&
          localName !== "lang") ||
        (attribute.namespaceURI !== null &&
          attribute.namespaceURI !== XLINK_NAMESPACE &&
          attribute.namespaceURI !== XML_NAMESPACE)
      ) {
        element.removeAttributeNode(attribute);
        continue;
      }

      if (URL_ATTRIBUTES.has(localName) && !isLocalReference(value)) {
        element.removeAttributeNode(attribute);
        continue;
      }

      if (CSS_URL_ATTRIBUTES.has(localName)) {
        const normalizedCssValue = value.replace(/\/\*[\s\S]*?\*\//g, "");
        if (
          (normalizedCssValue.includes("\\") ||
            /\b(?:url|var|attr)\s*\(/i.test(normalizedCssValue)) &&
          !isLocalCssReference(normalizedCssValue)
        ) {
          element.removeAttributeNode(attribute);
        }
      }
    }
  }

  return new window.XMLSerializer().serializeToString(root);
}
