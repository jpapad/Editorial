/** localStorage key for the chosen theme ("light" | "dark"). Absent = follow the OS. */
export const THEME_STORAGE_KEY = "pagewright-theme";

/** Runs inline in <head> before first paint (see app/layout.tsx). Plain ES5, no imports. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
