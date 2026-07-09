# Tile Packages

This directory stores large map tile packages as Git LFS artifacts.

## changshu-full-city-all-zooms-handdrawn.zip

This package contains the full-city handdrawn tile overlay used by the Changshu map demo.

Extract it into:

```text
public/map-tiles/
```

After extraction, this file should exist:

```text
public/map-tiles/changshu-full-city-all-zooms/handdrawn/18/218897/106686.png
```

The frontend tile layer reads files from:

```text
/map-tiles/changshu-full-city-all-zooms/handdrawn/{z}/{x}/{y}.png
```
