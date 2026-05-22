import printHello$ from "./printHello.codespec.md";

const root = document.querySelector<HTMLDivElement>("#app");

if (root) {
  printHello$();

  root.innerHTML = `
    <section style="font-family: sans-serif; max-width: 720px; margin: 40px auto; line-height: 1.4;">
      <h1>CodeSpec Dev Website</h1>
      <p>
        The <code>codespec-gen/vite-plugin</code> alias is active. Add
        <code>code$</code>, <code>guard$</code>, <code>context$</code>, or
        <code>docs$</code> calls (imported from <code>codespec-gen</code>) to
        any TypeScript file — the plugin will replace them with LLM-generated
        code at build time.
      </p>
      <p>
        Generated artifacts are persisted under
        <code>codespec_gen/</code> and reused on subsequent builds (cache hits
        skip generation entirely).
      </p>
    </section>
  `;
}
