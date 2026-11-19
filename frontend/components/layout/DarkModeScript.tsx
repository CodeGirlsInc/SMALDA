import { headers } from "next/headers";

const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";
const DARK_MODE_SCRIPT =
  `(()=>{try{const m=window.matchMedia("${DARK_MODE_QUERY}");` +
  `document.documentElement.classList.toggle("dark",m.matches);` +
  `document.documentElement.style.colorScheme=m.matches?"dark":"light"}catch{}})()`;

export async function DarkModeScript() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script nonce={nonce} dangerouslySetInnerHTML={{ __html: DARK_MODE_SCRIPT }} />
  );
}
