const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";
const DARK_MODE_SCRIPT =
  `(()=>{try{const m=window.matchMedia("${DARK_MODE_QUERY}");` +
  `document.documentElement.classList.toggle("dark",m.matches);` +
  `document.documentElement.style.colorScheme=m.matches?"dark":"light"}catch{}})()`;

export function DarkModeScript() {
  return <script dangerouslySetInnerHTML={{ __html: DARK_MODE_SCRIPT }} />;
}
