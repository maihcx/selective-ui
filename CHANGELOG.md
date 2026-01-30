# 1.2.5 (2026-01-30)

### Fixes

- **SelectObserver,ModelManager** Remove the anti-duplicate loading mechanism (Snapshot) as it is no longer suitable and will cause unexpected errors

### Optimizations

- **ALL** Optimizations code and improve JSDoc

# 1.2.4 (2026-01-27)

### Fixes

- **ALL** Memory and events are not properly cleaned up due to a lack of clear lifecycle management

### Optimizations

- **Lifecycle** Add a Lifecycle class to tighten the rules for starting and ending the process

- **ALL** Improvements to the Lifecycle-based architectural model

- **ALL** Rewrite the JSDoc to fit the current model

- **CSS** Rearrange the organization of CSS files

# 1.2.3 (2026-01-26)

### Fixes

- **SelectBox,VirtualRecyclerView,MixedAdapter** The popup size is incorrect in some cases when working with Ajax

- **SelectBox** Custom events are being triggered excessively

### Optimizations

- **SelectBox,Popup** Optimize responsiveness when selecting items in pop-ups

- **SelectBox,VirtualRecyclerView** Improve the stability of VirtualScroll

# 1.2.2 (2026-01-23)

### Fixes

- **SelectBox** Events were not properly cleaned up during the search process

- **Effector** Popups are slow to respond when scrolling

### Features

- **Builder,iStorage,AccessoryBox** Introduced the `accessoryVisible` flag to decide whether to display the selected item

### Optimizations

- **SelectBox,MixedAdapter** Optimize performance by selecting options when the file is too long

- **SelectBox,MixedAdapter** Increase the overall response speed of popups

# 1.2.1 (2026-01-22)

### Optimizations

- **SelectBox** Improved search speed, now with near-instantaneous response times

- **Effector** Improve the stability of the effects

# 1.2.0 (2026-01-21)

### Fixes

- **SelectBox** Unable to press the spacebar in the search box

### Features

- **VirtualRecyclerView** Implement the VirtualScroll feature

### Optimizations

- **VirtualRecyclerView** VirtualScroll significantly improves search and data display performance

- **VirtualRecyclerView,SelectBox** Supports displaying 10,000+ lines of data with consistent performance

- **ALL** Improve JSDoc

# 1.1.6 (2026-01-16)

### Fixes

- **Popup** The popup position is incorrect on iOS when the keyboard is turned on

- **Popup** The "select all" control bar pops up and closes illogically

- **Popup,SelectBox** The popup position is sometimes inconsistent

# 1.1.5 (2026-01-15)

### Fixes

- **Popup** The "No data available" message appears at the same time as "Processing..."

- **builder** The output data is sometimes unstable

- **SelectBox,Selective** The instance returns of the subfunctions are inconsistent with `.find()`

- **option.css** The checkboxes do not hide when in `imageMode`

### Features

- **Selective,SelectBox** Improve the sub-functions of the instance API

- **SelectBox** Introducing new APIs: targetElement, getParent(), valueDataset(), loadAjax()

- **SearchController** Upgrade Ajax configuration data

# 1.1.4 (2026-01-14)

### Fixes

- **builder** The loadMore function is not working

# 1.1.3 (2026-01-14)

### Fixes

- **index,guard** Files that are not minified will not work

# 1.1.2 (2026-01-14)

### Optimizations

- **ALL** Remove unused code

- **ALL** Optimize the library overall, reducing its size

- **index,guard** Overall startup performance optimization

- **builder** Update dependent libraries to optimize the build process

# 1.1.1 (2026-01-13)

### Fixes

- **Popup,SelectBox** Popup object classes are not being cleaned up properly

- **Selective** Items do not retrieve new data from `option` tags

- **ALL** Some errors occurred during the `JS` -> `TS` conversion process

# 1.1.0 (2026-01-12)

### Features

- **ALL** Convert library logic from `JavaScript` to `TypeScript`

# 1.0.5 (2026-01-09)

### Optimizations

- **MixedAdapter** Avoid reloading images in option tags

- **SelectObserver** Reduce overreaction to data in select tags if they are changed

- **SelectObserver,OptionView** Optimize the processing speed of dynamic load options tags

### Fixes

- **Refresher** The select box sometimes displays at minimum size

# 1.0.4 (2026-01-07)

### Features

- **SearchController,SelectBox** Add a loadByValues mechanism to the `setValue` and `value` instances if the value does not exist (for use with Ajax)

### Fixes

- **SelectBox** The `aria-*` errors cause the `Lighthouse` score to drop

- **rollup** The map versions are not loading correctly in the current version

# 1.0.3 (2026-01-06)

### Features

- **i18n** Use `English` for default settings

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