# IndusCode web visual foundation

The shared visual contract now lives in the internal
[`@induscode/ui`](../../../../../sdk/packages/ui/README.md) workspace package
instead of beside the desktop app.

The desktop imports the complete `@induscode/ui/theme/index.css` entry point. Other
IndusCode surfaces can import `@induscode/ui/theme/tokens.css` without React or
Tailwind, or compose the Tailwind adapter and optional base styles in order.
Consuming apps still own their font files and shell-specific layout.
