# Breakpoint After Hours

An unofficial Breakpoint parody with a score calculator and three arcade games. [Play at breakpoint.beer](https://breakpoint.beer/).

The website lives in `dist/`. To preview it locally, run `python3 -m http.server --directory dist` and open [localhost:8000](http://localhost:8000/). The Vercel function in `api/` serves social preview metadata for challenge links in production.

The [local MCP server](mcp/README.md) lets an agent calculate receipts using the same scoring code as the website.

## Reuse

Original source code and documentation are available under the [MIT License](LICENSE). Third-party components keep their own licenses, including [Archivo Black](dist/assets/ArchivoBlack-OFL.txt), [DM Sans](dist/assets/DMSans-OFL.txt), and [Three.js](dist/break-pint/vendor/LICENSE). MoustacheDAO branding and third-party artwork are excluded from the MIT grant.
