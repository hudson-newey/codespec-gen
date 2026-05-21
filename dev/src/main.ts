const root = document.querySelector<HTMLDivElement>("#app");

if (root) {
  root.innerHTML = `
    <section style="font-family: sans-serif; max-width: 720px; margin: 40px auto; line-height: 1.4;">
      <h1>CodeSpec Dev Website</h1>
      <p>Banner from plugin: <strong>__CODESPEC_BANNER__</strong></p>
      <p>This site is scaffolded with Nx + Vite and wired to the local plugin package.</p>
    </section>
  `;
}
