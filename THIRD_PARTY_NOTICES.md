# Third-party notices

## heic-to and bundled libheif

Local Community Platform uses [`heic-to`](https://github.com/hoppergee/heic-to) 1.5.2 to decode HEIC and HEIF profile photos in browsers that cannot read those formats natively. That package bundles libheif 1.22.2, including a libde265 1.0.16 build, in its browser implementation.

- `heic-to` copyright: Hopper Gee and contributors
- `heic-to` license: GNU Lesser General Public License v3.0 or later
- `heic-to` corresponding source: https://github.com/hoppergee/heic-to/tree/v1.5.2
- bundled libheif version: 1.22.2
- libheif corresponding source: https://github.com/strukturag/libheif/tree/v1.22.2
- bundled libde265 version: 1.0.16
- libde265 copyright: struktur AG and contributors
- libde265 license: GNU Lesser General Public License v3.0 or later
- libde265 corresponding source: https://github.com/strukturag/libde265/tree/v1.0.16
- LGPLv3 text: [`public/licenses/LGPL-3.0.txt`](public/licenses/LGPL-3.0.txt)
- GPLv3 text referenced by the LGPL: [`public/licenses/GPL-3.0.txt`](public/licenses/GPL-3.0.txt)
- rebuild and relinking instructions: [`docs/third-party-relinking.md`](docs/third-party-relinking.md)

The application imports `heic-to` without local modifications and places it in a lazily loaded browser chunk. The tracked dependency version, complete application source, license texts, corresponding-source locations for `heic-to`, libheif, and libde265, and rebuild instructions are supplied so recipients can replace the libraries and rebuild the combined work.
