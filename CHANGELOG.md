# 1.0.3 (2026-01-06)

### Features

- **i18n** Use `English` for default settings.

# 1.0.2 (2026-01-06)

### Features

- **Accessibility** Update accessibility.

- **Libs** Updated nodeCloner to support: roles, ariaLive, ariaLabelledby, ariaControls, ariaHaspopup, ariaMultiselectable, ariaAutocomplete

- **view** The internal directory `view/` has been renamed to `views/` for easier understanding

- **guard** Place the guard command file in the `utils/` directory

### Fixes

- **ResizeObserverService** Memory leak with observers when the popup is opened and closed repeatedly

- **SelectBox** Exception error in some use cases with find() (detected by unit tests)

# 1.0.1 (2026-01-02)

### Optimizations

- **All** Streamline and optimize the source code

- **Libs** Remove the internal event mounter

- **Libs** Use normalize for the function to remove the sign

- **SelectBox** Streamline the processing of Properties: disabled, readonly, visible

- **All** Remove unused code

- **Libs** Modernizing the IsIOS check function

### Fixes

- **SelectBox** The selector disappears after setting the Properties: disabled, readonly, visible

# 1.0.0 (2025-12-31)

### Features

- **public-dist** Broti compression support

- **public-dist** Add .map scripts for debugging

- **public-dist** Add minify script for esm

- **All** Clarify the source code through internal comments

- **SearchController** Group support via AJAX

### Fixes

- **SearchBox** Sometimes the search function doesn't work when you press enter

- **SearchBox,SearchController,Libs** Inconsistent internal APIs make it difficult to maintain compatibility in the long term

- **SelectObserver,SelectBox** An unexpected error occurred when an option was dynamically loaded with a bound Select tag