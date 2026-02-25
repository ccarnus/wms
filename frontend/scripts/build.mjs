import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import path from "node:path";
import { promises as fs } from "node:fs";

const projectRoot = process.cwd();
const buildDir = path.join(projectRoot, "build");
const assetsDir = path.join(buildDir, "assets");

const apiBaseUrl = (process.env.APP_API_URL || process.env.API_URL || "").replace(
  /\/+$/,
  ""
);

const buildHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WMS Console</title>
    <link rel="stylesheet" href="/assets/styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>
`;

const buildCss = async () => {
  const cssInputPath = path.join(projectRoot, "src", "index.css");
  const cssOutputPath = path.join(assetsDir, "styles.css");
  const cssInput = await fs.readFile(cssInputPath, "utf8");

  const cssResult = await postcss([tailwindcss(), autoprefixer()]).process(cssInput, {
    from: cssInputPath,
    to: cssOutputPath
  });

  await fs.writeFile(cssOutputPath, cssResult.css, "utf8");
};

const buildJs = async () => {
  await build({
    entryPoints: [path.join(projectRoot, "src", "main.jsx")],
    bundle: true,
    outfile: path.join(assetsDir, "app.js"),
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "react",
    target: ["es2020"],
    minify: true,
    sourcemap: false,
    define: {
      __API_BASE_URL__: JSON.stringify(apiBaseUrl)
    }
  });
};

const run = async () => {
  await fs.rm(buildDir, { recursive: true, force: true });
  await fs.mkdir(assetsDir, { recursive: true });

  await Promise.all([buildCss(), buildJs()]);
  await fs.writeFile(path.join(buildDir, "index.html"), buildHtml, "utf8");
};

run().catch((error) => {
  console.error("Frontend build failed:", error);
  process.exit(1);
});
