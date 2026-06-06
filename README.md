# V8 Monolithic Library Builds

This repository contains automated builds of Google V8 static libraries for multiple platforms using GitHub Actions.

English | [简体中文](README.ZH.md)

## Current V8 Versions

This workflow builds three V8 major versions in parallel:

- **V8 10** (`refs/branch-heads/10.9`)
- **V8 11** (`refs/branch-heads/11.9`)
- **V8 13** (`refs/branch-heads/13.9`)

## Supported Platforms

- **Android** (arm64, arm, x64)
- **iOS** (XCFramework: arm64 device, arm64 simulator)
- **macOS** (XCFramework: arm64 Apple Silicon)

## Latest Release

Check the [Releases](../../releases) page for the latest precompiled binaries.

## Package Contents

Each release includes zip packages with:
- **Static library file** (libv8_monolith.a / v8_monolith.lib)
- **args.gn** - Build configuration used for compilation
- **args.full.txt** - Complete GN arguments list with all default values and descriptions

## Build Artifacts

| Platform | Artifact File | Architectures | Description |
|----------|--------------|---------------|-------------|
| Android  | `libv8_monolith-v8-{major}-android-arm64.zip` | arm64 | Static library + args.gn + args.full.txt |
| Android  | `libv8_monolith-v8-{major}-android-arm.zip` | arm | Static library + args.gn + args.full.txt |
| Android  | `libv8_monolith-v8-{major}-android-x64.zip` | x64 | Static library + args.gn + args.full.txt |
| Android  | `include-v8-{major}-android.zip` | - | V8 header files |
| iOS      | `libv8_monolith-v8-{major}-ios.zip` | arm64 (device + simulator) | XCFramework with headers + args.gn + args.full.txt |
| macOS    | `libv8_monolith-v8-{major}-mac.zip` | arm64 (Apple Silicon) | XCFramework with headers + args.gn + args.full.txt |

## Build Configuration Files

The repository contains GN build configuration files for each platform:

### Android
- [args.android.arm64.gn](args.android.arm64.gn)
- [args.android.arm.gn](args.android.arm.gn)
- [args.android.x64.gn](args.android.x64.gn)

### iOS
- [args.ios.arm64.gn](args.ios.arm64.gn) - Device configuration
- [args.ios.arm64.simulator.gn](args.ios.arm64.simulator.gn) - Simulator configuration

**Note**: The iOS build produces an XCFramework that supports both arm64 device and arm64 simulator platforms.

**iOS XCFramework Structure**:
```
libv8_monolith.xcframework/
├── ios-arm64/                          # Device
│   └── libv8_monolith.framework/
│       ├── Headers/                    # V8 header files
│       ├── libv8_monolith              # Static library
│       └── Info.plist
└── ios-arm64-simulator/                # Simulator
    └── libv8_monolith.framework/
        ├── Headers/                    # V8 header files
        ├── libv8_monolith              # Static library
        └── Info.plist
```

**Usage in Xcode**:
1. Drag `libv8_monolith.xcframework` into your Xcode project
2. Add to "Frameworks, Libraries, and Embedded Content"
3. Import headers: `#include <libv8_monolith/v8.h>`
4. Xcode automatically selects the correct variant (device/simulator)

### macOS
- [args.mac.arm64.gn](args.mac.arm64.gn)

**Note**: The macOS build produces an XCFramework for arm64 (Apple Silicon).

**macOS XCFramework Structure**:
```
libv8_monolith.xcframework/
└── macos-arm64/                        # Apple Silicon
    └── libv8_monolith.framework/
        ├── Headers/                    # V8 header files
        ├── libv8_monolith              # Static library
        └── Info.plist
```

**Usage in Xcode**: Same as iOS, drag and drop into your project

### XCFramework Configuration
- [Info.plist.template](Info.plist.template) - Template for XCFramework Info.plist (version is replaced during build)

## Features

- ✅ Automated builds via GitHub Actions
- ✅ Consistent configuration across platforms
- ✅ Pre-build scripts for platform-specific optimizations ([builder.js](builder.js))
- ✅ Full build argument traceability
- ✅ iOS WebAssembly support enabled

## Usage

1. Download the appropriate zip file for your platform from the [Releases](../../releases) page
2. Extract the static library file
3. Link against the library in your project
4. Include the V8 headers (included in the release)
5. Refer to `args.gn` and `args.full.txt` to understand the build configuration

## Build System

All builds are automated using [GitHub Actions](.github/workflows/main.yml):
- Clean build environment for each platform
- Parallel V8 10, 11, and 13 build matrix
- Consistent depot_tools version
- Reproducible builds
- Automated release creation

## V8 Documentation

### Official V8 Resources
- [V8 Build Instructions](https://v8.dev/docs/build)
- [V8 Build with GN](https://v8.dev/docs/build-gn)
- [V8 ARM64 Build](https://v8.dev/docs/compile-arm64)

### Chromium Build Instructions
- [Windows Build Instructions](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/windows_build_instructions.md)
- [Android Build Instructions](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/android_build_instructions.md)
- [iOS Build Instructions](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/ios/build_instructions.md)
- [macOS Build Instructions](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/mac_build_instructions.md)
- [macOS ARM64 Build](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/mac_arm64.md)

### Additional Resources
- [V8 Release Schedule](https://chromiumdash.appspot.com/schedule)
- [GitHub Actions Runner Images](https://github.com/actions/runner-images)

## Contributing

To update the V8 version or modify build configurations:

1. Update the `matrix.v8` entries in [.github/workflows/main.yml](.github/workflows/main.yml)
2. Modify platform-specific `args.*.gn` files as needed
3. Update [builder.js](builder.js) for platform-specific build logic
4. Create a new git tag to trigger the build workflow

## Acknowledgments

This project is inspired by and references the work from [just-js/v8](https://github.com/just-js/v8).

## License

This repository contains build configurations and automation scripts. V8 itself is licensed under the BSD license. See the [V8 repository](https://github.com/v8/v8) for details.
