
/**
/**
 * 用途：构建脚本相关的工具函数及流程控制
 */

const fs = require("fs");
const path = require("path");

const trace = function (...args) {
    console.log("builder: ", ...args);
}


/**
 * 解析args.gn文件，返回一个对象
 * @param {*} argsPath args.gn文件路径
 * @returns 对象
 */
let parseGNArgs = function (argsPath, isToArray = false) {
    const content = fs.readFileSync(argsPath, "utf8");
    const lines = content.split("\n");
    let result = isToArray ? [] : {};
    const args = {};
    for (let line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
            continue;
        }
        if (trimmedLine.includes("=")) {
            const [key, value] = trimmedLine.split("=");
            args[key] = value.trim();
        }
    }
    return args;
}
const v8Version = process.env.V8_VERSION;
const v8Major = process.env.V8_MAJOR;
const platform = process.env.PLATFORM; // arm64|arm|x64
const jobName = process.env.JOB_NAME;  // android|ios|mac|win
const workspace = process.env.WORKSPACE;
const NDK_ROOT = process.env.NDK_ROOT;

trace("v8Version=" + v8Version);
trace("v8Major=" + v8Major);
trace("platform=" + platform);
trace("jobName=" + jobName);
trace("NDK_ROOT=" + NDK_ROOT);
trace("workspace=" + workspace);

const v8SourcePath = path.join(workspace, "v8");

const getArgsPath = function () {
    const buildType = process.env.BUILD_TYPE;
    if (jobName === "win" && buildType) {
        return path.join(workspace, `args.${jobName}.${platform}.${buildType}.gn`);
    }
    return path.join(workspace, `args.${jobName}.${platform}.gn`);
};

const unsupportedGNArgsByMajor = {
    "10": new Set([
        "enable_rust",
        "use_ml_inliner",
        "v8_enable_builtins_optimization",
        "v8_enable_drumbrake",
        "v8_enable_fuzztest",
        "v8_enable_temporal_support",
    ]),
    "11": new Set([
        "enable_rust",
        "use_ml_inliner",
        "v8_enable_drumbrake",
        "v8_enable_fuzztest",
        "v8_enable_temporal_support",
    ]),
};

const sanitizeGNArgs = function (argsPath) {
    if (!fs.existsSync(argsPath)) {
        trace("args file does not exist, skip sanitize: " + argsPath);
        return;
    }

    const unsupported = unsupportedGNArgsByMajor[v8Major] || new Set();
    let changed = false;
    let removed = [];
    let content = fs.readFileSync(argsPath, "utf8");
    let lines = content.split("\n").filter((line) => {
        const match = line.trim().match(/^([A-Za-z0-9_]+)\s*=/);
        if (!match || !unsupported.has(match[1])) {
            return true;
        }
        changed = true;
        removed.push(match[1]);
        return false;
    });

    const setGNArg = function (key, value) {
        const replacement = `${key}=${value}`;
        let found = false;
        lines = lines.map((line) => {
            const match = line.trim().match(/^([A-Za-z0-9_]+)\s*=/);
            if (!match || match[1] !== key) {
                return line;
            }
            found = true;
            if (line.trim() !== replacement) {
                changed = true;
                trace("Set GN arg for " + jobName + " V8 " + v8Major + ": " + replacement);
                return replacement;
            }
            return line;
        });
        if (!found) {
            changed = true;
            trace("Add GN arg for " + jobName + " V8 " + v8Major + ": " + replacement);
            lines.push(replacement);
        }
    };

    if (jobName === "ios") {
        setGNArg("use_sysroot", "true");
        setGNArg("use_xcode_clang", "true");
        setGNArg("v8_enable_webassembly", "false");
        if (v8Major === "13") {
            setGNArg("v8_enable_drumbrake", "false");
        }
    }

    if (jobName === "mac") {
        setGNArg("use_xcode_clang", "true");
    }

    if (changed) {
        fs.writeFileSync(argsPath, lines.join("\n"));
        if (removed.length > 0) {
            trace("Removed unsupported GN args for V8 " + v8Major + ": " + [...new Set(removed)].join(", "));
        }
    }
};

const appendGNArgIfMissing = function (argsPath, line) {
    let content = fs.readFileSync(argsPath, "utf8");
    if (content.split("\n").some((existingLine) => existingLine.trim() === line)) {
        return content;
    }
    if (!content.endsWith("\n")) {
        content += "\n";
    }
    content += line + "\n";
    fs.writeFileSync(argsPath, content);
    return content;
};

const patchIosPthreadJitWriteProtect = function () {
    const buildConfigPath = path.join(v8SourcePath, "src", "base", "build_config.h");
    if (!fs.existsSync(buildConfigPath)) {
        trace("build_config.h does not exist, skip iOS pthread JIT patch");
        return;
    }

    let content = fs.readFileSync(buildConfigPath, "utf8");
    let changed = false;
    const oldCondition = "    (defined(V8_OS_MACOS) || (defined(V8_OS_IOS) && TARGET_OS_SIMULATOR))";
    if (content.includes(oldCondition)) {
        content = content.replace(oldCondition, "    defined(V8_OS_MACOS)");
        changed = true;
        trace("Patched V8_HAS_PTHREAD_JIT_WRITE_PROTECT to exclude iOS condition");
    }

    const iosTargetOverride = [
        "",
        "#if defined(V8_TARGET_OS_IOS)",
        "#undef V8_HAS_PTHREAD_JIT_WRITE_PROTECT",
        "#define V8_HAS_PTHREAD_JIT_WRITE_PROTECT 0",
        "#endif",
        "",
    ].join("\n");
    if (!content.includes("#undef V8_HAS_PTHREAD_JIT_WRITE_PROTECT")) {
        const includeGuardEnd = "#endif  // V8_BASE_BUILD_CONFIG_H_";
        if (content.includes(includeGuardEnd)) {
            content = content.replace(includeGuardEnd, iosTargetOverride + includeGuardEnd);
            changed = true;
            trace("Patched V8_HAS_PTHREAD_JIT_WRITE_PROTECT to disable iOS target");
        } else {
            trace("iOS pthread JIT build_config include guard not found");
        }
    }

    if (changed) {
        fs.writeFileSync(buildConfigPath, content);
    } else {
        trace("iOS pthread JIT build_config patch not needed");
    }
};

const patchIosPthreadJitWriteProtectCallSites = function () {
    const codeMemoryAccessPath = path.join(v8SourcePath, "src", "common", "code-memory-access-inl.h");
    if (!fs.existsSync(codeMemoryAccessPath)) {
        trace("code-memory-access-inl.h does not exist, skip iOS pthread JIT call-site patch");
        return;
    }

    let content = fs.readFileSync(codeMemoryAccessPath, "utf8");
    const oldCondition = "#if V8_HAS_PTHREAD_JIT_WRITE_PROTECT";
    const previousCondition = "#if V8_HAS_PTHREAD_JIT_WRITE_PROTECT && !defined(__IPHONE_OS_VERSION_MIN_REQUIRED)";
    const newCondition = "#if V8_HAS_PTHREAD_JIT_WRITE_PROTECT && !defined(__IPHONE_OS_VERSION_MIN_REQUIRED) && !defined(__ENVIRONMENT_IPHONE_OS_VERSION_MIN_REQUIRED__)";
    if (content.includes(newCondition)) {
        trace("iOS pthread JIT call-site patch already applied");
        return;
    }
    if (content.includes(previousCondition)) {
        content = content.replace(previousCondition, newCondition);
        fs.writeFileSync(codeMemoryAccessPath, content);
        trace("Updated pthread JIT write-protect call sites to exclude iOS simulator target");
        return;
    }
    if (!content.includes(oldCondition)) {
        trace("iOS pthread JIT call-site patch not needed");
        return;
    }

    content = content.replace(oldCondition, newCondition);
    fs.writeFileSync(codeMemoryAccessPath, content);
    trace("Patched pthread JIT write-protect call sites to exclude iOS target");
};

const patchIosEmbeddedBuiltinsInlineAsm = function () {
    const buildGnPath = path.join(v8SourcePath, "BUILD.gn");
    if (!fs.existsSync(buildGnPath)) {
        trace("BUILD.gn does not exist, skip iOS embedded builtins patch");
        return;
    }

    let content = fs.readFileSync(buildGnPath, "utf8");
    const oldLine = "emit_builtins_as_inline_asm = is_win && is_clang";
    const newLine = "emit_builtins_as_inline_asm = true";
    if (content.includes(newLine)) {
        trace("iOS embedded builtins inline asm patch already applied");
        return;
    }
    if (!content.includes(oldLine)) {
        trace("iOS embedded builtins inline asm patch not needed");
        return;
    }

    content = content.replace(oldLine, newLine);
    fs.writeFileSync(buildGnPath, content);
    trace("Patched embedded builtins to use inline asm for iOS V8 10");
};

const patchAndroidSimdutfAtomicBase64 = function () {
    const typedArrayPath = path.join(v8SourcePath, "src", "builtins", "builtins-typed-array.cc");
    if (!fs.existsSync(typedArrayPath)) {
        trace("builtins-typed-array.cc does not exist, skip simdutf atomic base64 patch");
        return;
    }

    let content = fs.readFileSync(typedArrayPath, "utf8");
    let patched = content
        .replaceAll("simdutf::atomic_base64_to_binary_safe", "simdutf::base64_to_binary_safe")
        .replaceAll("simdutf::atomic_binary_to_base64", "simdutf::binary_to_base64");

    if (patched === content) {
        trace("simdutf atomic base64 patch not needed");
        return;
    }

    fs.writeFileSync(typedArrayPath, patched);
    trace("Patched V8 13 Android simdutf base64 calls to avoid SIMDUTF_ATOMIC_REF");
};

/**
 * 在ninja构建前执行，修改v8源码
 */
let onBeforeBuild = function () {
    const argsPath = getArgsPath();
    sanitizeGNArgs(argsPath);

    switch (jobName) {
        case "android": {
            if (v8Major === "13") {
                patchAndroidSimdutfAtomicBase64();
            }
            /**
             * android_ndk_root="${NDK_ROOT}"
clang_base_path="${NDK_ROOT}/toolchains/llvm/prebuilt/linux-x86_64"
             * 
             */
            let newGnContent = appendGNArgIfMissing(argsPath, "use_glib=false");
            trace("**********************************************")
            trace(newGnContent);
            trace("**********************************************")
            break;
        }
        case "ios": {
            patchIosPthreadJitWriteProtectCallSites();
            if (v8Major === "10") {
                patchIosEmbeddedBuiltinsInlineAsm();
            }
            const gnContent = fs.readFileSync(argsPath, "utf8");
            if (gnContent.indexOf(`v8_enable_drumbrake=true`) >= 0) {
                {
                    trace("v8_enable_drumbrake = true");
                    //  BUILD.gn
                    let gnPath = path.join(v8SourcePath, "BUILD.gn");
                    let content = fs.readFileSync(gnPath, "utf8");
                    const lines = content.split("\n");
                    let isModify = false;
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes("is_drumbrake_supported")) {
                            if (lines[i].trim().startsWith("#")) {
                                break;
                            }
                            trace("********************************** Modify BUILD.gn:line-" + (i - 1));
                            lines[i - 1] = `# ${lines[i - 1]}`;
                            lines[i] = `# ${lines[i]}`;
                            lines[i + 1] = `# ${lines[i + 1]}`;
                            isModify = true;
                            break;
                        }
                    }
                    isModify && fs.writeFileSync(gnPath, lines.join("\n"));
                }
            }
            break;
        }

        case "mac":
            {
                // DO NOTHING
                break;
            }
        case "win":
            {
                // DO NOTHING
                break;
            }
    }
};
onBeforeBuild();
