# Replacing and relinking the HEIC decoder

Local Community Platform uses `heic-to` 1.5.2 for browser-side HEIC and HEIF decoding. `heic-to` bundles libheif 1.22.2. Both are distributed under the GNU Lesser General Public License v3.0 or later.

## Corresponding source

- `heic-to` 1.5.2: https://github.com/hoppergee/heic-to/tree/v1.5.2
- libheif 1.22.2: https://github.com/strukturag/libheif/tree/v1.22.2
- `heic-to` build notes for its libheif browser build: https://github.com/hoppergee/heic-to/blob/v1.5.2/README.md#how-to-build-libheifjs-from-libheif-on-mac

The exact application dependency is recorded in `package.json` and `bun.lock`. The application imports `heic-to/csp` from `src/lib/avatar.ts` without modifying the library.

## Replace the library and rebuild

Recipients may replace the LGPL-covered decoder with a modified compatible build:

1. Clone or download this repository's complete source.
2. Obtain or build the desired compatible `heic-to`/libheif implementation from the source links above.
3. Point the `heic-to` dependency in `package.json` to the replacement package, local directory, or tarball.
4. Run `bun install` to regenerate `bun.lock`.
5. Run `bun run verify` to test and rebuild the application.
6. Deploy the generated Vercel output or run the application using the documented deployment workflow.

The repository does not use signing, DRM, or installation restrictions that prevent a recipient from running a rebuilt version. If the replacement exposes a different JavaScript API, adapt the dynamic import in `src/lib/avatar.ts` and retain the pre-decode size controls.

## Included license materials

Deployments copy these files to public URLs:

- `/licenses/LGPL-3.0.txt`
- `/licenses/GPL-3.0.txt`

The same files are included in repository source archives and GitHub release source archives.
